import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HuntressOrg { id: number | string; name: string }

export const HuntressImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [operationType, setOperationType] = useState<"IT" | "OT" | "BOTH">("IT");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: orgs, isLoading, error } = useQuery({
    queryKey: ["huntress-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("huntress-list-organizations");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.organizations as HuntressOrg[];
    },
    enabled: open,
    retry: false,
  });

  const { data: existing } = useQuery({
    queryKey: ["customers-huntress-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("huntress_organization_id");
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.huntress_organization_id).filter(Boolean).map(String));
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!orgs) return [];
    const q = search.trim().toLowerCase();
    return orgs.filter(o => !q || o.name.toLowerCase().includes(q) || String(o.id).includes(q));
  }, [orgs, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const importable = filtered.filter(o => !existing?.has(String(o.id))).map(o => String(o.id));
    const allSelected = importable.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) importable.forEach(id => next.delete(id));
      else importable.forEach(id => next.add(id));
      return next;
    });
  };

  const handleImport = async () => {
    if (!orgs || selected.size === 0) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");
      const rows = orgs
        .filter(o => selected.has(String(o.id)))
        .map(o => ({
          name: o.name,
          operation_type: operationType,
          huntress_organization_id: String(o.id),
          created_by_user_id: user.id,
        }));
      const { data: inserted, error } = await supabase
        .from("customers")
        .insert(rows)
        .select("id");
      if (error) throw error;
      toast({ title: "Importeret", description: `${rows.length} kunde(r) oprettet. Henter Huntress-data…` });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelected(new Set());
      setOpen(false);

      // Fire-and-forget auto-sync of Huntress data for the newly imported customers
      const ids = (inserted ?? []).map((r: any) => r.id);
      if (ids.length) {
        supabase.functions
          .invoke("huntress-sync-all", { body: { customerIds: ids } })
          .then(({ data, error: syncErr }) => {
            if (syncErr || data?.error) {
              toast({
                title: "Huntress-sync fejlede",
                description: syncErr?.message || data?.error,
                variant: "destructive",
              });
            } else {
              toast({
                title: "Huntress-data hentet",
                description: `${data?.synced ?? 0} af ${data?.total ?? ids.length} kunder synkroniseret.`,
              });
              qc.invalidateQueries({ queryKey: ["huntress-live"] });
            }
          });
      }
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Importer fra Huntress
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importer kunder fra Huntress</DialogTitle>
          <DialogDescription>
            Vælg de Huntress-organisationer du vil oprette som kunder. Allerede tilknyttede organisationer kan ikke vælges.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Henter organisationer…</div>
        )}
        {error && <p className="py-4 text-sm text-destructive">{(error as Error).message}</p>}

        {orgs && (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Søg navn eller ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={operationType} onValueChange={(v) => setOperationType(v as "IT" | "OT" | "BOTH")}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="OT">OT</SelectItem>
                  <SelectItem value="BOTH">Begge (IT og OT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filtered.length} organisation(er) — {selected.size} valgt</span>
              <Button variant="ghost" size="sm" onClick={toggleAll}>Vælg alle synlige</Button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filtered.map((o) => {
                const id = String(o.id);
                const already = existing?.has(id);
                const checked = selected.has(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 px-3 py-2 ${already ? "opacity-50" : "cursor-pointer hover:bg-accent/30"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={already}
                      onCheckedChange={() => toggle(id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-foreground">{o.name}</div>
                      <div className="text-xs text-muted-foreground">#{id}{already && " — allerede importeret"}</div>
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Ingen resultater</div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuller</Button>
          <Button onClick={handleImport} disabled={selected.size === 0 || saving}>
            {saving ? "Importerer…" : `Importér ${selected.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};