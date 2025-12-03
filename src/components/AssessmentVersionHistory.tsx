import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, FileText, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface AssessmentVersionHistoryProps {
  assessmentId: string;
  parentAssessmentId: string | null;
  currentVersion: number;
}

const AssessmentVersionHistory = ({
  assessmentId,
  parentAssessmentId,
  currentVersion,
}: AssessmentVersionHistoryProps) => {
  const navigate = useNavigate();
  const rootId = parentAssessmentId || assessmentId;

  const { data: versions } = useQuery({
    queryKey: ["assessment-versions", rootId],
    queryFn: async () => {
      // Get all assessments that share the same parent or are the parent
      const { data, error } = await supabase
        .from("assessments")
        .select("id, version, assessment_date, consultant_name, status, created_at, overall_maturity_score")
        .or(`id.eq.${rootId},parent_assessment_id.eq.${rootId}`)
        .order("version", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: currentVersion > 1 || !!parentAssessmentId,
  });

  // Don't show button if there's only one version
  if (!versions || versions.length <= 1) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Historik ({versions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorik
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {versions.map((version, index) => {
            const isCurrentVersion = version.id === assessmentId;
            const isLatest = index === versions.length - 1;

            return (
              <div
                key={version.id}
                className={`relative flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                  isCurrentVersion
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                {/* Timeline connector */}
                {index < versions.length - 1 && (
                  <div className="absolute left-7 top-14 h-[calc(100%-2rem)] w-0.5 bg-border" />
                )}

                {/* Version indicator */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCurrentVersion
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  v{version.version}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">
                      {format(new Date(version.assessment_date), "d. MMMM yyyy", {
                        locale: da,
                      })}
                    </span>
                    {isCurrentVersion && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                        Nuværende
                      </span>
                    )}
                    {isLatest && !isCurrentVersion && (
                      <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                        Seneste
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Konsulent: {version.consultant_name}
                  </p>

                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {version.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      ) : (
                        <Clock className="h-3 w-3 text-warning" />
                      )}
                      {version.status === "completed" ? "Afsluttet" : "Igangværende"}
                    </span>
                    {version.overall_maturity_score !== null && (
                      <span className="text-muted-foreground">
                        Score: {version.overall_maturity_score.toFixed(2)}/4
                      </span>
                    )}
                  </div>

                  {!isCurrentVersion && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto p-0 text-primary"
                      onClick={() => {
                        if (version.status === "completed") {
                          navigate(`/assessments/${version.id}/report`);
                        } else {
                          navigate(`/assessments/${version.id}`);
                        }
                      }}
                    >
                      <FileText className="mr-1 h-3 w-3" />
                      {version.status === "completed" ? "Se rapport" : "Åbn vurdering"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssessmentVersionHistory;
