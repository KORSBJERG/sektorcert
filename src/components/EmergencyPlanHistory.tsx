import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText, ChevronRight, Eye } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface EmergencyPlanHistoryProps {
  customerId: string;
  currentPlanId?: string;
  onSelectVersion: (plan: Tables<"emergency_plans">) => void;
}

export function EmergencyPlanHistory({ customerId, currentPlanId, onSelectVersion }: EmergencyPlanHistoryProps) {
  const [open, setOpen] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["emergency-plan-history", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_plans")
        .select("*")
        .eq("customer_id", customerId)
        .order("version", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSelectVersion = (plan: Tables<"emergency_plans">) => {
    onSelectVersion(plan);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Versionshistorik
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorik
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : plans && plans.length > 0 ? (
            <div className="space-y-2">
              {plans.map((plan, index) => (
                <div
                  key={plan.id}
                  className={`relative flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                    plan.id === currentPlanId ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  {/* Timeline connector */}
                  {index < plans.length - 1 && (
                    <div className="absolute left-7 top-14 bottom-0 w-0.5 bg-border -mb-2" />
                  )}

                  {/* Version indicator */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                    plan.id === currentPlanId 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <span className="text-sm font-bold">{plan.version}</span>
                  </div>

                  {/* Plan info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{plan.title}</span>
                      {plan.id === currentPlanId && (
                        <Badge variant="default" className="shrink-0">Aktuel</Badge>
                      )}
                      <Badge variant="outline" className="shrink-0">
                        {plan.status === "active" ? "Aktiv" : plan.status === "draft" ? "Kladde" : "Arkiveret"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>
                        Oprettet {format(new Date(plan.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                      </span>
                      {plan.last_reviewed_by && (
                        <span className="ml-2">• Gennemgået af {plan.last_reviewed_by}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant={plan.id === currentPlanId ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleSelectVersion(plan)}
                    className="shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {plan.id === currentPlanId ? "Aktuel" : "Vis"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p>Ingen versioner fundet</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
