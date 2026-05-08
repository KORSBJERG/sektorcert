import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  customerId: string;
}

const levelColor = (level: number | null | undefined) => {
  switch (level) {
    case 4:
      return "bg-emerald-500 text-white border-emerald-600";
    case 3:
      return "bg-lime-400 text-foreground border-lime-500";
    case 2:
      return "bg-amber-400 text-foreground border-amber-500";
    case 1:
      return "bg-red-500 text-white border-red-600";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const levelLabel = (level: number | null | undefined) => {
  switch (level) {
    case 4:
      return "Niveau 4 — Optimeret";
    case 3:
      return "Niveau 3 — Defineret";
    case 2:
      return "Niveau 2 — Delvist implementeret";
    case 1:
      return "Niveau 1 — Ad hoc";
    default:
      return "Ikke vurderet";
  }
};

export const RecommendationsHeatmap = ({ customerId }: Props) => {
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recommendations")
        .select("id, number, title")
        .order("number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: latestAssessment } = useQuery({
    queryKey: ["customer-latest-completed-assessment", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, assessment_date, version")
        .eq("customer_id", customerId)
        .eq("status", "completed")
        .order("assessment_date", { ascending: false })
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["heatmap-items", latestAssessment?.id],
    enabled: !!latestAssessment?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_items")
        .select("recommendation_id, maturity_level")
        .eq("assessment_id", latestAssessment!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const levelById = new Map<number, number | null>();
  items?.forEach((i) => levelById.set(i.recommendation_id, i.maturity_level));

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Modenhed pr. anbefaling</h3>
          <p className="text-xs text-muted-foreground">
            {latestAssessment
              ? `Baseret på seneste vurdering`
              : "Ingen færdig vurdering endnu — alle felter er grå"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-red-500" /> 1
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-amber-400" /> 2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-lime-400" /> 3
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-emerald-500" /> 4
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-muted border border-border" /> Ikke vurderet
          </span>
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-9 md:grid-cols-13" style={{ gridTemplateColumns: undefined }}>
          {recommendations.map((rec) => {
            const level = levelById.get(rec.id);
            return (
              <Tooltip key={rec.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex aspect-square cursor-default items-center justify-center rounded-md border text-sm font-bold transition-transform hover:scale-110 ${levelColor(level)}`}
                  >
                    {rec.number}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-semibold">#{rec.number} — {rec.title}</p>
                  <p className="text-xs text-muted-foreground">{levelLabel(level)}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};
