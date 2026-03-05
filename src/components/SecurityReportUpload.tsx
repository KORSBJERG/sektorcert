import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, FileUp, Globe } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecurityReportUploadProps {
  customerId: string;
  assessmentId?: string;
  onUploadComplete?: (reportId: string) => void;
}

type UploadStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

export function SecurityReportUpload({ 
  customerId, 
  assessmentId,
  onUploadComplete 
}: SecurityReportUploadProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"csv" | "pdf" | "dns">("csv");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const dnsInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleCsvSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Kun CSV-filer er understøttet");
      return;
    }

    setStatus("uploading");
    setProgress(10);
    setErrorMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bruger ikke logget ind");

      const csvContent = await file.text();
      setProgress(20);

      const filePath = `${user.id}/${customerId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("security-reports")
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setProgress(40);

      const { data: report, error: reportError } = await supabase
        .from("security_reports")
        .insert({
          customer_id: customerId,
          created_by_user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          analysis_status: "analyzing",
          report_type: "microsoft_365_baseline",
        })
        .select()
        .single();

      if (reportError) throw reportError;
      setProgress(50);

      const { data: recommendations, error: recError } = await supabase
        .from("recommendations")
        .select("id, number, title, description");

      if (recError) throw recError;
      setProgress(60);

      setStatus("analyzing");

      const { data: analysisData, error: analysisError } = await supabase.functions
        .invoke("analyze-security-report", {
          body: { reportId: report.id, csvContent, recommendations },
        });

      if (analysisError) throw analysisError;
      if (analysisData?.error) throw new Error(analysisData.error);

      setProgress(100);
      setStatus("complete");

      toast.success(`Rapport analyseret! ${analysisData.matchCount} matches fundet.`);
      queryClient.invalidateQueries({ queryKey: ["security-reports", customerId] });
      
      if (onUploadComplete) onUploadComplete(report.id);

      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setProgress(0);
      }, 2000);

    } catch (error) {
      console.error("Upload error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Ukendt fejl");
      toast.error("Fejl ved upload af rapport");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePdfSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Kun PDF-filer er understøttet");
      return;
    }

    setStatus("uploading");
    setProgress(10);
    setErrorMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bruger ikke logget ind");

      setProgress(30);

      const filePath = `${user.id}/${customerId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("security-reports")
        .upload(filePath, file, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;
      setProgress(70);

      const { data: report, error: reportError } = await supabase
        .from("security_reports")
        .insert({
          customer_id: customerId,
          created_by_user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          analysis_status: "not_applicable",
          report_type: "external_pdf",
        })
        .select()
        .single();

      if (reportError) throw reportError;

      setProgress(100);
      setStatus("complete");

      toast.success("PDF-rapport uploadet!");
      queryClient.invalidateQueries({ queryKey: ["security-reports", customerId] });
      
      if (onUploadComplete) onUploadComplete(report.id);

      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setProgress(0);
      }, 2000);

    } catch (error) {
      console.error("Upload error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Ukendt fejl");
      toast.error("Fejl ved upload af PDF");
    }

    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const handleDnsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Kun PDF-filer er understøttet for DNS-rapporter");
      return;
    }

    setStatus("uploading");
    setProgress(10);
    setErrorMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bruger ikke logget ind");

      // Read file as base64 for AI analysis
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const pdfBase64 = btoa(binary);

      setProgress(20);

      // Upload to storage
      const filePath = `${user.id}/${customerId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("security-reports")
        .upload(filePath, file, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;
      setProgress(40);

      // Create report record
      const { data: report, error: reportError } = await supabase
        .from("security_reports")
        .insert({
          customer_id: customerId,
          created_by_user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          analysis_status: "analyzing",
          report_type: "dns_security",
        })
        .select()
        .single();

      if (reportError) throw reportError;
      setProgress(50);

      setStatus("analyzing");

      // Call AI analysis
      const { data: analysisData, error: analysisError } = await supabase.functions
        .invoke("analyze-dns-report", {
          body: { reportId: report.id, pdfBase64 },
        });

      if (analysisError) throw analysisError;
      if (analysisData?.error) throw new Error(analysisData.error);

      setProgress(100);
      setStatus("complete");

      toast.success(`DNS-rapport analyseret! ${analysisData.findingsCount} fund identificeret.`);
      queryClient.invalidateQueries({ queryKey: ["security-reports", customerId] });
      
      if (onUploadComplete) onUploadComplete(report.id);

      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setProgress(0);
      }, 2000);

    } catch (error) {
      console.error("DNS upload error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Ukendt fejl");
      toast.error("Fejl ved analyse af DNS-rapport");
    }

    if (dnsInputRef.current) dnsInputRef.current.value = "";
  };

  const getStatusIcon = () => {
    switch (status) {
      case "uploading":
      case "analyzing":
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
      case "complete":
        return <CheckCircle2 className="h-8 w-8 text-success" />;
      case "error":
        return <AlertCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Upload className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusText = (type: "csv" | "pdf" | "dns") => {
    switch (status) {
      case "uploading":
        return "Uploader fil...";
      case "analyzing":
        return type === "dns" ? "AI analyserer DNS-rapport..." : "AI analyserer rapporten...";
      case "complete":
        return type === "csv" || type === "dns" ? "Analyse færdig!" : "Upload færdig!";
      case "error":
        return errorMessage || "Der opstod en fejl";
      default:
        return "Træk en fil hertil eller klik for at vælge";
    }
  };

  const resetState = () => {
    setStatus("idle");
    setProgress(0);
    setErrorMessage("");
  };

  const dropZoneClasses = `
    flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8
    transition-colors cursor-pointer
    ${status === "idle" 
      ? "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent" 
      : "border-primary/50 bg-accent/50"
    }
    ${status === "error" ? "border-destructive/50 bg-destructive/10" : ""}
  `;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Upload Sikkerhedsrapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Sikkerhedsrapport</DialogTitle>
          <DialogDescription>
            Upload en sikkerhedsrapport til denne kunde.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); resetState(); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="csv" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              M365 (CSV)
            </TabsTrigger>
            <TabsTrigger value="dns" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              DNS Sikkerhed
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5 text-xs">
              <FileUp className="h-3.5 w-3.5" />
              Ekstern (PDF)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-4 mt-4">
            <label className={dropZoneClasses}>
              {getStatusIcon()}
              <p className="text-sm text-center text-muted-foreground">{getStatusText("csv")}</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvSelect} disabled={status !== "idle"} className="hidden" />
            </label>
            {(status === "uploading" || status === "analyzing") && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {status === "analyzing" ? "AI analyserer rapporten og matcher med anbefalinger..." : `${progress}% uploadet`}
                </p>
              </div>
            )}
            {status === "idle" && (
              <p className="text-xs text-center text-muted-foreground">
                Upload en Microsoft 365 Security Baselines rapport for automatisk AI-analyse og integration med sikkerhedsvurderingen.
              </p>
            )}
          </TabsContent>

          <TabsContent value="dns" className="space-y-4 mt-4">
            <label className={dropZoneClasses}>
              {getStatusIcon()}
              <p className="text-sm text-center text-muted-foreground">{getStatusText("dns")}</p>
              <input ref={dnsInputRef} type="file" accept=".pdf" onChange={handleDnsSelect} disabled={status !== "idle"} className="hidden" />
            </label>
            {(status === "uploading" || status === "analyzing") && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {status === "analyzing" 
                    ? "AI analyserer DNS-sikkerhedsrapporten og udtrækker fund..." 
                    : `${progress}% uploadet`
                  }
                </p>
              </div>
            )}
            {status === "idle" && (
              <p className="text-xs text-center text-muted-foreground">
                Upload en DNS-sikkerhedsrapport (f.eks. Skysnag) i PDF-format. AI'en analyserer rapporten og udtrækker DMARC, SPF, DKIM og andre DNS-sikkerhedsfund.
              </p>
            )}
          </TabsContent>

          <TabsContent value="pdf" className="space-y-4 mt-4">
            <label className={dropZoneClasses}>
              {getStatusIcon()}
              <p className="text-sm text-center text-muted-foreground">{getStatusText("pdf")}</p>
              <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePdfSelect} disabled={status !== "idle"} className="hidden" />
            </label>
            {status === "uploading" && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{`${progress}% uploadet`}</p>
              </div>
            )}
            {status === "idle" && (
              <p className="text-xs text-center text-muted-foreground">
                Upload en ekstern sikkerhedsrapport i PDF-format. Denne gemmes som vedhæftet dokument uden AI-analyse.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default SecurityReportUpload;
