import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield, AlertTriangle, Server, Users, Receipt, Activity, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { HuntressLinkDialog } from "./HuntressLinkDialog";
import { HuntressDetailDialog } from "./HuntressDetailDialog";
import { HuntressIdentityCard } from "./HuntressIdentityCard";

interface Props {
  customerId: string;
  huntressOrganizationId: string | null;
}

export const HuntressLiveData = ({ customerId, huntressOrganizationId }: Props) => {
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<{ kind: "agent" | "incident"; id: string | number; title: string } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: syncRows } = useQuery({
    queryKey: ["huntress-sync", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_sync_data")
        .select("*")
        .eq("customer_id", customerId)
        .order("synced_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const latest = (type: string) => syncRows?.find((r) => r.sync_type === type);
  const agents = ((latest("agents")?.data as any)?.items ?? []) as any[];
  const incidents = ((latest("incidents")?.data as any)?.items ?? []) as any[];
  const summaries = ((latest("summary")?.data as any)?.items ?? []) as any[];
  const billing = ((latest("billing")?.data as any)?.items ?? []) as any[];
  const organization = ((latest("organization")?.data as any)?.item ?? null) as any;
  const openIncidents = incidents.filter((i: any) => i?.status && !["closed", "resolved"].includes(String(i.status).toLowerCase()));
  const onlineAgents = agents.filter((a: any) => String(a?.status ?? "").toLowerCase() === "online" || a?.last_callback_at);
  const isolatedAgents = agents.filter((a: any) => a?.isolation_state && String(a.isolation_state).toLowerCase() !== "normal");
  const lastSummary = summaries[0];
  const lastBilling = billing[0];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("huntress-sync-customer", {
        body: { customerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Synkroniseret",
        description: `${data.counts?.agents ?? 0} agenter · ${data.counts?.incidents ?? 0} hændelser`,
      });
      qc.invalidateQueries({ queryKey: ["huntress-sync", customerId] });
    } catch (e: any) {
      toast({ title: "Sync fejlede", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (!huntressOrganizationId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">Denne kunde er ikke forbundet til Huntress.</p>
        <HuntressLinkDialog customerId={customerId} currentOrgId={null} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Huntress Live</h3>
          <Badge variant="outline">{organization?.name ?? `Org #${huntressOrganizationId}`}</Badge>
        </div>
        <div className="flex gap-2">
          <HuntressLinkDialog customerId={customerId} currentOrgId={huntressOrganizationId} />
          <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synkroniserer…" : "Sync nu"}
          </Button>
        </div>
      </div>

      {organization && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">M365-brugere</p>
            <p className="text-lg font-bold text-foreground">{organization.microsoft_365_users_count ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Identiteter (faktureres)</p>
            <p className="text-lg font-bold text-foreground">{organization.billable_identity_count ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">SAT-deltagere</p>
            <p className="text-lg font-bold text-foreground">{organization.sat_learner_count ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Log-kilder</p>
            <p className="text-lg font-bold text-foreground">{organization.logs_sources_count ?? 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Server className="h-3 w-3" /> Agenter
          </div>
          <p className="text-2xl font-bold text-foreground">{agents.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {onlineAgents.length} online
            {isolatedAgents.length > 0 && ` · ${isolatedAgents.length} isoleret`}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <AlertTriangle className="h-3 w-3" /> Åbne hændelser
          </div>
          <p className={`text-2xl font-bold ${openIncidents.length === 0 ? "text-foreground" : openIncidents.length <= 2 ? "text-yellow-600" : "text-destructive"}`}>
            {openIncidents.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{incidents.length} i alt</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Activity className="h-3 w-3" /> Summary-rapporter
          </div>
          <p className="text-2xl font-bold text-foreground">{summaries.length}</p>
          {lastSummary?.created_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Seneste: {format(new Date(lastSummary.created_at), "d. MMM", { locale: da })}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="h-3 w-3" /> Faktura-rapporter
          </div>
          <p className="text-2xl font-bold text-foreground">{billing.length}</p>
          {lastBilling?.period && (
            <p className="text-xs text-muted-foreground mt-1">{lastBilling.period}</p>
          )}
        </div>
      </div>

      {agents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Agenter
          </h4>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {agents.slice(0, 20).map((a: any) => {
              const online = String(a?.status ?? "").toLowerCase() === "online";
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setDetail({ kind: "agent", id: a.id, title: a.hostname ?? a.name ?? `Agent #${a.id}` })}
                  className="w-full text-left flex items-center justify-between rounded border border-border p-3 text-sm hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {online ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{a.hostname ?? a.name ?? `Agent #${a.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.platform ?? a.os}
                        {a.version && ` · v${a.version}`}
                        {a.isolation_state && a.isolation_state !== "normal" && ` · ${a.isolation_state}`}
                      </p>
                    </div>
                  </div>
                  {a.last_callback_at && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(a.last_callback_at), "d. MMM HH:mm", { locale: da })}
                    </span>
                  )}
                </button>
              );
            })}
            {agents.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">+{agents.length - 20} flere agenter</p>
            )}
          </div>
        </div>
      )}

      {incidents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Seneste hændelser</h4>
          <div className="space-y-2">
            {incidents.slice(0, 10).map((inc: any) => (
              <button
                type="button"
                key={inc.id}
                onClick={() => setDetail({ kind: "incident", id: inc.id, title: inc.summary ?? inc.title ?? `Incident #${inc.id}` })}
                className="w-full text-left flex items-center justify-between rounded border border-border p-3 text-sm hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{inc.summary ?? inc.title ?? `Incident #${inc.id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {inc.severity && <span className="mr-2">Severity: {inc.severity}</span>}
                    {inc.status && <span>Status: {inc.status}</span>}
                  </p>
                </div>
                {inc.sent_at && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(inc.sent_at), "d. MMM yyyy", { locale: da })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {organization && (
        <HuntressIdentityCard
          organization={organization}
          lastSyncedAt={latest("organization")?.synced_at ?? syncRows?.[0]?.synced_at ?? null}
        />
      )}

      {syncRows && syncRows[0] && (
        <p className="text-xs text-muted-foreground">
          Sidst synkroniseret: {format(new Date(syncRows[0].synced_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
        </p>
      )}

      {detail && (
        <HuntressDetailDialog
          open={!!detail}
          onOpenChange={(o) => !o && setDetail(null)}
          customerId={customerId}
          kind={detail.kind}
          id={detail.id}
          title={detail.title}
        />
      )}
    </div>
  );
};