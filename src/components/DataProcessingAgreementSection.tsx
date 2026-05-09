import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSignature, Plus, Eye, Pencil, Copy, Trash2, Printer } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { getDefaultDPATemplate } from "@/lib/dpaTemplate";

interface Customer {
  id: string;
  name: string;
  address?: string | null;
}

interface DPA {
  id: string;
  customer_id: string;
  parent_agreement_id: string | null;
  version: number;
  status: string;
  title: string;
  controller_name: string;
  controller_address: string;
  controller_cvr: string;
  processor_name: string;
  processor_address: string | null;
  processor_cvr: string | null;
  content: string;
  effective_date: string | null;
  signed_at: string | null;
  signed_by: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  customer: Customer;
}

export const DataProcessingAgreementSection = ({ customer }: Props) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<DPA> | null>(null);
  const [viewing, setViewing] = useState<DPA | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: agreements, isLoading } = useQuery({
    queryKey: ["dpas", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_processing_agreements")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DPA[];
    },
  });

  const openNew = () => {
    setEditing({
      title: "Databehandleraftale",
      controller_name: "PEAKNET",
      controller_address: "Asgilhøjevej 59, 8420 Knebel",
      controller_cvr: "19236870",
      processor_name: customer.name,
      processor_address: customer.address ?? "",
      processor_cvr: "",
      content: getDefaultDPATemplate(customer.name),
      effective_date: new Date().toISOString().split("T")[0],
      status: "draft",
      additional_notes: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (dpa: DPA) => {
    setEditing({ ...dpa });
    setEditorOpen(true);
  };

  const openNewVersion = (dpa: DPA) => {
    setEditing({
      title: dpa.title,
      controller_name: dpa.controller_name,
      controller_address: dpa.controller_address,
      controller_cvr: dpa.controller_cvr,
      processor_name: dpa.processor_name,
      processor_address: dpa.processor_address ?? "",
      processor_cvr: dpa.processor_cvr ?? "",
      content: dpa.content,
      effective_date: new Date().toISOString().split("T")[0],
      status: "draft",
      additional_notes: dpa.additional_notes ?? "",
      parent_agreement_id: dpa.parent_agreement_id ?? dpa.id,
      version: (dpa.version ?? 1) + 1,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");

      if (editing.id) {
        const { error } = await supabase
          .from("data_processing_agreements")
          .update({
            title: editing.title,
            controller_name: editing.controller_name,
            controller_address: editing.controller_address,
            controller_cvr: editing.controller_cvr,
            processor_name: editing.processor_name,
            processor_address: editing.processor_address,
            processor_cvr: editing.processor_cvr,
            content: editing.content,
            effective_date: editing.effective_date || null,
            signed_at: editing.signed_at || null,
            signed_by: editing.signed_by || null,
            status: editing.status,
            additional_notes: editing.additional_notes,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("data_processing_agreements")
          .insert({
            customer_id: customer.id,
            created_by_user_id: user.id,
            title: editing.title!,
            controller_name: editing.controller_name!,
            controller_address: editing.controller_address!,
            controller_cvr: editing.controller_cvr!,
            processor_name: editing.processor_name!,
            processor_address: editing.processor_address,
            processor_cvr: editing.processor_cvr,
            content: editing.content!,
            effective_date: editing.effective_date || null,
            status: editing.status ?? "draft",
            additional_notes: editing.additional_notes,
            parent_agreement_id: editing.parent_agreement_id ?? null,
            version: editing.version ?? 1,
          });
        if (error) throw error;
      }

      toast({ title: "Gemt", description: "Databehandleraftalen er gemt." });
      queryClient.invalidateQueries({ queryKey: ["dpas", customer.id] });
      setEditorOpen(false);
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("data_processing_agreements")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Slettet", description: "Aftalen er slettet." });
      queryClient.invalidateQueries({ queryKey: ["dpas", customer.id] });
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Databehandleraftaler</h3>
        </div>
        <Button onClick={openNew} className="gap-2 bg-gradient-primary hover:opacity-90">
          <Plus className="h-4 w-4" />
          Ny aftale
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : agreements && agreements.length > 0 ? (
        <div className="space-y-2">
          {agreements.map((dpa) => (
            <div
              key={dpa.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent"
            >
              <div>
                <p className="font-medium text-foreground">
                  {dpa.title}
                  <Badge variant="secondary" className="ml-2">v{dpa.version}</Badge>
                  <Badge variant={dpa.status === "active" ? "default" : "outline"} className="ml-2">
                    {dpa.status}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {dpa.processor_name}
                  {dpa.effective_date && (
                    <> · Gyldig fra {format(new Date(dpa.effective_date), "d. MMM yyyy", { locale: da })}</>
                  )}
                  <> · Oprettet {format(new Date(dpa.created_at), "d. MMM yyyy", { locale: da })}</>
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setViewing(dpa); setViewerOpen(true); }} title="Se">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(dpa)} title="Rediger">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openNewVersion(dpa)} title="Ny version">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(dpa.id)} title="Slet">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">Ingen databehandleraftaler endnu.</p>
          <Button onClick={openNew} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Opret første aftale
          </Button>
        </div>
      )}

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Rediger aftale" : "Ny databehandleraftale"}</DialogTitle>
            <DialogDescription>
              {editing?.version && editing.version > 1 ? `Version ${editing.version}` : "Udfyld felterne nedenfor."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Titel</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold">Dataansvarlig</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Navn</Label>
                    <Input value={editing.controller_name ?? ""} onChange={(e) => setEditing({ ...editing, controller_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Adresse</Label>
                    <Input value={editing.controller_address ?? ""} onChange={(e) => setEditing({ ...editing, controller_address: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">CVR</Label>
                    <Input value={editing.controller_cvr ?? ""} onChange={(e) => setEditing({ ...editing, controller_cvr: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold">Databehandler (kunde)</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Navn</Label>
                    <Input value={editing.processor_name ?? ""} onChange={(e) => setEditing({ ...editing, processor_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Adresse</Label>
                    <Input value={editing.processor_address ?? ""} onChange={(e) => setEditing({ ...editing, processor_address: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">CVR</Label>
                    <Input value={editing.processor_cvr ?? ""} onChange={(e) => setEditing({ ...editing, processor_cvr: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <Label>Gyldig fra</Label>
                  <Input type="date" value={editing.effective_date ?? ""} onChange={(e) => setEditing({ ...editing, effective_date: e.target.value })} />
                </div>
                <div>
                  <Label>Underskrevet dato</Label>
                  <Input type="date" value={editing.signed_at ?? ""} onChange={(e) => setEditing({ ...editing, signed_at: e.target.value })} />
                </div>
                <div>
                  <Label>Underskrevet af</Label>
                  <Input value={editing.signed_by ?? ""} onChange={(e) => setEditing({ ...editing, signed_by: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.status ?? "draft"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="draft">Kladde</option>
                  <option value="active">Aktiv</option>
                  <option value="archived">Arkiveret</option>
                </select>
              </div>

              <div>
                <Label>Aftaletekst</Label>
                <Textarea
                  rows={20}
                  value={editing.content ?? ""}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>Noter</Label>
                <Textarea
                  rows={3}
                  value={editing.additional_notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, additional_notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Annuller</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary">
              {saving ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title} (v{viewing?.version})</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold">Dataansvarlig</p>
                  <p>{viewing.controller_name}</p>
                  <p className="text-muted-foreground">{viewing.controller_address}</p>
                  <p className="text-muted-foreground">CVR {viewing.controller_cvr}</p>
                </div>
                <div>
                  <p className="font-semibold">Databehandler</p>
                  <p>{viewing.processor_name}</p>
                  <p className="text-muted-foreground">{viewing.processor_address}</p>
                  {viewing.processor_cvr && <p className="text-muted-foreground">CVR {viewing.processor_cvr}</p>}
                </div>
              </div>
              {viewing.effective_date && (
                <p className="text-xs text-muted-foreground">
                  Gyldig fra {format(new Date(viewing.effective_date), "d. MMMM yyyy", { locale: da })}
                </p>
              )}
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-sans text-sm">
                {viewing.content}
              </pre>
              {viewing.additional_notes && (
                <div>
                  <p className="font-semibold">Noter</p>
                  <p className="text-muted-foreground">{viewing.additional_notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Udskriv
            </Button>
            <Button onClick={() => setViewerOpen(false)}>Luk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet aftale?</AlertDialogTitle>
            <AlertDialogDescription>
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};