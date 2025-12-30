import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface HuntressMatchesProps {
  integrationId: string;
  customerId: string;
  assessmentId?: string;
}

interface AnalysisMatch {
  recommendation_id: number;
  suggested_maturity_level: number;
  confidence: number;
  reasoning: string;
}

interface AnalysisResult {
  overall_security_score: number;
  matches: AnalysisMatch[];
  key_findings: string[];
  risk_areas: string[];
}

export const HuntressMatches = ({ integrationId, customerId, assessmentId }: HuntressMatchesProps) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncResult } = useQuery({
    queryKey: ["huntress-analysis", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_sync_results")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .order("number");
      if (error) throw error;
      return data;
    },
  });

  const analysisResult = syncResult?.analysis_result as unknown as AnalysisResult | null;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-huntress-data", {
        body: { integrationId },
      });

      if (error) throw error;

      toast({
        title: "Analyse fuldført",
        description: `Fandt ${data.analysis?.matches?.length || 0} relevante matches`,
      });

      queryClient.invalidateQueries({ queryKey: ["huntress-analysis", integrationId] });
    } catch (error: any) {
      toast({
        title: "Analysefejl",
        description: error.message || "Kunne ikke analysere data",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleMatch = (recId: number) => {
    setSelectedMatches((prev) =>
      prev.includes(recId) ? prev.filter((id) => id !== recId) : [...prev, recId]
    );
  };

  const handleSelectAll = () => {
    if (!analysisResult?.matches) return;
    if (selectedMatches.length === analysisResult.matches.length) {
      setSelectedMatches([]);
    } else {
      setSelectedMatches(analysisResult.matches.map((m) => m.recommendation_id));
    }
  };

  const handleApplyMatches = async () => {
    if (!assessmentId || selectedMatches.length === 0) {
      toast({
        title: "Ingen vurdering valgt",
        description: "Der skal være en aktiv vurdering for at anvende matches",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);
    try {
      const matchesToApply = analysisResult?.matches?.filter((m) =>
        selectedMatches.includes(m.recommendation_id)
      );

      if (!matchesToApply) return;

      for (const match of matchesToApply) {
        // Check if assessment item exists
        const { data: existingItem } = await supabase
          .from("assessment_items")
          .select("id")
          .eq("assessment_id", assessmentId)
          .eq("recommendation_id", match.recommendation_id)
          .single();

        if (existingItem) {
          // Update existing item
          await supabase
            .from("assessment_items")
            .update({
              maturity_level: match.suggested_maturity_level,
              notes: `Auto-opdateret fra Huntress: ${match.reasoning}`,
            })
            .eq("id", existingItem.id);
        } else {
          // Create new item
          await supabase.from("assessment_items").insert({
            assessment_id: assessmentId,
            recommendation_id: match.recommendation_id,
            maturity_level: match.suggested_maturity_level,
            notes: `Auto-oprettet fra Huntress: ${match.reasoning}`,
          });
        }
      }

      toast({
        title: "Matches anvendt",
        description: `${matchesToApply.length} anbefalinger er blevet opdateret`,
      });

      setSelectedMatches([]);
      queryClient.invalidateQueries({ queryKey: ["assessment-items", assessmentId] });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke anvende matches",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const getRecommendationTitle = (recId: number) => {
    return recommendations?.find((r) => r.id === recId)?.title || `Anbefaling #${recId}`;
  };

  const getMaturityLabel = (level: number) => {
    const labels: Record<number, string> = {
      0: "Ikke implementeret",
      1: "Grundlæggende",
      2: "Delvist implementeret",
      3: "Fuldt implementeret",
      4: "Optimeret",
    };
    return labels[level] || `Niveau ${level}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">AI-baseret Matching</h3>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {analysisResult ? "Genanalysér" : "Analysér data"}
        </Button>
      </div>

      {/* Analysis result */}
      {analysisResult && (
        <>
          {/* Security score */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-foreground">Samlet sikkerhedsscore</span>
              <span className="text-2xl font-bold text-primary">
                {analysisResult.overall_security_score}/100
              </span>
            </div>
            <Progress value={analysisResult.overall_security_score} className="h-2" />
          </Card>

          {/* Key findings and risks */}
          <div className="grid gap-4 md:grid-cols-2">
            {analysisResult.key_findings && analysisResult.key_findings.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Vigtige fund
                </h4>
                <ul className="space-y-2">
                  {analysisResult.key_findings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <TrendingUp className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {analysisResult.risk_areas && analysisResult.risk_areas.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Risikoomårder
                </h4>
                <ul className="space-y-2">
                  {analysisResult.risk_areas.map((risk, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-1 text-orange-500 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Matches */}
          {analysisResult.matches && analysisResult.matches.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-foreground">
                  Matchede anbefalinger ({analysisResult.matches.length})
                </h4>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedMatches.length === analysisResult.matches.length
                      ? "Fravælg alle"
                      : "Vælg alle"}
                  </Button>
                  {assessmentId && selectedMatches.length > 0 && (
                    <Button onClick={handleApplyMatches} disabled={applying} size="sm" className="gap-2">
                      {applying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      Anvend valgte ({selectedMatches.length})
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {analysisResult.matches.map((match) => (
                  <div
                    key={match.recommendation_id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedMatches.includes(match.recommendation_id)}
                      onCheckedChange={() => handleToggleMatch(match.recommendation_id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">
                          {getRecommendationTitle(match.recommendation_id)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {match.confidence}% sikkerhed
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            match.suggested_maturity_level >= 3
                              ? "default"
                              : match.suggested_maturity_level >= 2
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          Niveau {match.suggested_maturity_level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getMaturityLabel(match.suggested_maturity_level)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{match.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* No analysis state */}
      {!analysisResult && (
        <Card className="p-8 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Klik på "Analysér data" for at få AI-baserede anbefalinger baseret på dine Huntress-data
          </p>
        </Card>
      )}
    </div>
  );
};
