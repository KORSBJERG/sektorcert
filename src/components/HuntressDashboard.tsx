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

interface SyncOptions {
  incidents: boolean;
  agents: boolean;
  reports: boolean;
  signals: boolean;
}

interface HuntressDashboardProps {
  integrationId: string;
  customerId: string;
}

export const HuntressDashboard = ({ integrationId, customerId }: HuntressDashboardProps) => {
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    incidents: true,
    agents: true,
    reports: true,
    signals: true,
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
      // Set sync options from integration if available
      if (data?.sync_options && typeof data.sync_options === 'object') {
        const opts = data.sync_options as Record<string, boolean>;
        setSyncOptions({
          incidents: opts.incidents ?? true,
          agents: opts.agents ?? true,
          reports: opts.reports ?? true,
          signals: opts.signals ?? true,
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
        .eq("huntress_integration_id", integrationId);
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
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke gemme indstillinger",
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

      toast({
        title: "Synkronisering fuldført",
        description: counts.length > 0 ? `Hentet ${counts.join(", ")}` : "Ingen data fundet",
      });

      queryClient.invalidateQueries({ queryKey: ["huntress-incidents", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-agents", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-reports", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-signals", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-sync-results", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["huntress-integration-status", integrationId] });
    } catch (error: any) {
      toast({
        title: "Synkroniseringsfejl",
        description: error.message || "Kunne ikke synkronisere data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const criticalCount = incidents?.filter((i) => i.severity === "critical").length || 0;
  const highCount = incidents?.filter((i) => i.severity === "high").length || 0;
  const mediumCount = incidents?.filter((i) => i.severity === "medium").length || 0;
  const lowCount = incidents?.filter((i) => i.severity === "low").length || 0;

  const defenderEnabled = agents?.filter((a) => a.defender_status === "enabled").length || 0;
  const totalAgents = agents?.length || 0;
  const healthPercentage = totalAgents > 0 ? Math.round((defenderEnabled / totalAgents) * 100) : 0;

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={handleSaveSyncOptions}>
                Gem indstillinger
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Stats cards */}
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

        <Card className="p-4">
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

      {/* Additional stats for reports and signals */}
      {(reports && reports.length > 0) || (signals && signals.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      ) : null}

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

      {/* Recent incidents */}
      {incidents && incidents.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-4 font-semibold text-foreground">Seneste incidents</h4>
          <div className="space-y-2">
            {incidents.slice(0, 5).map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
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
                  <span className="text-sm font-medium text-foreground">{incident.title}</span>
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
    </div>
  );
};