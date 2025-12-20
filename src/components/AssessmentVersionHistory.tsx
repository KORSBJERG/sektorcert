import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, FileText, Clock, CheckCircle2, ArrowUp, ArrowDown, Minus, GitCompare } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssessmentVersionHistoryProps {
  assessmentId: string;
  parentAssessmentId: string | null;
  currentVersion: number;
}

interface VersionChange {
  recommendationNumber: number;
  recommendationTitle: string;
  oldLevel: number | null;
  newLevel: number | null;
  oldStatus: string | null;
  newStatus: string | null;
  changeType: 'improved' | 'regressed' | 'unchanged' | 'added' | 'removed';
}

export function AssessmentVersionHistory({
  assessmentId,
  parentAssessmentId,
  currentVersion,
}: AssessmentVersionHistoryProps) {
  const navigate = useNavigate();
  const [selectedVersions, setSelectedVersions] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  });

  const rootId = parentAssessmentId || assessmentId;

  const { data: versions } = useQuery({
    queryKey: ["assessment-versions", rootId],
    queryFn: async () => {
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

  const { data: comparisonData, isLoading: loadingComparison } = useQuery({
    queryKey: ["version-comparison", selectedVersions.from, selectedVersions.to],
    queryFn: async () => {
      if (!selectedVersions.from || !selectedVersions.to) return null;

      // Fetch items for both versions
      const [fromResult, toResult] = await Promise.all([
        supabase
          .from("assessment_items")
          .select("*, recommendations(number, title)")
          .eq("assessment_id", selectedVersions.from),
        supabase
          .from("assessment_items")
          .select("*, recommendations(number, title)")
          .eq("assessment_id", selectedVersions.to),
      ]);

      if (fromResult.error) throw fromResult.error;
      if (toResult.error) throw toResult.error;

      const fromItems = fromResult.data || [];
      const toItems = toResult.data || [];

      // Compare items
      const changes: VersionChange[] = [];
      const processedIds = new Set<number>();

      // Check items in the "to" version
      for (const toItem of toItems) {
        const fromItem = fromItems.find(
          (f) => f.recommendation_id === toItem.recommendation_id
        );
        const rec = toItem.recommendations as { number: number; title: string } | null;

        if (!fromItem) {
          changes.push({
            recommendationNumber: rec?.number || 0,
            recommendationTitle: rec?.title || "Ukendt",
            oldLevel: null,
            newLevel: toItem.maturity_level,
            oldStatus: null,
            newStatus: toItem.status,
            changeType: 'added',
          });
        } else {
          processedIds.add(toItem.recommendation_id);
          const levelChanged = fromItem.maturity_level !== toItem.maturity_level;
          const statusChanged = fromItem.status !== toItem.status;

          if (levelChanged || statusChanged) {
            let changeType: VersionChange['changeType'] = 'unchanged';
            if (levelChanged) {
              const oldLevel = fromItem.maturity_level ?? 0;
              const newLevel = toItem.maturity_level ?? 0;
              changeType = newLevel > oldLevel ? 'improved' : newLevel < oldLevel ? 'regressed' : 'unchanged';
            } else if (statusChanged) {
              changeType = 'improved'; // Status change without level change
            }

            changes.push({
              recommendationNumber: rec?.number || 0,
              recommendationTitle: rec?.title || "Ukendt",
              oldLevel: fromItem.maturity_level,
              newLevel: toItem.maturity_level,
              oldStatus: fromItem.status,
              newStatus: toItem.status,
              changeType,
            });
          }
        }
      }

      // Check for removed items
      for (const fromItem of fromItems) {
        if (!processedIds.has(fromItem.recommendation_id)) {
          const exists = toItems.find(t => t.recommendation_id === fromItem.recommendation_id);
          if (!exists) {
            const rec = fromItem.recommendations as { number: number; title: string } | null;
            changes.push({
              recommendationNumber: rec?.number || 0,
              recommendationTitle: rec?.title || "Ukendt",
              oldLevel: fromItem.maturity_level,
              newLevel: null,
              oldStatus: fromItem.status,
              newStatus: null,
              changeType: 'removed',
            });
          }
        }
      }

      // Sort by recommendation number
      changes.sort((a, b) => a.recommendationNumber - b.recommendationNumber);

      return changes;
    },
    enabled: !!selectedVersions.from && !!selectedVersions.to,
  });

  const handleSelectForComparison = (versionId: string) => {
    if (!selectedVersions.from) {
      setSelectedVersions({ from: versionId, to: null });
    } else if (!selectedVersions.to && versionId !== selectedVersions.from) {
      // Ensure from is the older version
      const fromVersion = versions?.find(v => v.id === selectedVersions.from);
      const toVersion = versions?.find(v => v.id === versionId);
      if (fromVersion && toVersion && fromVersion.version > toVersion.version) {
        setSelectedVersions({ from: versionId, to: selectedVersions.from });
      } else {
        setSelectedVersions({ from: selectedVersions.from, to: versionId });
      }
    } else {
      setSelectedVersions({ from: versionId, to: null });
    }
  };

  const getChangeIcon = (changeType: VersionChange['changeType']) => {
    switch (changeType) {
      case 'improved':
        return <ArrowUp className="h-4 w-4 text-success" />;
      case 'regressed':
        return <ArrowDown className="h-4 w-4 text-destructive" />;
      case 'unchanged':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      case 'added':
        return <Badge variant="outline" className="text-success border-success">Ny</Badge>;
      case 'removed':
        return <Badge variant="outline" className="text-destructive border-destructive">Fjernet</Badge>;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'fulfilled':
        return 'Opfyldt';
      case 'partially_fulfilled':
        return 'Delvist opfyldt';
      case 'not_fulfilled':
        return 'Ikke opfyldt';
      case 'not_applicable':
        return 'Ikke relevant';
      default:
        return '-';
    }
  };

  if (currentVersion <= 1 && !parentAssessmentId) {
    return null;
  }

  const changesCount = comparisonData?.filter(c => c.changeType !== 'unchanged').length || 0;
  const improvedCount = comparisonData?.filter(c => c.changeType === 'improved').length || 0;
  const regressedCount = comparisonData?.filter(c => c.changeType === 'regressed').length || 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          Historik
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorik
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="timeline">Tidslinje</TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-1">
              <GitCompare className="h-4 w-4" />
              Sammenlign
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {versions?.map((version, index) => {
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
                      {index < versions.length - 1 && (
                        <div className="absolute left-7 top-14 h-[calc(100%-2rem)] w-0.5 bg-border" />
                      )}

                      <div
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isCurrentVersion
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        v{version.version}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">
                            {format(new Date(version.assessment_date), "d. MMMM yyyy", {
                              locale: da,
                            })}
                          </span>
                          {isCurrentVersion && (
                            <Badge variant="secondary" className="text-xs">
                              Nuværende
                            </Badge>
                          )}
                          {isLatest && !isCurrentVersion && (
                            <Badge className="bg-success/20 text-success text-xs">
                              Seneste
                            </Badge>
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
                            {version.status === "completed" ? "Se rapport" : "Fortsæt"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="compare" className="mt-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <p className="text-sm text-muted-foreground w-full mb-2">
                  Vælg to versioner at sammenligne:
                </p>
                {versions?.map((version) => {
                  const isSelected = selectedVersions.from === version.id || selectedVersions.to === version.id;
                  const isFrom = selectedVersions.from === version.id;
                  const isTo = selectedVersions.to === version.id;

                  return (
                    <Button
                      key={version.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSelectForComparison(version.id)}
                      className={isSelected ? "" : ""}
                    >
                      v{version.version}
                      {isFrom && " (fra)"}
                      {isTo && " (til)"}
                    </Button>
                  );
                })}
              </div>

              {selectedVersions.from && selectedVersions.to && (
                <>
                  <div className="flex gap-4 text-sm">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-success" />
                      {improvedCount} forbedret
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ArrowDown className="h-3 w-3 text-destructive" />
                      {regressedCount} forringet
                    </Badge>
                    <Badge variant="outline">
                      {changesCount} ændringer i alt
                    </Badge>
                  </div>

                  <ScrollArea className="h-[300px]">
                    {loadingComparison ? (
                      <p className="text-sm text-muted-foreground">Indlæser...</p>
                    ) : comparisonData && comparisonData.length > 0 ? (
                      <div className="space-y-2">
                        {comparisonData
                          .filter(c => c.changeType !== 'unchanged')
                          .map((change, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 rounded-lg border p-3"
                            >
                              <div className="flex-shrink-0">
                                {getChangeIcon(change.changeType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {change.recommendationNumber}. {change.recommendationTitle}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  {change.oldLevel !== null && change.newLevel !== null && (
                                    <span>
                                      Niveau: {change.oldLevel} → {change.newLevel}
                                    </span>
                                  )}
                                  {change.oldStatus !== change.newStatus && (
                                    <span>
                                      Status: {getStatusLabel(change.oldStatus)} → {getStatusLabel(change.newStatus)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        {comparisonData.filter(c => c.changeType !== 'unchanged').length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Ingen ændringer mellem disse versioner
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Ingen ændringer mellem disse versioner
                      </p>
                    )}
                  </ScrollArea>
                </>
              )}

              {(!selectedVersions.from || !selectedVersions.to) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Vælg to versioner ovenfor for at se ændringer
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
