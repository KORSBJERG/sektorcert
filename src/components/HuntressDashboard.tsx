import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  AlertTriangle,
  Shield,
  Monitor,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Radio,
  Settings2,
  AlertCircle,
  CreditCard,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SyncOptions {
  incidents: boolean;
  agents: boolean;
  reports: boolean;
  signals: boolean;
  escalations: boolean;
  billing: boolean;
  summaries: boolean;
}

interface HuntressDashboardProps {
  integrationId: string;
  customerId: string;
}

export const HuntressDashboard = ({ integrationId, customerId }: HuntressDashboardProps) => {
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgentsTable, setShowAgentsTable] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Record<string, unknown> | null>(null);
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    incidents: true,
    agents: true,
    reports: true,
    signals: true,
    escalations: true,
    billing: false,
    summaries: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integration } = useQuery({
    queryKey: ["huntress-integration-status", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_integrations")
        .select("*")
        .eq("id", integrationId)
        .single();
      if (error) throw error;
      if (data?.sync_options && typeof data.sync_options === 'object') {
        const opts = data.sync_options as Record<string, boolean>;
        setSyncOptions({
          incidents: opts.incidents ?? true,
          agents: opts.agents ?? true,
          reports: opts.reports ?? true,
          signals: opts.signals ?? true,
          escalations: opts.escalations ?? true,
          billing: opts.billing ?? false,
          summaries: opts.summaries ?? true,
        });
      }
      return data;
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ["huntress-incidents", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_incidents")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["huntress-agents", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_agents")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("hostname", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["huntress-reports", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_reports")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: signals } = useQuery({
    queryKey: ["huntress-signals", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_signals")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: escalations } = useQuery({
    queryKey: ["huntress-escalations", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_escalations")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: billing } = useQuery({
    queryKey: ["huntress-billing", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_billing")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("period_end", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: summaryReports } = useQuery({
    queryKey: ["huntress-summary-reports", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_summary_reports")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: syncResults } = useQuery({
    queryKey: ["huntress-sync-results", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_sync_results")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const handleSaveSyncOptions = async () => {
    try {
      const { error } = await supabase
        .from("huntress_integrations")
        .update({ sync_options: syncOptions as unknown as Record<string, boolean> })
        .eq("id", integrationId);

      if (error) throw error;

      toast({
        title: "Indstillinger gemt",
        description: "Sync indstillinger er opdateret",
      });
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Fejl",
        description: err.message || "Kunne ikke gemme indstillinger",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("huntress-sync", {
        body: { integrationId, syncOptions },
      });

      if (error) throw error;

      const counts = [];
      if (data.incidents_count > 0) counts.push(`${data.incidents_count} incidents`);
      if (data.agents_count > 0) counts.push(`${data.agents_count} agents`);
      if (data.reports_count > 0) counts.push(`${data.reports_count} rapporter`);
      if (data.signals_count > 0) counts.push(`${data.signals_count} signals`);
      if (data.escalations_count > 0) counts.push(`${data.escalations_count} eskaleringer`);
      if (data.summaries_count > 0) counts.push(`${data.summaries_count} opsummeringer`);

      toast({
        title: "Synkronisering fuldført",
        description: counts.length > 0 ? `Hentet ${counts.join(", ")}` : "Ingen data fundet",
      });

      queryClient.invalidateQueries({ queryKey: ["huntress-incidents", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-agents", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-reports", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-signals", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-escalations", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-billing", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-summary-reports", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-sync-results", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-integration-status", integrationId] });
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Synkroniseringsfejl",
        description: err.message || "Kunne ikke synkronisere data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const criticalCount = incidents?.filter((i) => i.severity === "critical").length || 0;
  const highCount = incidents?.filter((i) => i.severity === "high").length || 0;
  const totalAgents = agents?.length || 0;
  const defenderEnabled = agents?.filter((a) => a.defender_status === "enabled").length || 0;
  const healthPercentage = totalAgents > 0 ? Math.round((defenderEnabled / totalAgents) * 100) : 0;
  const activeEscalations = escalations?.filter((e) => e.status !== "closed").length || 0;

  const chartData = syncResults?.slice().reverse().map((result) => ({
    date: format(new Date(result.created_at), "d/M", { locale: da }),
    incidents: result.incidents_count,
    critical: result.critical_incidents,
    agents: result.agents_count,
  })) || [];

  const chartConfig = {
    incidents: { label: "Incidents", color: "hsl(var(--primary))" },
    critical: { label: "Kritiske", color: "hsl(var(--destructive))" },
    agents: { label: "Agents", color: "hsl(var(--secondary))" },
  };

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Huntress Dashboard</h3>
          {integration?.sync_status === "completed" && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Synkroniseret
            </Badge>
          )}
          {integration?.sync_status === "error" && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Fejl
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {integration?.last_sync_at && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Sidst opdateret: {format(new Date(integration.last_sync_at), "d. MMM HH:mm", { locale: da })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="h-9 w-9"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Synkroniser nu
          </Button>
        </div>
      </div>

      {/* Sync options */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent>
          <Card className="p-4 mb-4">
            <h4 className="font-medium text-foreground mb-3">Vælg hvad der skal synkroniseres</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-incidents"
                  checked={syncOptions.incidents}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, incidents: !!checked })
                  }
                />
                <Label htmlFor="sync-incidents" className="flex items-center gap-2 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Incidents
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-agents"
                  checked={syncOptions.agents}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, agents: !!checked })
                  }
                />
                <Label htmlFor="sync-agents" className="flex items-center gap-2 cursor-pointer">
                  <Monitor className="h-4 w-4 text-primary" />
                  Agents
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-reports"
                  checked={syncOptions.reports}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, reports: !!checked })
                  }
                />
                <Label htmlFor="sync-reports" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Rapporter
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-signals"
                  checked={syncOptions.signals}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, signals: !!checked })
                  }
                />
                <Label htmlFor="sync-signals" className="flex items-center gap-2 cursor-pointer">
                  <Radio className="h-4 w-4 text-purple-500" />
                  Signals
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-escalations"
                  checked={syncOptions.escalations}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, escalations: !!checked })
                  }
                />
                <Label htmlFor="sync-escalations" className="flex items-center gap-2 cursor-pointer">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Eskaleringer
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-billing"
                  checked={syncOptions.billing}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, billing: !!checked })
                  }
                />
                <Label htmlFor="sync-billing" className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Fakturering
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-summaries"
                  checked={syncOptions.summaries}
                  onCheckedChange={(checked) =>
                    setSyncOptions({ ...syncOptions, summaries: !!checked })
                  }
                />
                <Label htmlFor="sync-summaries" className="flex items-center gap-2 cursor-pointer">
                  <BarChart3 className="h-4 w-4 text-teal-500" />
                  Opsummeringer
                </Label>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={handleSaveSyncOptions}>
                Gem indstillinger
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Main stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kritiske incidents</p>
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Høj prioritet</p>
              <p className="text-2xl font-bold text-orange-500">{highCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowAgentsTable(true)}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Endpoints</p>
              <p className="text-2xl font-bold text-foreground">{totalAgents}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Shield className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Defender aktiv</p>
              <p className="text-2xl font-bold text-green-500">{healthPercentage}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {activeEscalations > 0 && (
          <Card className="p-4 border-orange-500/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktive eskaleringer</p>
                <p className="text-2xl font-bold text-orange-500">{activeEscalations}</p>
              </div>
            </div>
          </Card>
        )}

        {reports && reports.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rapporter</p>
                <p className="text-2xl font-bold text-foreground">{reports.length}</p>
              </div>
            </div>
          </Card>
        )}

        {signals && signals.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Radio className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signals</p>
                <p className="text-2xl font-bold text-foreground">{signals.length}</p>
              </div>
            </div>
          </Card>
        )}

        {summaryReports && summaryReports.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
                <BarChart3 className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opsummeringer</p>
                <p className="text-2xl font-bold text-foreground">{summaryReports.length}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trend over tid
          </h4>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="critical"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      )}

      {/* Escalations */}
      {escalations && escalations.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Aktive eskaleringer
          </h4>
          <div className="space-y-2">
            {escalations.filter(e => e.status !== "closed").slice(0, 5).map((escalation) => (
              <div
                key={escalation.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      escalation.severity === "critical"
                        ? "destructive"
                        : escalation.severity === "high"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {escalation.severity || "unknown"}
                  </Badge>
                  <div>
                    <span className="text-sm font-medium text-foreground">{escalation.title}</span>
                    {escalation.affected_host && (
                      <p className="text-xs text-muted-foreground">{escalation.affected_host}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline">{escalation.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent incidents */}
      {incidents && incidents.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground">Seneste incidents</h4>
          <div className="space-y-2">
            {incidents.slice(0, 5).map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedIncident(incident.raw_data as Record<string, unknown> || incident)}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      incident.severity === "critical"
                        ? "destructive"
                        : incident.severity === "high"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {incident.severity}
                  </Badge>
                  <div>
                    <span className="text-sm font-medium text-foreground">{incident.title}</span>
                    {incident.remediation_status && (
                      <p className="text-xs text-muted-foreground">Status: {incident.remediation_status}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {incident.detected_at
                    ? format(new Date(incident.detected_at), "d. MMM yyyy HH:mm", { locale: da })
                    : "Ukendt"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Summary reports */}
      {summaryReports && summaryReports.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-500" />
            Månedlige opsummeringer
          </h4>
          <div className="space-y-2">
            {summaryReports.slice(0, 3).map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{report.report_type || "Summary"}</Badge>
                  <span className="text-sm font-medium text-foreground">{report.report_period}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {report.generated_at
                      ? format(new Date(report.generated_at), "d. MMM yyyy", { locale: da })
                      : "Ukendt"}
                  </span>
                  {report.pdf_url && (
                    <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent signals */}
      {signals && signals.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-purple-500" />
            Seneste signals
          </h4>
          <div className="space-y-2">
            {signals.slice(0, 5).map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{signal.signal_type || "Signal"}</Badge>
                  <span className="text-sm font-medium text-foreground">{signal.hostname || "Ukendt"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {signal.detected_at
                    ? format(new Date(signal.detected_at), "d. MMM yyyy HH:mm", { locale: da })
                    : "Ukendt"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No data state */}
      {(!incidents || incidents.length === 0) && (!agents || agents.length === 0) && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Ingen data endnu</p>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Hent data fra Huntress
          </Button>
        </Card>
      )}

      {/* Agents Table Dialog */}
      <Dialog open={showAgentsTable} onOpenChange={setShowAgentsTable}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Alle endpoints ({totalAgents})
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Domæne</TableHead>
                <TableHead>Agent Version</TableHead>
                <TableHead>Defender</TableHead>
                <TableHead>Sidst set</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.hostname}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{agent.os_version}</TableCell>
                  <TableCell className="text-sm">{agent.external_ip || "-"}</TableCell>
                  <TableCell className="text-sm">{agent.domain || "-"}</TableCell>
                  <TableCell className="text-sm">{agent.agent_version || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={agent.defender_status === "enabled" ? "default" : "secondary"}>
                      {agent.defender_status === "enabled" ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {agent.last_seen_at
                      ? format(new Date(agent.last_seen_at), "d. MMM HH:mm", { locale: da })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Incident detaljer
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Titel</h4>
                <p className="text-foreground">{String(selectedIncident.title || "Ukendt")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Severity</h4>
                  <Badge
                    variant={
                      selectedIncident.severity === "critical"
                        ? "destructive"
                        : selectedIncident.severity === "high"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {String(selectedIncident.severity || "unknown")}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Status</h4>
                  <Badge variant="outline">{String(selectedIncident.status || "unknown")}</Badge>
                </div>
              </div>
              {selectedIncident.remediation_status && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Remediation Status</h4>
                  <p className="text-foreground">{String(selectedIncident.remediation_status)}</p>
                </div>
              )}
              {selectedIncident.remediation_steps && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Remediation Steps</h4>
                  <p className="text-foreground whitespace-pre-wrap">{String(selectedIncident.remediation_steps)}</p>
                </div>
              )}
              {selectedIncident.affected_hosts && Array.isArray(selectedIncident.affected_hosts) && selectedIncident.affected_hosts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Berørte hosts</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedIncident.affected_hosts as string[]).map((host: string, i: number) => (
                      <Badge key={i} variant="outline">{host}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedIncident.indicators && typeof selectedIncident.indicators === 'object' && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Indicators</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedIncident.indicators, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
