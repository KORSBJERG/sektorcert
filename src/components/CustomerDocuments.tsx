import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Upload, FileText, Download, Trash2, FolderOpen, ShieldCheck, FileSignature, ClipboardList, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Props {
  customerId: string;
  canUpload?: boolean;
}

const CATEGORIES = [
  { value: "policy", label: "Politikker & Procedurer", icon: ShieldCheck },
  { value: "report", label: "Sikkerhedsrapporter", icon: FileText },
  { value: "audit", label: "Audits & Reviews", icon: ClipboardList },
  { value: "contract", label: "Aftaler & Kontrakter", icon: FileSignature },
  { value: "other", label: "Øvrige dokumenter", icon: Folder },
] as const;

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

export const CustomerDocuments = ({ customerId, canUpload = true }: Props) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [file, setFile] = useState<File | null>(null);

  const { data: documents } = useQuery({
    queryKey: ["customer-documents", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_documents")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reset = () => {
    setTitle(""); setDescription(""); setCategory("other"); setFile(null);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Manglende felter", description: "Titel og fil er påkrævet", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ikke logget ind");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${customerId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("customer-documents")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("customer_documents").insert({
        customer_id: customerId,
        category,
        title: title.trim(),
        description: description.trim() || null,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by_user_id: user.id,
      });
      if (insErr) throw insErr;

      toast({ title: "Dokument uploadet" });
      qc.invalidateQueries({ queryKey: ["customer-documents", customerId] });
      setOpen(false);
      reset();
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("customer-documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Fejl", description: "Kunne ikke hente fil", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Slet dette dokument?")) return;
    try {
      await supabase.storage.from("customer-documents").remove([path]);
      const { error } = await supabase.from("customer_documents").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Dokument slettet" });
      qc.invalidateQueries({ queryKey: ["customer-documents", customerId] });
    } catch (e: any) {
      toast({ title: "Fejl", description: e.message, variant: "destructive" });
    }
  };

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: documents?.filter((d) => d.category === c.value) ?? [],
  }));

  const total = documents?.length ?? 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Dokumenter & Rapporter</h3>
          <span className="text-sm text-muted-foreground">({total})</span>
        </div>
        {canUpload && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-gradient-primary hover:opacity-90">
                <Upload className="h-4 w-4" /> Upload dokument
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload nyt dokument</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="doc-title">Titel *</Label>
                  <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="fx Backup-politik 2026" />
                </div>
                <div>
                  <Label htmlFor="doc-cat">Kategori</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="doc-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="doc-desc">Beskrivelse</Label>
                  <Textarea id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label htmlFor="doc-file">Fil *</Label>
                  <Input id="doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file && <p className="mt-1 text-xs text-muted-foreground">{file.name} • {formatBytes(file.size)}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Annuller</Button>
                <Button onClick={handleUpload} disabled={uploading} className="bg-gradient-primary hover:opacity-90">
                  {uploading ? "Uploader..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <FolderOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ingen dokumenter endnu</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={grouped.filter((g) => g.items.length).map((g) => g.value)} className="space-y-2">
          {grouped.map((group) => {
            const Icon = group.icon;
            if (group.items.length === 0) return null;
            return (
              <AccordionItem key={group.value} value={group.value} className="rounded-lg border border-border px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{group.label}</span>
                    <span className="text-xs text-muted-foreground">({group.items.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {group.items.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{doc.title}</p>
                            {doc.description && (
                              <p className="truncate text-xs text-muted-foreground">{doc.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {doc.file_name} • {formatBytes(doc.file_size)} • {format(new Date(doc.created_at), "d. MMM yyyy", { locale: da })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(doc.id, doc.file_path, doc.file_name)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          {canUpload && (
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(doc.id, doc.file_path)} title="Slet">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};