import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShieldCheck } from "lucide-react";
import { NIS2PlanEditor } from "./NIS2PlanEditor";
import { NIS2PlanViewer } from "./NIS2PlanViewer";
import { NIS2PlanHistory } from "./NIS2PlanHistory";

interface NIS2PlanSectionProps {
  customerId: string;
  customerName: string;
}

export function NIS2PlanSection({ customerId, customerName }: NIS2PlanSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

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

  const activePlan = selectedPlan || latestPlan;

  const handleSave = () => {
    setIsEditing(false);
    setSelectedPlan(null);
    refetch();
  };

  const handleCancel = () => {
    setIsEditing(false);
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
            {activePlan ? "Rediger NIS2 Sikkerhedsplan" : "Opret NIS2 Sikkerhedsplan"}
          </h2>
        </div>
        <NIS2PlanEditor
          customerId={customerId}
          customerName={customerName}
          existingPlan={activePlan}
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
          <NIS2PlanHistory
            customerId={customerId}
            currentPlanId={activePlan.id}
            onSelectVersion={handleSelectVersion}
          />
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
        <Button onClick={() => setIsEditing(true)} className="bg-chart-4 hover:bg-chart-4/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Opret NIS2 Sikkerhedsplan
        </Button>
      </CardContent>
    </Card>
  );
}
