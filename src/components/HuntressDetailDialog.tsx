import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import DOMPurify from "dompurify";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  kind: "agent" | "incident";
  id: string | number;
  title: string;
}

const fmtDate = (v: any) => {
  if (!v) return "—";
  try { return format(new Date(v), "d. MMM yyyy 'kl.' HH:mm", { locale: da }); } catch { return String(v); }
};

const Row = ({ label, value }: { label: string; value: any }) => {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right break-all">{String(value)}</span>
    </div>
  );
};

export const HuntressDetailDialog = ({ open, onOpenChange, customerId, kind, id, title }: Props) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["huntress-detail", customerId, kind, id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("huntress-detail", {
        body: { customerId, kind, id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
  });

  const agent = data?.agent;
  const incident = data?.incident;
  const remediations: any[] = Array.isArray(data?.remediations) ? data.remediations : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "agent" ? "Agent-detaljer fra Huntress" : "Hændelsesrapport fra Huntress"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Henter detaljer…
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive py-4">{(error as Error).message}</p>
          )}

          {agent && (
            <div className="space-y-1">
              <Row label="Hostname" value={agent.hostname} />
              <Row label="Platform" value={agent.platform ?? agent.os} />
              <Row label="OS Version" value={agent.os_version ?? agent.version_info} />
              <Row label="Agent version" value={agent.version} />
              <Row label="Status" value={agent.status} />
              <Row label="Isolation" value={agent.isolation_state} />
              <Row label="Domæne" value={agent.domain_name} />
              <Row label="Arbejdsgruppe" value={agent.workgroup} />
              <Row label="IP (intern)" value={agent.ipv4_address ?? agent.local_ip} />
              <Row label="IP (ekstern)" value={agent.external_ip} />
              <Row label="MAC" value={agent.mac_addresses?.join?.(", ") ?? agent.mac_address} />
              <Row label="Serienummer" value={agent.serial_number} />
              <Row label="Producent" value={agent.manufacturer} />
              <Row label="Model" value={agent.model} />
              <Row label="Defender status" value={agent.defender_status ?? agent.defender_policy_status} />
              <Row label="EDR aktiveret" value={agent.edr_enabled} />
              <Row label="ITDR-tilknyttet" value={agent.itdr_enrolled} />
              <Row label="Sidst online" value={fmtDate(agent.last_callback_at)} />
              <Row label="Sidst survey" value={fmtDate(agent.last_survey_at)} />
              <Row label="Tilføjet" value={fmtDate(agent.created_at)} />
              <Row label="Tags" value={Array.isArray(agent.tags) ? agent.tags.join(", ") : agent.tags} />
            </div>
          )}

          {incident && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {incident.severity && <Badge variant="outline">Severity: {incident.severity}</Badge>}
                {incident.status && <Badge variant="outline">Status: {incident.status}</Badge>}
                {incident.platform && <Badge variant="outline">{incident.platform}</Badge>}
              </div>
              <div className="space-y-1">
                <Row label="Indsendt" value={fmtDate(incident.sent_at ?? incident.created_at)} />
                <Row label="Opdateret" value={fmtDate(incident.updated_at)} />
                <Row label="Lukket" value={fmtDate(incident.closed_at)} />
                <Row label="Agent / host" value={incident.agent?.hostname ?? incident.hostname} />
                <Row label="Bruger" value={incident.username ?? incident.user} />
                <Row label="Type" value={incident.indicator_types?.join?.(", ") ?? incident.indicator_type ?? incident.subject} />
              </div>
              {incident.body && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Beskrivelse</p>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm rounded border border-border p-3 bg-muted/20"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(incident.body)) }}
                  />
                </div>
              )}
              {Array.isArray(incident.indicators) && incident.indicators.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Indikatorer ({incident.indicators.length})</p>
                  <pre className="text-xs rounded border border-border p-3 bg-muted/20 overflow-x-auto">
                    {JSON.stringify(incident.indicators, null, 2)}
                  </pre>
                </div>
              )}
              {remediations.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Remediations ({remediations.length})</p>
                  <div className="space-y-2">
                    {remediations.map((r: any) => (
                      <div key={r.id} className="rounded border border-border p-3 text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{r.action ?? r.type ?? `Remediation #${r.id}`}</span>
                          {r.status && <Badge variant="outline">{r.status}</Badge>}
                        </div>
                        {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};