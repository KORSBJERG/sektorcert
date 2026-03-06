import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, Edit, Calendar, User, CheckCircle2, Clock, Circle, Minus,
  Building2, AlertTriangle, RefreshCcw, Link2, Network, Search, Lock, Users, KeyRound,
  ChevronDown, ChevronRight, FileDown, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { NIS2Category, NIS2CategoryItem } from "./nis2-categories";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  governance: <Building2 className="h-5 w-5" />,
  incident: <AlertTriangle className="h-5 w-5" />,
  continuity: <RefreshCcw className="h-5 w-5" />,
  supply_chain: <Link2 className="h-5 w-5" />,
  network: <Network className="h-5 w-5" />,
  vulnerability: <Search className="h-5 w-5" />,
  access: <Lock className="h-5 w-5" />,
  hr_awareness: <Users className="h-5 w-5" />,
  crypto: <KeyRound className="h-5 w-5" />,
};

const STATUS_CONFIG = {
  not_started: { label: "Ikke startet", icon: Circle, color: "text-muted-foreground", bg: "bg-muted/50" },
  in_progress: { label: "I gang", icon: Clock, color: "text-chart-4", bg: "bg-chart-4/10" },
  implemented: { label: "Implementeret", icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10" },
  not_applicable: { label: "Ikke relevant", icon: Minus, color: "text-muted-foreground", bg: "bg-muted/30" },
};

const RISK_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Lav risiko", variant: "outline" },
  medium: { label: "Medium risiko", variant: "secondary" },
  high: { label: "Høj risiko", variant: "destructive" },
  critical: { label: "Kritisk risiko", variant: "destructive" },
};

interface NIS2PlanViewerProps {
  plan: any;
  customerName: string;
  customerLogo?: string;
  onEdit: () => void;
}

export function NIS2PlanViewer({ plan, customerName, customerLogo, onEdit }: NIS2PlanViewerProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();
  const categories = (plan.categories as unknown as NIS2Category[]) || [];

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const getOverallProgress = () => {
    const allItems = categories.flatMap(c => c.items).filter(i => i.status !== "not_applicable");
    if (allItems.length === 0) return 0;
    return Math.round((allItems.filter(i => i.status === "implemented").length / allItems.length) * 100);
  };

  const getCategoryProgress = (cat: NIS2Category) => {
    const applicable = cat.items.filter(i => i.status !== "not_applicable");
    if (applicable.length === 0) return 100;
    return Math.round((applicable.filter(i => i.status === "implemented").length / applicable.length) * 100);
  };

  const overallProgress = getOverallProgress();
  const riskConfig = RISK_LABELS[plan.risk_level] || RISK_LABELS.medium;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-chart-4/10">
            <ShieldCheck className="h-6 w-6 text-chart-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{plan.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">Version {plan.version}</Badge>
              <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                {plan.status === "active" ? "Aktiv" : plan.status === "draft" ? "Kladde" : "Arkiveret"}
              </Badge>
              <Badge variant={riskConfig.variant}>{riskConfig.label}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsGeneratingPdf(true);
              try {
                const { data, error } = await supabase.functions.invoke('generate-nis2-plan-pdf', {
                  body: {
                    plan: {
                      title: plan.title,
                      version: plan.version,
                      status: plan.status,
                      risk_level: plan.risk_level,
                      responsible_person: plan.responsible_person,
                      responsible_role: plan.responsible_role,
                      responsible_email: plan.responsible_email,
                      responsible_phone: plan.responsible_phone,
                      categories,
                      additional_notes: plan.additional_notes,
                      last_reviewed_at: plan.last_reviewed_at,
                      last_reviewed_by: plan.last_reviewed_by,
                      next_review_at: plan.next_review_at,
                      created_at: plan.created_at,
                      updated_at: plan.updated_at,
                    },
                    customerName,
                    customerLogo,
                  },
                });
                if (error) throw error;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(data);
                  printWindow.document.close();
                  printWindow.onload = () => setTimeout(() => printWindow.print(), 250);
                }
                toast({ title: "PDF genereret", description: "Brug browserens print-funktion for at gemme som PDF." });
              } catch (error) {
                console.error('Error generating PDF:', error);
                toast({ title: "Fejl ved generering", description: "Der opstod en fejl. Prøv igen.", variant: "destructive" });
              } finally {
                setIsGeneratingPdf(false);
              }
            }}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {isGeneratingPdf ? "Genererer..." : "Download PDF"}
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Rediger
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="border-chart-4/20 overflow-hidden">
        <div className="h-1 bg-chart-4/20">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${overallProgress}%`,
              background: overallProgress === 100
                ? "hsl(var(--chart-2))"
                : "hsl(var(--chart-4))",
            }}
          />
        </div>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Samlet NIS2 Compliance</h3>
              <p className="text-sm text-muted-foreground">Overordnet fremgang på tværs af alle kategorier</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: overallProgress === 100 ? "hsl(var(--chart-2))" : "hsl(var(--chart-4))" }}>
                {overallProgress}%
              </p>
              <p className="text-xs text-muted-foreground">implementeret</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["implemented", "in_progress", "not_started", "not_applicable"] as const).map(status => {
              const cfg = STATUS_CONFIG[status];
              const StatusIcon = cfg.icon;
              const count = categories.flatMap(c => c.items).filter(i => i.status === status).length;
              return (
                <div key={status} className={`flex items-center gap-2 p-3 rounded-lg ${cfg.bg}`}>
                  <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                  <div>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Responsible person */}
      {plan.responsible_person && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Ansvarlig for NIS2 Compliance</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pl-11">
              <div>
                <p className="text-xs text-muted-foreground">Navn</p>
                <p className="font-medium">{plan.responsible_person}</p>
              </div>
              {plan.responsible_role && (
                <div>
                  <p className="text-xs text-muted-foreground">Rolle</p>
                  <p className="font-medium">{plan.responsible_role}</p>
                </div>
              )}
              {plan.responsible_email && (
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{plan.responsible_email}</p>
                </div>
              )}
              {plan.responsible_phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Telefon</p>
                  <p className="font-medium">{plan.responsible_phone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const progress = getCategoryProgress(cat);
          const isExpanded = expandedCategories.includes(cat.id);
          return (
            <Card key={cat.id} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-chart-4/10 text-chart-4">
                  {CATEGORY_ICONS[cat.id] || <ShieldCheck className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{cat.title}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-28 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background: progress === 100
                          ? "hsl(var(--chart-2))"
                          : progress > 50
                          ? "hsl(var(--chart-4))"
                          : "hsl(var(--chart-5))",
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-10 text-right">{progress}%</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 space-y-2 border-t">
                  {cat.items.map((item) => {
                    const cfg = STATUS_CONFIG[item.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg ${cfg.bg}`}>
                        <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{item.text}</p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{cfg.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Review Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Gennemgang</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sidst gennemgået</p>
              <p className="font-medium">
                {plan.last_reviewed_at
                  ? format(new Date(plan.last_reviewed_at), "d. MMMM yyyy", { locale: da })
                  : "Ikke registreret"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gennemgået af</p>
              <p className="font-medium">{plan.last_reviewed_by || "Ikke angivet"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Næste gennemgang</p>
              <p className="font-medium">
                {plan.next_review_at
                  ? format(new Date(plan.next_review_at), "d. MMMM yyyy", { locale: da })
                  : "Ikke planlagt"}
              </p>
            </div>
          </div>

          {plan.additional_notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Yderligere noter</p>
                <p className="whitespace-pre-wrap">{plan.additional_notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Meta Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>Oprettet: {format(new Date(plan.created_at), "d. MMMM yyyy", { locale: da })}</span>
        <span>Sidst opdateret: {format(new Date(plan.updated_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}</span>
      </div>
    </div>
  );
}
