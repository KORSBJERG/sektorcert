import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { NIS2PlanEditor } from "./NIS2PlanEditor";
import { NIS2PlanViewer } from "./NIS2PlanViewer";
import { NIS2PlanHistory } from "./NIS2PlanHistory";
import { toast } from "sonner";

interface NIS2PlanSectionProps {
  customerId: string;
  customerName: string;
}

export function NIS2PlanSection({ customerId, customerName }: NIS2PlanSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGeneratedData, setAiGeneratedData] = useState<any>(null);

  const { data: latestPlan, isLoading, refetch } = useQuery({
    queryKey: ["nis2-plan-latest", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nis2_plans")
        .select("*")
        .eq("customer_id", customerId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Check if customer has analyzed reports
  const { data: analyzedReports } = useQuery({
    queryKey: ["analyzed-reports-count", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_reports")
        .select("id, report_type, file_name")
        .eq("customer_id", customerId)
        .eq("analysis_status", "completed");
      if (error) throw error;
      return data;
    },
  });

  const activePlan = selectedPlan || latestPlan;
  const hasReports = analyzedReports && analyzedReports.length > 0;

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-nis2-plan", {
        body: { customerId, customerName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiGeneratedData(data);
      setIsEditing(true);

      toast.success(`NIS2-plan genereret baseret på ${data.reports_used?.length || 0} rapport(er)`, {
        description: "Gennemgå og tilpas planen inden du gemmer.",
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast.error(error.message || "Kunne ikke generere NIS2-plan fra rapporter");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    setSelectedPlan(null);
    setAiGeneratedData(null);
    refetch();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAiGeneratedData(null);
  };

  const handleSelectVersion = (plan: any) => {
    setSelectedPlan(plan);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {activePlan && !aiGeneratedData ? "Rediger NIS2 Sikkerhedsplan" : aiGeneratedData ? "AI-genereret NIS2 Sikkerhedsplan" : "Opret NIS2 Sikkerhedsplan"}
          </h2>
          {aiGeneratedData && (
            <div className="flex items-center gap-2 text-sm text-chart-4 bg-chart-4/10 px-3 py-1.5 rounded-full">
              <Sparkles className="h-4 w-4" />
              Baseret på {aiGeneratedData.reports_used?.length || 0} rapport(er)
            </div>
          )}
        </div>
        <NIS2PlanEditor
          customerId={customerId}
          customerName={customerName}
          existingPlan={activePlan}
          aiGeneratedData={aiGeneratedData}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  if (activePlan) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-chart-4" />
            NIS2 Sikkerhedsplan
          </h2>
          <div className="flex items-center gap-2">
            {hasReports && (
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                variant="outline"
                size="sm"
                className="gap-2 border-chart-4/30 text-chart-4 hover:bg-chart-4/10"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Genererer..." : "Opdater fra rapporter"}
              </Button>
            )}
            <NIS2PlanHistory
              customerId={customerId}
              currentPlanId={activePlan.id}
              onSelectVersion={handleSelectVersion}
            />
          </div>
        </div>
        <NIS2PlanViewer
          plan={activePlan}
          customerName={customerName}
          onEdit={() => setIsEditing(true)}
        />
      </div>
    );
  }

  return (
    <Card className="border-dashed border-chart-4/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-4 rounded-full bg-chart-4/10 mb-4">
          <ShieldCheck className="h-8 w-8 text-chart-4" />
        </div>
        <CardTitle className="text-xl mb-2">Ingen NIS2 Sikkerhedsplan</CardTitle>
        <CardDescription className="text-center max-w-md mb-6">
          Opret en NIS2-kompatibel sikkerhedsplan med risikostyring, incident-håndtering,
          business continuity og leverandørsikkerhed.
        </CardDescription>
        <div className="flex gap-3">
          {hasReports && (
            <Button
              onClick={handleGenerateWithAI}
              disabled={isGenerating}
              className="gap-2 bg-gradient-to-r from-chart-4 to-primary text-white hover:opacity-90"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "AI analyserer rapporter..." : `Generér fra ${analyzedReports.length} rapport(er)`}
            </Button>
          )}
          <Button
            onClick={() => setIsEditing(true)}
            variant={hasReports ? "outline" : "default"}
            className={hasReports ? "" : "bg-chart-4 hover:bg-chart-4/90 text-white"}
          >
            <Plus className="h-4 w-4 mr-2" />
            Opret manuelt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
