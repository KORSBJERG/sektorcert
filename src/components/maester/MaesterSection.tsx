import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FlaskConical,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  Terminal,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const SEVERITY_ORDER: Array<"critical" | "high" | "medium" | "low" | "info"> = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

/* -------------------------------------------------------------------------- */
/*  Maester PowerShell commands                                                */
/* -------------------------------------------------------------------------- */

const MAESTER_COMMANDS: Array<{ title: string; description: string; cmd: string }> = [
  {
    title: "1. Installér Pester",
    description: "Test-frameworket Maester bygger ovenpå.",
    cmd: "Install-Module Pester -SkipPublisherCheck -Force -Scope CurrentUser",
  },
  {
    title: "2. Installér Maester",
    description: "Selve Maester-modulet fra PowerShell Gallery.",
    cmd: "Install-Module Maester -Scope CurrentUser",
  },
  {
    title: "3. Opret test-mappe",
    description: "Mappen hvor Maester-tests og resultater placeres.",
    cmd: "md maester-tests\ncd maester-tests",
  },
  {
    title: "4. Installér Maester-tests",
    description: "Henter de nyeste indbyggede tests.",
    cmd: "Install-MaesterTests",
  },
  {
    title: "5. Installér M365-moduler",
    description: "Nødvendige moduler for at kunne forbinde til Entra, Exchange og Teams.",
    cmd: "Install-Module Az.Accounts, ExchangeOnlineManagement, MicrosoftTeams -Scope CurrentUser",
  },
  {
    title: "6. Forbind til alle services",
    description: "Logger ind på alle relevante M365-services på én gang.",
    cmd: "Connect-Maester -Service All",
  },
  {
    title: "6b. (Alternativt) Standard-forbindelse",
    description: "Hvis du kun vil køre standard-tests.",
    cmd: "Connect-Maester",
  },
  {
    title: "7. Kør Maester",
    description: "Kører testene og genererer TestResults.json + .html som du uploader herover.",
    cmd: "Invoke-Maester",
  },
];

const ALL_COMMANDS_SCRIPT = MAESTER_COMMANDS.map((c) => `# ${c.title}\n${c.cmd}`).join("\n\n");

function CopyButton({ text, label = "Kopiér" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 h-8"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Kopieret til udklipsholderen");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Kunne ikke kopiere");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

function MaesterCommandsCard() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3 text-left">
              <Terminal className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">PowerShell-kommandoer for at køre Maester</p>
                <p className="text-xs text-muted-foreground">
                  Klik for at se og kopiere kommandoerne der skal afvikles lokalt.
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Kør kommandoerne i rækkefølge i en <strong>PowerShell 7</strong>-terminal på en
                administrators maskine.
              </p>
              <CopyButton text={ALL_COMMANDS_SCRIPT} label="Kopiér alle" />
            </div>
            <div className="space-y-2">
              {MAESTER_COMMANDS.map((c) => (
                <div
                  key={c.title}
                  className="rounded-md border bg-background/50 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <CopyButton text={c.cmd} />
                  </div>
                  <pre className="text-xs bg-muted/60 rounded px-3 py-2 overflow-x-auto font-mono">
                    {c.cmd}
                  </pre>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Når <code>Invoke-Maester</code> er kørt færdigt, ligger <code>TestResults.json</code>{" "}
              (og <code>TestResults.html</code>) i <code>maester-tests</code>. Upload dem herover.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface MaesterRun {
  id: string;
  customer_id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  executed_at: string | null;
  maester_version: string | null;
  pester_version: string | null;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  tests_not_run: number;
  pass_percentage: number | null;
  severity_counts: Record<string, number> | null;
  result_json: { tests?: any[] } | null;
  json_path: string | null;
  result_html_path: string | null;
  nis2_mapping: any;
  analysis_status: string;
  notes: string | null;
  created_at: string;
}

function passColor(pct: number | null) {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 90) return "bg-success/15 text-success border-success/30";
  if (pct >= 70) return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function severityColor(s: string) {
  switch (s) {
    case "critical":
      return "bg-destructive text-destructive-foreground";
    case "high":
      return "bg-destructive/80 text-destructive-foreground";
    case "medium":
      return "bg-warning/80 text-warning-foreground";
    case "low":
      return "bg-primary/20 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* -------------------------------------------------------------------------- */
/*  Upload dialog                                                              */
/* -------------------------------------------------------------------------- */

function MaesterUploadDialog({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "parsing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const jsonInput = useRef<HTMLInputElement>(null);
  const htmlInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function reset() {
    setJsonFile(null);
    setHtmlFile(null);
    setStatus("idle");
    setProgress(0);
    setError("");
    if (jsonInput.current) jsonInput.current.value = "";
    if (htmlInput.current) htmlInput.current.value = "";
  }

  async function handleSubmit() {
    if (!jsonFile) {
      toast.error("Vælg TestResults.json-filen");
      return;
    }
    if (jsonFile.size > 20 * 1024 * 1024 || (htmlFile && htmlFile.size > 20 * 1024 * 1024)) {
      toast.error("Filer må højst være 20 MB");
      return;
    }
    setStatus("uploading");
    setProgress(10);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Du er ikke logget ind");

      const stamp = Date.now();
      const jsonPath = `${user.id}/${customerId}/${stamp}_TestResults.json`;
      const { error: jErr } = await supabase.storage
        .from("maester-reports")
        .upload(jsonPath, jsonFile, { contentType: "application/json", upsert: false });
      if (jErr) throw jErr;
      setProgress(40);

      let htmlPath: string | null = null;
      if (htmlFile) {
        htmlPath = `${user.id}/${customerId}/${stamp}_TestResults.html`;
        const { error: hErr } = await supabase.storage
          .from("maester-reports")
          .upload(htmlPath, htmlFile, { contentType: "text/html", upsert: false });
        if (hErr) throw hErr;
      }
      setProgress(70);
      setStatus("parsing");

      const { data, error: fnErr } = await supabase.functions.invoke("parse-maester-upload", {
        body: { customer_id: customerId, json_storage_path: jsonPath, html_storage_path: htmlPath },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);

      setProgress(100);
      setStatus("done");
      toast.success("Maester-rapport uploaded — AI-analyse startet");
      qc.invalidateQueries({ queryKey: ["maester-runs", customerId] });
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setError(e?.message ?? "Ukendt fejl");
      toast.error("Upload fejlede");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-primary hover:opacity-90">
          <Upload className="h-4 w-4" />
          Upload Maester-rapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Maester-rapport</DialogTitle>
          <DialogDescription>
            Upload den <code>TestResults.json</code>-fil som <code>Invoke-Maester</code> har
            genereret. HTML-rapporten er valgfri men giver pænere visning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">TestResults.json *</p>
                  <p className="text-xs text-muted-foreground">
                    {jsonFile ? jsonFile.name : "Vælg fil (påkrævet)"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary underline">Vælg</span>
              <input
                ref={jsonInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
                disabled={status !== "idle" && status !== "error"}
              />
            </label>
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">TestResults.html</p>
                  <p className="text-xs text-muted-foreground">
                    {htmlFile ? htmlFile.name : "Valgfri — den pæne rapport"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary underline">Vælg</span>
              <input
                ref={htmlInput}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
                disabled={status !== "idle" && status !== "error"}
              />
            </label>
          </div>

          {(status === "uploading" || status === "parsing") && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {status === "parsing" ? "Parser og starter AI-analyse..." : `${progress}% uploadet`}
              </p>
            </div>
          )}
          {status === "done" && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Færdig
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={status === "uploading" || status === "parsing"}>
            Annuller
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!jsonFile || status === "uploading" || status === "parsing"}
            className="gap-2"
          >
            {(status === "uploading" || status === "parsing") && <Loader2 className="h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* -------------------------------------------------------------------------- */
/*  Dashboard card (KPI + sparkline)                                           */
/* -------------------------------------------------------------------------- */

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220;
  const h = 36;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9">
      <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
    </svg>
  );
}

function MaesterDashboardCard({ runs }: { runs: MaesterRun[] }) {
  if (!runs.length) return null;
  const latest = runs[0];
  const trend = [...runs].reverse().slice(-6).map((r) => r.pass_percentage ?? 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Seneste pass-procent</p>
        <p
          className={`text-3xl font-bold ${
            (latest.pass_percentage ?? 0) >= 90
              ? "text-success"
              : (latest.pass_percentage ?? 0) >= 70
              ? "text-warning"
              : "text-destructive"
          }`}
        >
          {latest.pass_percentage ?? 0}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {latest.tests_passed} af {latest.tests_passed + latest.tests_failed} tests bestået
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Fejlede tests</p>
        <p className="text-3xl font-bold text-destructive">{latest.tests_failed}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {SEVERITY_ORDER.map((s) => {
            const n = latest.severity_counts?.[s] ?? 0;
            if (!n) return null;
            return <Badge key={s} className={severityColor(s) + " text-xs"}>{s}: {n}</Badge>;
          })}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">Trend (seneste {trend.length} runs)</p>
        <Sparkline values={trend} />
        <p className="text-xs text-muted-foreground mt-1">
          Senest: {latest.executed_at ? format(new Date(latest.executed_at), "d. MMM yyyy", { locale: da }) : "—"}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section root                                                               */
/* -------------------------------------------------------------------------- */

export function MaesterSection({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["maester-runs", customerId],
    queryFn: async (): Promise<MaesterRun[]> => {
      const { data, error } = await supabase
        .from("maester_runs" as any)
        .select("*")
        .eq("customer_id", customerId)
        .order("executed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as MaesterRun[];
    },
    refetchInterval: (q) => {
      const data = q.state.data as MaesterRun[] | undefined;
      return data?.some((r) => r.analysis_status === "pending") ? 4000 : false;
    },
  });

  async function handleDelete(id: string) {
    // Find paths first so we can clean up storage
    const run = runs.find((r) => r.id === id);
    const paths = [run?.json_path, run?.result_html_path].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from("maester-reports")
        .remove(paths);
      if (storageErr) {
        console.warn("Storage cleanup failed:", storageErr.message);
      }
    }
    const { error } = await supabase.from("maester_runs" as any).delete().eq("id", id);
    if (error) {
      toast.error("Kunne ikke slette: " + error.message);
      return;
    }
    toast.success("Maester-rapport slettet");
    qc.invalidateQueries({ queryKey: ["maester-runs", customerId] });
    setDeleteId(null);
  }

  async function openOriginal(r: MaesterRun) {
    const path = r.result_html_path ?? r.json_path;
    if (!path) {
      toast.error("Ingen fil uploaded for dette run");
      return;
    }
    const isHtml = !!r.result_html_path;
    try {
      const { data, error } = await supabase.storage
        .from("maester-reports")
        .download(path);
      if (error || !data) throw error ?? new Error("Kunne ikke hente filen");
      const blob = new Blob([await data.arrayBuffer()], {
        type: isHtml ? "text/html;charset=utf-8" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Revoke later so the new tab has time to load
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error("Kunne ikke åbne filen: " + (e?.message ?? "ukendt fejl"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Maester – M365 sikkerhedstest</h3>
        </div>
        <MaesterUploadDialog customerId={customerId} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Indlæser...
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">Ingen Maester-rapporter uploaded endnu.</p>
          <p className="text-xs mt-1">
            Kør <code>Invoke-Maester</code> lokalt og upload <code>TestResults.json</code>.
          </p>
        </div>
      ) : (
        <>
          <MaesterDashboardCard runs={runs} />

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>Fejlet</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>AI</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {r.executed_at
                        ? format(new Date(r.executed_at), "d. MMM yyyy HH:mm", { locale: da })
                        : format(new Date(r.created_at), "d. MMM yyyy", { locale: da })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.tenant_name ?? r.tenant_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={passColor(r.pass_percentage)}>
                        {r.pass_percentage ?? 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.tests_failed} / {r.tests_total}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {SEVERITY_ORDER.map((s) => {
                          const n = r.severity_counts?.[s] ?? 0;
                          if (!n) return null;
                          return (
                            <Badge key={s} className={severityColor(s) + " text-xs"}>
                              {s[0].toUpperCase()}:{n}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.analysis_status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {r.analysis_status === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {r.analysis_status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openOriginal(r)}
                          title={r.result_html_path ? "Åbn HTML-rapport" : "Åbn JSON-rapport"}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet Maester-rapport?</AlertDialogTitle>
            <AlertDialogDescription>
              Rapporten og dens AI-analyse fjernes permanent. De uploadede filer i storage forbliver men er utilgængelige fra UI'et.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
