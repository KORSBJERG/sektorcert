import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Zap,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface SecurityReportsListProps {
  customerId: string;
  assessmentId?: string;
  onApplyMatches?: (reportId: string) => void;
}

interface SecurityReport {
  id: string;
  file_name: string;
  analysis_status: string;
  report_type: string | null;
  secure_score_current: number | null;
  secure_score_predicted: number | null;
  overall_status_percentage: number | null;
  created_at: string;
  file_path: string;
}

interface ReportMatch {
  id: string;
  report_recommendation_name: string;
  report_status: string | null;
  recommendation_id: number | null;
  match_confidence: number | null;
  suggested_maturity_level: number | null;
  applied: boolean;
  recommendations?: {
    number: number;
    title: string;
  } | null;
}

export function SecurityReportsList({ 
  customerId, 
  assessmentId,
  onApplyMatches 
}: SecurityReportsListProps) {
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["security-reports", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_reports")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SecurityReport[];
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["security-report-matches", selectedReport?.id],
    enabled: !!selectedReport,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_report_matches")
        .select("*, recommendations(number, title)")
        .eq("security_report_id", selectedReport!.id)
        .order("match_confidence", { ascending: false });
      if (error) throw error;
      return data as ReportMatch[];
    },
  });

  const handleDelete = async () => {
    if (!deleteReportId) return;

    try {
      // Get the file path first
      const { data: report } = await supabase
        .from("security_reports")
        .select("file_path")
        .eq("id", deleteReportId)
        .single();

      if (report?.file_path) {
        // Delete from storage
        await supabase.storage
          .from("security-reports")
          .remove([report.file_path]);
      }

      // Delete from database (cascades to matches)
      const { error } = await supabase
        .from("security_reports")
        .delete()
        .eq("id", deleteReportId);

      if (error) throw error;

      toast.success("Rapport slettet");
      queryClient.invalidateQueries({ queryKey: ["security-reports", customerId] });
      setDeleteReportId(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kunne ikke slette rapporten");
    }
  };

  const handleApplyMatches = async (reportId: string) => {
    if (!assessmentId) {
      toast.error("Ingen vurdering valgt");
      return;
    }

    try {
      // Get all matches for this report that have a recommendation_id
      const { data: matchesToApply, error: matchError } = await supabase
        .from("security_report_matches")
        .select("*")
        .eq("security_report_id", reportId)
        .not("recommendation_id", "is", null);

      if (matchError) throw matchError;

      if (!matchesToApply || matchesToApply.length === 0) {
        toast.info("Ingen matches at anvende");
        return;
      }

      // Get assessment items for this assessment
      const { data: assessmentItems, error: itemsError } = await supabase
        .from("assessment_items")
        .select("id, recommendation_id")
        .eq("assessment_id", assessmentId);

      if (itemsError) throw itemsError;

      // Create a map of recommendation_id to assessment_item_id
      const itemMap = new Map(
        assessmentItems?.map(item => [item.recommendation_id, item.id]) || []
      );

      // Update each matching assessment item
      let updatedCount = 0;
      for (const match of matchesToApply) {
        const assessmentItemId = itemMap.get(match.recommendation_id);
        if (assessmentItemId && match.suggested_maturity_level !== null) {
          const { error: updateError } = await supabase
            .from("assessment_items")
            .update({
              maturity_level: match.suggested_maturity_level,
              status: match.suggested_maturity_level >= 3 ? "fulfilled" : 
                      match.suggested_maturity_level >= 1 ? "partially_fulfilled" : "not_fulfilled",
              notes: `Auto-opdateret fra sikkerhedsrapport. Original status: ${match.report_status}`,
            })
            .eq("id", assessmentItemId);

          if (!updateError) {
            updatedCount++;
            
            // Mark match as applied
            await supabase
              .from("security_report_matches")
              .update({ 
                applied: true,
                assessment_item_id: assessmentItemId,
              })
              .eq("id", match.id);
          }
        }
      }

      toast.success(`${updatedCount} anbefalinger opdateret fra rapporten`);
      queryClient.invalidateQueries({ queryKey: ["assessment-items", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["security-report-matches", reportId] });
      
      if (onApplyMatches) {
        onApplyMatches(reportId);
      }
    } catch (error) {
      console.error("Apply matches error:", error);
      toast.error("Kunne ikke anvende matches");
    }
  };

  const handleDownloadPdf = async (reportId: string, fileName: string) => {
    try {
      toast.info("Genererer PDF...");
      
      const { data, error } = await supabase.functions.invoke("generate-security-report-pdf", {
        body: { reportId },
      });

      if (error) throw error;

      if (data?.html) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        }
        toast.success("PDF klar til print");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Kunne ikke generere PDF");
    }
  };

  const handleViewPdf = async (filePath: string, fileName: string) => {
    try {
      toast.info("Henter PDF...");
      
      // Download the file as blob to avoid browser blocking
      const { data, error } = await supabase.storage
        .from("security-reports")
        .download(filePath);

      if (error) throw error;
      if (data) {
        // Create a blob URL and open it
        const blob = new Blob([data], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create download link to trigger direct download
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        toast.success("PDF downloadet!");
      }
    } catch (error) {
      console.error("Error opening PDF:", error);
      toast.error("Kunne ikke åbne PDF");
    }
  };

  const getStatusBadge = (status: string, reportType: string | null) => {
    // External PDFs don't need analysis
    if (reportType === "external_pdf") {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30"><FileText className="mr-1 h-3 w-3" />PDF</Badge>;
    }
    
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-success"><CheckCircle2 className="mr-1 h-3 w-3" />Analyseret</Badge>;
      case "analyzing":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Analyserer</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />Fejl</Badge>;
      default:
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Afventer</Badge>;
    }
  };

  const getConfidenceIcon = (confidence: number | null) => {
    if (confidence === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (confidence >= 80) return <TrendingUp className="h-4 w-4 text-success" />;
    if (confidence >= 50) return <Minus className="h-4 w-4 text-warning" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Indlæser rapporter...</p>;
  }

  if (!reports || reports.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Uploadede Sikkerhedsrapporter</h3>
      
      {reports.map((report) => (
        <Card key={report.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{report.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(report.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusBadge(report.analysis_status, report.report_type)}
              
              {report.secure_score_current && (
                <Badge variant="outline">
                  Score: {report.secure_score_current.toFixed(0)}
                </Badge>
              )}
              
              {report.report_type === "external_pdf" ? (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleViewPdf(report.file_path, report.file_name)}
                  title="Åbn PDF"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedReport(report)}
                      disabled={report.analysis_status !== "completed"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Rapportanalyse: {report.file_name}</DialogTitle>
                    <DialogDescription>
                      Oversigt over matchede anbefalinger fra sikkerhedsrapporten
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-3 gap-4 py-4">
                    {report.secure_score_current && (
                      <div className="rounded-lg bg-accent p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {report.secure_score_current.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Nuværende Score</p>
                      </div>
                    )}
                    {report.secure_score_predicted && (
                      <div className="rounded-lg bg-success/10 p-3 text-center">
                        <p className="text-2xl font-bold text-success">
                          {report.secure_score_predicted.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Forventet Score</p>
                      </div>
                    )}
                    {report.overall_status_percentage && (
                      <div className="rounded-lg bg-primary/10 p-3 text-center">
                        <p className="text-2xl font-bold text-primary">
                          {report.overall_status_percentage.toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Overordnet Status</p>
                      </div>
                    )}
                  </div>
                  
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {matches?.map((match) => (
                        <div 
                          key={match.id} 
                          className={`flex items-center justify-between rounded-lg border p-3 ${
                            match.applied ? "bg-success/5 border-success/20" : ""
                          }`}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {match.report_recommendation_name}
                            </p>
                            {match.recommendations && (
                              <p className="text-xs text-primary">
                                → #{match.recommendations.number}: {match.recommendations.title}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Status: {match.report_status}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getConfidenceIcon(match.match_confidence)}
                            <Badge variant="outline">
                              Niveau {match.suggested_maturity_level}
                            </Badge>
                            {match.applied && (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="flex justify-end gap-2 pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => handleDownloadPdf(report.id, report.file_name)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </Button>
                      {assessmentId && (
                        <Button 
                          onClick={() => handleApplyMatches(report.id)}
                          className="gap-2 bg-gradient-primary"
                        >
                          <Zap className="h-4 w-4" />
                          Anvend alle matches
                        </Button>
                      )}
                    </div>
                </DialogContent>
                </Dialog>
              )}
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setDeleteReportId(report.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <AlertDialog open={!!deleteReportId} onOpenChange={() => setDeleteReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet rapport?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handling kan ikke fortrydes. Rapporten og alle tilknyttede analyseresultater vil blive slettet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SecurityReportsList;
