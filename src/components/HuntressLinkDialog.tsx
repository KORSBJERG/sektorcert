import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  currentOrgId: string | null;
}

export const HuntressLinkDialog = ({ customerId, currentOrgId }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(currentOrgId ?? "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["huntress-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("huntress-list-organizations");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.organizations as Array<{ id: number | string; name: string }>;
    },
    enabled: open,
    retry: false,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ huntress_organization_id: selected || null })
        .eq("id", customerId);
      if (error) throw error;
      toast({ title: "Forbundet", description: "Kunde knyttet til Huntress-organisation." });
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="h-4 w-4" />
          {currentOrgId ? "Skift Huntress-org" : "Forbind Huntress"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forbind til Huntress-organisation</DialogTitle>
          <DialogDescription>Vælg den Huntress-organisation, som kunden skal knyttes til.</DialogDescription>
        </DialogHeader>
        {isLoading && <div className="flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Henter organisationer…</div>}
        {error && <p className="py-4 text-destructive text-sm">{(error as Error).message}</p>}
        {data && (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Vælg organisation" /></SelectTrigger>
            <SelectContent>
              {data.map((o) => (
                <SelectItem key={String(o.id)} value={String(o.id)}>{o.name} (#{o.id})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuller</Button>
          <Button onClick={handleSave} disabled={!selected || saving}>
            {saving ? "Gemmer…" : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};