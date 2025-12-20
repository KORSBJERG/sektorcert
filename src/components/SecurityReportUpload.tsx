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
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bruger ikke logget ind");

      // Read file content
      const csvContent = await file.text();
      setProgress(20);

      // Upload file to storage
      const filePath = `${user.id}/${customerId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("security-reports")
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setProgress(40);

      // Create security report record
      const { data: report, error: reportError } = await supabase
        .from("security_reports")
        .insert({
          customer_id: customerId,
          created_by_user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          analysis_status: "analyzing",
        })
        .select()
        .single();

      if (reportError) throw reportError;
      setProgress(50);

      // Fetch recommendations for matching
      const { data: recommendations, error: recError } = await supabase
        .from("recommendations")
        .select("id, number, title, description");

      if (recError) throw recError;
      setProgress(60);

      setStatus("analyzing");

      // Call AI analysis function
      const { data: analysisData, error: analysisError } = await supabase.functions
        .invoke("analyze-security-report", {
          body: {
            reportId: report.id,
            csvContent,
            recommendations,
          },
        });

      if (analysisError) throw analysisError;
      
      if (analysisData?.error) {
        throw new Error(analysisData.error);
      }

      setProgress(100);
      setStatus("complete");

      toast.success(`Rapport analyseret! ${analysisData.matchCount} matches fundet.`);
      
      queryClient.invalidateQueries({ queryKey: ["security-reports", customerId] });
      
      if (onUploadComplete) {
        onUploadComplete(report.id);
      }

      // Reset after a short delay
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

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploader fil...";
      case "analyzing":
        return "AI analyserer rapporten...";
      case "complete":
        return "Analyse færdig!";
      case "error":
        return errorMessage || "Der opstod en fejl";
      default:
        return "Træk en fil hertil eller klik for at vælge";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Upload Sikkerhedsrapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Sikkerhedsrapport</DialogTitle>
          <DialogDescription>
            Upload en Microsoft 365 Security Baselines rapport (CSV) for automatisk analyse og integration med sikkerhedsvurderingen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8
              transition-colors cursor-pointer
              ${status === "idle" 
                ? "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent" 
                : "border-primary/50 bg-accent/50"
              }
              ${status === "error" ? "border-destructive/50 bg-destructive/10" : ""}
            `}
          >
            {getStatusIcon()}
            <p className="text-sm text-center text-muted-foreground">
              {getStatusText()}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={status !== "idle"}
              className="hidden"
            />
          </label>

          {(status === "uploading" || status === "analyzing") && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {status === "analyzing" 
                  ? "AI analyserer rapporten og matcher med anbefalinger..." 
                  : `${progress}% uploadet`
                }
              </p>
            </div>
          )}

          {status === "idle" && (
            <p className="text-xs text-center text-muted-foreground">
              Understøttede formater: CSV (Microsoft 365 Security Baselines)
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SecurityReportUpload;
