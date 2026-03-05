import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface NIS2PlanHistoryProps {
  customerId: string;
  currentPlanId: string;
  onSelectVersion: (plan: any) => void;
}

export function NIS2PlanHistory({ customerId, currentPlanId, onSelectVersion }: NIS2PlanHistoryProps) {
  const { data: plans } = useQuery({
    queryKey: ["nis2-plan-history", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nis2_plans")
        .select("*")
        .eq("customer_id", customerId)
        .order("version", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (!plans || plans.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Versionshistorik
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {plans.map((plan) => (
          <DropdownMenuItem
            key={plan.id}
            onClick={() => onSelectVersion(plan)}
            className={plan.id === currentPlanId ? "bg-accent" : ""}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <span className="font-medium">Version {plan.version}</span>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(plan.updated_at), "d. MMM yyyy", { locale: da })}
                </p>
              </div>
              <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-xs">
                {plan.status === "active" ? "Aktiv" : plan.status === "draft" ? "Kladde" : "Arkiveret"}
              </Badge>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
