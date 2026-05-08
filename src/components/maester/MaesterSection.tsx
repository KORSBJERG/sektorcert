import { useMemo, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  FlaskConical,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  ExternalLink,
  Sparkles,
  Search,
  CheckCircle,
  XCircle,
  FastForward,
  Archive,
  AlertTriangle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

const NIS2_TITLES: Record<string, string> = {
  governance: "Governance & Risikostyring",
  incident: "Incident Håndtering",
  continuity: "Forretningskontinuitet",
  supply_chain: "Forsyningskædesikkerhed",
  network: "Netværks- & Systemsikkerhed",
  vulnerability: "Sårbarhedshåndtering",
  access: "Adgangskontrol",
  hr_awareness: "HR & Awareness",
  crypto: "Kryptografi",
};

const SEVERITY_ORDER: Array<"critical" | "high" | "medium" | "low" | "info"> = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

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
/*  Report viewer                                                              */
/* -------------------------------------------------------------------------- */

function MaesterReportViewer({ run, open, onOpenChange }: { run: MaesterRun; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);

  // Generate signed URL when dialog opens
  useMemo(() => {
    if (!open || !run.result_html_path) {
      setHtmlUrl(null);
      return;
    }
    supabase.storage
      .from("maester-reports")
      .createSignedUrl(run.result_html_path, 600)
      .then(({ data }) => setHtmlUrl(data?.signedUrl ?? null));
  }, [open, run.result_html_path]);

  const tests = (run.result_json?.tests ?? []) as any[];
  const failed = tests.filter((t) => t.result === "Failed");
  const skipped = tests.filter((t) => t.result === "Skipped");

  async function downloadJson() {
    if (!run.json_path) return;
    const { data } = await supabase.storage
      .from("maester-reports")
      .createSignedUrl(run.json_path, 60, { download: true });
    if (data?.signedUrl) window.location.href = data.signedUrl;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Maester-rapport
            {run.tenant_name && <span className="text-sm font-normal text-muted-foreground">— {run.tenant_name}</span>}
          </DialogTitle>
          <DialogDescription>
            {run.executed_at
              ? format(new Date(run.executed_at), "d. MMMM yyyy HH:mm", { locale: da })
              : "Ukendt dato"}
            {run.maester_version && <> · Maester {run.maester_version}</>}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="overview">Oversigt</TabsTrigger>
            <TabsTrigger value="nis2">NIS2-mapping</TabsTrigger>
            <TabsTrigger value="tests">Alle tests</TabsTrigger>
            <TabsTrigger value="html" disabled={!run.result_html_path}>Original rapport</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Pass-procent</p>
                <p className={`text-2xl font-bold ${run.pass_percentage !== null && run.pass_percentage >= 90 ? "text-success" : run.pass_percentage !== null && run.pass_percentage >= 70 ? "text-warning" : "text-destructive"}`}>
                  {run.pass_percentage ?? 0}%
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Bestået</p>
                <p className="text-2xl font-bold text-success">{run.tests_passed}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Fejlet</p>
                <p className="text-2xl font-bold text-destructive">{run.tests_failed}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Skipped / NotRun</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {run.tests_skipped + run.tests_not_run}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Severity-fordeling (kun fejlede)</h4>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_ORDER.map((s) => {
                  const n = run.severity_counts?.[s] ?? 0;
                  if (!n) return null;
                  return (
                    <Badge key={s} className={severityColor(s)}>
                      {s}: {n}
                    </Badge>
                  );
                })}
                {SEVERITY_ORDER.every((s) => !(run.severity_counts?.[s] ?? 0)) && (
                  <p className="text-sm text-muted-foreground">Ingen fejlede tests 🎉</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Top fejlede tests</h4>
              <div className="space-y-2">
                {failed.slice(0, 15).map((t: any) => (
                  <div key={t.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{t.name}</p>
                        {t.block && <p className="text-xs text-muted-foreground">{t.block}</p>}
                        {t.errorRecord && (
                          <p className="mt-1 text-xs text-destructive line-clamp-2">{t.errorRecord}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={severityColor(t.severity)}>{t.severity}</Badge>
                        {t.helpUrl && (
                          <a href={t.helpUrl} target="_blank" rel="noreferrer" className="text-primary">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {failed.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ingen fejlede tests.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="nis2" className="flex-1 overflow-auto space-y-4 mt-4">
            {run.analysis_status === "pending" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> AI-analyse er i gang...
              </div>
            )}
            {run.analysis_status === "failed" && (
              <p className="text-destructive text-sm">AI-analysen fejlede.</p>
            )}
            {run.analysis_status === "completed" && run.nis2_mapping && (
              <>
                <div className="rounded-lg border bg-accent/30 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Sammenfatning</span>
                    {run.nis2_mapping.risk_level && (
                      <Badge variant="outline" className={severityColor(run.nis2_mapping.risk_level)}>
                        Risiko: {run.nis2_mapping.risk_level}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{run.nis2_mapping.summary}</p>
                </div>
                <div className="space-y-3">
                  {(run.nis2_mapping.nis2_relevance ?? []).map((c: any) => (
                    <div key={c.category_id} className="rounded-lg border p-3">
                      <p className="font-medium text-sm">
                        {NIS2_TITLES[c.category_id] ?? c.category_id}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{c.relevance}</p>
                      {c.affected_test_ids?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Berørte tests: {c.affected_test_ids.slice(0, 6).join(", ")}
                          {c.affected_test_ids.length > 6 && ` +${c.affected_test_ids.length - 6}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="tests" className="flex-1 overflow-auto mt-4">
            <ScrollArea className="h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Resultat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((t: any, idx: number) => (
                    <TableRow key={`${t.id}-${idx}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm">{t.name}</p>
                          {t.helpUrl && (
                            <a href={t.helpUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                              docs <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.block ?? "—"}</TableCell>
                      <TableCell><Badge className={severityColor(t.severity)}>{t.severity}</Badge></TableCell>
                      <TableCell>
                        <Badge
                          className={
                            t.result === "Passed"
                              ? "bg-success/15 text-success"
                              : t.result === "Failed"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {t.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="html" className="flex-1 overflow-hidden mt-4">
            {htmlUrl ? (
              <iframe
                src={htmlUrl}
                title="Maester report"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="h-[65vh] w-full rounded-md border bg-white"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Ingen HTML-rapport uploaded.</p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={downloadJson} className="gap-2">
            <Download className="h-4 w-4" /> Hent JSON
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
  const [viewerRun, setViewerRun] = useState<MaesterRun | null>(null);
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
    const { error } = await supabase.from("maester_runs" as any).delete().eq("id", id);
    if (error) {
      toast.error("Kunne ikke slette: " + error.message);
      return;
    }
    toast.success("Maester-rapport slettet");
    qc.invalidateQueries({ queryKey: ["maester-runs", customerId] });
    setDeleteId(null);
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
                        <Button variant="ghost" size="icon" onClick={() => setViewerRun(r)}>
                          <Eye className="h-4 w-4" />
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

      {viewerRun && (
        <MaesterReportViewer
          run={viewerRun}
          open={!!viewerRun}
          onOpenChange={(o) => !o && setViewerRun(null)}
        />
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
