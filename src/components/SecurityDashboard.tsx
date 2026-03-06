import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, Shield, Globe, Bug, AlertTriangle, CheckCircle2,
  Clock, Circle, FileText, TrendingUp, Activity,
} from "lucide-react";

interface SecurityDashboardProps {
  customerId: string;
  customerName: string;
}

interface ReportSummary {
  type: string;
  count: number;
  latestDate: string;
  status: "good" | "warning" | "critical" | "none";
  score?: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  details?: string;
}

interface NIS2CategoryData {
  id: string;
  title: string;
  items: { status: string }[];
}

export function SecurityDashboard({ customerId, customerName }: SecurityDashboardProps) {
  const { data: reports } = useQuery({
    queryKey: ["security-reports-dashboard", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_reports")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: nis2Plan } = useQuery({
    queryKey: ["nis2-plan-dashboard", customerId],
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

  const { data: emergencyPlan } = useQuery({
    queryKey: ["emergency-plan-dashboard", customerId],
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

  // Process report data
  const m365Reports = (reports || []).filter(r => r.report_type === "microsoft_365_baseline");
  const dnsReports = (reports || []).filter(r => r.report_type === "dns_security");
  const huntressReports = (reports || []).filter(r => r.report_type === "huntress_threat");

  const getLatestAnalyzed = (list: typeof m365Reports) => 
    list.find(r => r.analysis_status === "completed");

  const latestM365 = getLatestAnalyzed(m365Reports);
  const latestDns = getLatestAnalyzed(dnsReports);
  const latestHuntress = getLatestAnalyzed(huntressReports);

  // Build report summaries
  const reportSummaries: ReportSummary[] = [
    {
      type: "m365",
      count: m365Reports.length,
      latestDate: latestM365?.created_at || "",
      status: latestM365 
        ? (latestM365.secure_score_current && latestM365.secure_score_current >= 70 ? "good" : latestM365.secure_score_current && latestM365.secure_score_current >= 40 ? "warning" : "critical")
        : "none",
      score: latestM365?.secure_score_current ? Number(latestM365.secure_score_current) : undefined,
      label: "Microsoft 365",
      icon: <Shield className="h-5 w-5" />,
      color: "hsl(var(--chart-1))",
      details: latestM365?.secure_score_predicted 
        ? `Predicted: ${Number(latestM365.secure_score_predicted).toFixed(0)}%` 
        : undefined,
    },
    {
      type: "dns",
      count: dnsReports.length,
      latestDate: latestDns?.created_at || "",
      status: latestDns
        ? (latestDns.overall_status_percentage && Number(latestDns.overall_status_percentage) >= 70 ? "good" : Number(latestDns.overall_status_percentage) >= 40 ? "warning" : "critical")
        : "none",
      score: latestDns?.overall_status_percentage ? Number(latestDns.overall_status_percentage) : undefined,
      label: "DNS Sikkerhed",
      icon: <Globe className="h-5 w-5" />,
      color: "hsl(var(--chart-2))",
      details: latestDns ? "Skysnag/DNS rapport" : undefined,
    },
    {
      type: "huntress",
      count: huntressReports.length,
      latestDate: latestHuntress?.created_at || "",
      status: latestHuntress ? "good" : "none",
      score: latestHuntress?.overall_status_percentage ? Number(latestHuntress.overall_status_percentage) : undefined,
      label: "Huntress",
      icon: <Bug className="h-5 w-5" />,
      color: "hsl(var(--chart-4))",
      details: latestHuntress ? "Trusselsrapport" : undefined,
    },
  ];

  // NIS2 calculations
  const nis2Categories = (nis2Plan?.categories as unknown as NIS2CategoryData[]) || [];
  const allNis2Items = nis2Categories.flatMap(c => c.items);
  const applicableItems = allNis2Items.filter(i => i.status !== "not_applicable");
  const nis2Progress = applicableItems.length > 0
    ? Math.round((applicableItems.filter(i => i.status === "implemented").length / applicableItems.length) * 100)
    : 0;
  const nis2InProgress = allNis2Items.filter(i => i.status === "in_progress").length;
  const nis2NotStarted = allNis2Items.filter(i => i.status === "not_started").length;
  const nis2Implemented = allNis2Items.filter(i => i.status === "implemented").length;

  // Overall health score
  const scores: number[] = [];
  if (latestM365?.secure_score_current) scores.push(Number(latestM365.secure_score_current));
  if (latestDns?.overall_status_percentage) scores.push(Number(latestDns.overall_status_percentage));
  if (nis2Plan) scores.push(nis2Progress);
  const overallHealth = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const getHealthColor = (score: number) => {
    if (score >= 70) return "hsl(var(--chart-2))";
    if (score >= 40) return "hsl(var(--chart-4))";
    return "hsl(var(--destructive))";
  };

  const getStatusBadge = (status: "good" | "warning" | "critical" | "none") => {
    switch (status) {
      case "good": return <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 hover:bg-chart-2/20">God</Badge>;
      case "warning": return <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/20 hover:bg-chart-4/20">Advarsel</Badge>;
      case "critical": return <Badge variant="destructive">Kritisk</Badge>;
      default: return <Badge variant="outline">Ingen data</Badge>;
    }
  };

  const totalReports = (reports || []).length;
  const analyzedReports = (reports || []).filter(r => r.analysis_status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sikkerhedsoversigt</h2>
          <p className="text-sm text-muted-foreground">Samlet status på tværs af alle sikkerhedsdomæner</p>
        </div>
      </div>

      {/* Top row: Overall health + quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Health Score */}
        <Card className="md:col-span-1 overflow-hidden">
          <div className="h-1" style={{ background: overallHealth ? getHealthColor(overallHealth) : "hsl(var(--muted))" }} />
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Samlet Sundhed</p>
            {overallHealth !== null ? (
              <>
                <p className="text-4xl font-extrabold" style={{ color: getHealthColor(overallHealth) }}>
                  {overallHealth}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  baseret på {scores.length} datakilde{scores.length !== 1 ? "r" : ""}
                </p>
              </>
            ) : (
              <div className="py-2">
                <Circle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingen data endnu</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report type cards */}
        {reportSummaries.map((summary) => (
          <Card key={summary.type} className="overflow-hidden">
            <div className="h-1" style={{ background: summary.status !== "none" ? summary.color : "hsl(var(--muted))" }} />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `${summary.color}15` }}>
                    <span style={{ color: summary.color }}>{summary.icon}</span>
                  </div>
                  <span className="font-semibold text-sm">{summary.label}</span>
                </div>
                {getStatusBadge(summary.status)}
              </div>
              {summary.score !== undefined ? (
                <div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-bold" style={{ color: summary.color }}>{summary.score.toFixed(0)}%</span>
                    {summary.details && <span className="text-xs text-muted-foreground">({summary.details})</span>}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${summary.score}%`, background: summary.color }} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {summary.count > 0 ? `${summary.count} rapport(er) — afventer analyse` : "Ingen rapporter uploadet"}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {summary.count} rapport{summary.count !== 1 ? "er" : ""} total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NIS2 + Plans row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NIS2 Compliance */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ background: nis2Plan ? (nis2Progress >= 70 ? "hsl(var(--chart-2))" : nis2Progress >= 30 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))") : "hsl(var(--muted))" }} />
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-chart-4/10">
                  <ShieldCheck className="h-5 w-5 text-chart-4" />
                </div>
                <span className="font-semibold">NIS2 Compliance</span>
              </div>
              {nis2Plan ? (
                <Badge variant="outline">Version {nis2Plan.version}</Badge>
              ) : (
                <Badge variant="outline">Ikke oprettet</Badge>
              )}
            </div>

            {nis2Plan ? (
              <>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold" style={{ color: nis2Progress >= 70 ? "hsl(var(--chart-2))" : nis2Progress >= 30 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))" }}>
                    {nis2Progress}%
                  </span>
                  <span className="text-sm text-muted-foreground">implementeret</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${nis2Progress}%`,
                      background: nis2Progress >= 70 ? "hsl(var(--chart-2))" : nis2Progress >= 30 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))",
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-chart-2/5">
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                    <div>
                      <p className="text-sm font-bold">{nis2Implemented}</p>
                      <p className="text-[10px] text-muted-foreground">Implementeret</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-chart-4/5">
                    <Clock className="h-4 w-4 text-chart-4" />
                    <div>
                      <p className="text-sm font-bold">{nis2InProgress}</p>
                      <p className="text-[10px] text-muted-foreground">I gang</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-bold">{nis2NotStarted}</p>
                      <p className="text-[10px] text-muted-foreground">Ikke startet</p>
                    </div>
                  </div>
                </div>

                {/* Category mini-bars */}
                <div className="mt-4 space-y-1.5">
                  {nis2Categories.map(cat => {
                    const applicable = cat.items.filter(i => i.status !== "not_applicable");
                    const progress = applicable.length > 0
                      ? Math.round((applicable.filter(i => i.status === "implemented").length / applicable.length) * 100)
                      : 100;
                    return (
                      <div key={cat.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-28 truncate">{cat.title}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${progress}%`,
                              background: progress === 100 ? "hsl(var(--chart-2))" : progress > 50 ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold w-7 text-right">{progress}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">NIS2-sikkerhedsplan er ikke oprettet endnu. Opret en plan under NIS2-sektionen nedenfor.</p>
            )}
          </CardContent>
        </Card>

        {/* Emergency Plan + Reports summary */}
        <div className="space-y-4">
          {/* Emergency plan status */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <span className="font-semibold">Beredskabsplan</span>
                </div>
                {emergencyPlan ? (
                  <Badge variant={emergencyPlan.status === "active" ? "default" : "secondary"}>
                    {emergencyPlan.status === "active" ? "Aktiv" : "Kladde"}
                  </Badge>
                ) : (
                  <Badge variant="outline">Ikke oprettet</Badge>
                )}
              </div>
              {emergencyPlan ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">IT-kontakt</p>
                    <p className="font-medium">{emergencyPlan.it_contact_company || "Ikke angivet"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Version</p>
                    <p className="font-medium">{emergencyPlan.version}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen beredskabsplan oprettet.</p>
              )}
            </CardContent>
          </Card>

          {/* Reports overview */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold">Rapportoversigt</span>
                </div>
                <Badge variant="outline">{totalReports} total</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xl font-bold text-primary">{totalReports}</p>
                  <p className="text-[10px] text-muted-foreground">Uploadet</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-chart-2/5">
                  <p className="text-xl font-bold text-chart-2">{analyzedReports}</p>
                  <p className="text-[10px] text-muted-foreground">Analyseret</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-chart-4/5">
                  <p className="text-xl font-bold text-chart-4">{totalReports - analyzedReports}</p>
                  <p className="text-[10px] text-muted-foreground">Afventer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
