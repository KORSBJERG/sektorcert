import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield, AlertTriangle, Server } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { HuntressLinkDialog } from "./HuntressLinkDialog";

interface Props {
  customerId: string;
  huntressOrganizationId: string | null;
}

export const HuntressLiveData = ({ customerId, huntressOrganizationId }: Props) => {
  const [syncing, setSyncing] = useState(false);
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
  const openIncidents = incidents.filter((i: any) => i?.status && !["closed", "resolved"].includes(String(i.status).toLowerCase()));

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
          <Badge variant="outline">Org #{huntressOrganizationId}</Badge>
        </div>
        <div className="flex gap-2">
          <HuntressLinkDialog customerId={customerId} currentOrgId={huntressOrganizationId} />
          <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synkroniserer…" : "Sync nu"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Server className="h-3 w-3" /> Agenter
          </div>
          <p className="text-2xl font-bold text-foreground">{agents.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <AlertTriangle className="h-3 w-3" /> Åbne hændelser
          </div>
          <p className={`text-2xl font-bold ${openIncidents.length === 0 ? "text-foreground" : openIncidents.length <= 2 ? "text-yellow-600" : "text-destructive"}`}>
            {openIncidents.length}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-muted-foreground text-xs mb-1">Hændelser i alt</div>
          <p className="text-2xl font-bold text-foreground">{incidents.length}</p>
        </div>
      </div>

      {incidents.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Seneste hændelser</h4>
          <div className="space-y-2">
            {incidents.slice(0, 10).map((inc: any) => (
              <div key={inc.id} className="flex items-center justify-between rounded border border-border p-3 text-sm">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {syncRows && syncRows[0] && (
        <p className="text-xs text-muted-foreground">
          Sidst synkroniseret: {format(new Date(syncRows[0].synced_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
        </p>
      )}
    </div>
  );
};