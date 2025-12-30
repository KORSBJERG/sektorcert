import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Shield } from "lucide-react";
import { EmergencyPlanEditor } from "./EmergencyPlanEditor";
import { EmergencyPlanViewer } from "./EmergencyPlanViewer";
import { EmergencyPlanHistory } from "./EmergencyPlanHistory";
import type { Tables } from "@/integrations/supabase/types";

interface EmergencyPlanSectionProps {
  customerId: string;
  customerName: string;
}

export function EmergencyPlanSection({ customerId, customerName }: EmergencyPlanSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Tables<"emergency_plans"> | null>(null);

  const { data: latestPlan, isLoading, refetch } = useQuery({
    queryKey: ["emergency-plan-latest", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_plans")
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

  const handleSelectVersion = (plan: Tables<"emergency_plans">) => {
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
            {activePlan ? "Rediger Beredskabsplan" : "Opret Beredskabsplan"}
          </h2>
        </div>
        <EmergencyPlanEditor
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
            <Shield className="h-5 w-5 text-primary" />
            Beredskabsplan
          </h2>
          <EmergencyPlanHistory
            customerId={customerId}
            currentPlanId={activePlan.id}
            onSelectVersion={handleSelectVersion}
          />
        </div>
        <EmergencyPlanViewer
          plan={activePlan}
          customerName={customerName}
          onEdit={() => setIsEditing(true)}
        />
      </div>
    );
  }

  // No plan exists yet - show create prompt
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-4 rounded-full bg-primary/10 mb-4">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl mb-2">Ingen beredskabsplan</CardTitle>
        <CardDescription className="text-center max-w-md mb-6">
          Opret en beredskabsplan for cyberkriminalitet med kontaktoplysninger, 
          sikkerhedsforanstaltninger og årlig gennemgang.
        </CardDescription>
        <Button onClick={() => setIsEditing(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Opret beredskabsplan
        </Button>
      </CardContent>
    </Card>
  );
}
