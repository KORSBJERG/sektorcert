import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck, ShieldAlert, ShieldX, Info,
  Globe, Mail, Lock, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";

interface DnsFinding {
  category: string;
  title: string;
  status: "pass" | "warning" | "fail" | "info";
  details: string;
  record_value?: string;
}

interface DnsRecommendation {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
}

interface NIS2Relevance {
  category_id: string;
  relevance: string;
}

interface DnsAnalysisResult {
  report_source?: string;
  domain: string;
  email_security_score: number;
  email_security_max_score?: number;
  summary: string;
  findings: DnsFinding[];
  recommendations: DnsRecommendation[];
  nis2_relevance?: NIS2Relevance[];
}

interface DnsReportViewerProps {
  analysisResult: DnsAnalysisResult;
  fileName: string;
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/20", label: "OK" },
  warning: { icon: AlertTriangle, color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/20", label: "Advarsel" },
  fail: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Fejl" },
  info: { icon: Info, color: "text-chart-4", bg: "bg-chart-4/10", border: "border-chart-4/20", label: "Info" },
};

const PRIORITY_CONFIG = {
  high: { color: "text-destructive", bg: "bg-destructive/10", label: "Høj" },
  medium: { color: "text-chart-5", bg: "bg-chart-5/10", label: "Medium" },
  low: { color: "text-muted-foreground", bg: "bg-muted", label: "Lav" },
};

const NIS2_LABELS: Record<string, string> = {
  governance: "Governance & Risikostyring",
  incident: "Incident Håndtering",
  continuity: "Business Continuity",
  supply_chain: "Leverandørsikkerhed",
  network: "Netværks- & Informationssikkerhed",
  vulnerability: "Sårbarhedshåndtering",
  access: "Adgangskontrol",
  hr_awareness: "HR-sikkerhed & Awareness",
  crypto: "Kryptografi",
};

export function DnsReportViewer({ analysisResult, fileName }: DnsReportViewerProps) {
  const data = analysisResult;
  const maxScore = data.email_security_max_score || 10;
  const scorePercent = (data.email_security_score / maxScore) * 100;

  const passCount = data.findings.filter(f => f.status === "pass").length;
  const warnCount = data.findings.filter(f => f.status === "warning").length;
  const failCount = data.findings.filter(f => f.status === "fail").length;

  const scoreColor = scorePercent >= 80 ? "text-chart-2" : scorePercent >= 50 ? "text-chart-5" : "text-destructive";
  const scoreRingColor = scorePercent >= 80 ? "stroke-chart-2" : scorePercent >= 50 ? "stroke-chart-5" : "stroke-destructive";

  return (
    <div className="space-y-5">
      {/* Header with score */}
      <div className="flex items-start gap-6">
        {/* Score ring */}
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              className={scoreRingColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${scorePercent * 2.64} 264`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.email_security_score}</span>
            <span className="text-[10px] text-muted-foreground">/ {maxScore}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-semibold">{data.domain}</span>
            {data.report_source && (
              <Badge variant="outline" className="text-xs">{data.report_source}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{data.summary}</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-chart-2" />
              <span>{passCount} OK</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-chart-5" />
              <span>{warnCount} Advarsler</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span>{failCount} Fejl</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Findings grouped by category */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          DNS & Email Sikkerhedsfund
        </h4>
        <div className="space-y-2">
          {data.findings.map((finding, i) => {
            const cfg = STATUS_CONFIG[finding.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{finding.category}</Badge>
                    <span className="text-sm font-medium">{finding.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{finding.details}</p>
                  {finding.record_value && (
                    <code className="block mt-1.5 text-[11px] bg-background/80 rounded px-2 py-1 font-mono break-all border">
                      {finding.record_value}
                    </code>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-chart-5" />
              Anbefalinger
            </h4>
            <div className="space-y-2">
              {data.recommendations.map((rec, i) => {
                const pCfg = PRIORITY_CONFIG[rec.priority];
                return (
                  <div key={i} className={`p-3 rounded-lg border ${pCfg.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${pCfg.color}`}>{pCfg.label}</Badge>
                      <span className="text-sm font-medium">{rec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* NIS2 Relevance */}
      {data.nis2_relevance && data.nis2_relevance.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-chart-4" />
              NIS2 Relevans
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.nis2_relevance.map((rel, i) => (
                <div key={i} className="p-3 rounded-lg border bg-chart-4/5 border-chart-4/20">
                  <p className="text-xs font-semibold text-chart-4 mb-1">
                    {NIS2_LABELS[rel.category_id] || rel.category_id}
                  </p>
                  <p className="text-xs text-muted-foreground">{rel.relevance}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
