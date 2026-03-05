import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Activity, Bug, HardDrive, Eye as EyeIcon, Lock,
  AlertTriangle, CheckCircle2, Info, Crosshair, Server,
} from "lucide-react";

interface HuntressSummary {
  entities_protected: number;
  total_events_analyzed: number;
  total_events_label?: string;
  signals_detected: number;
  signals_investigated: number;
  incidents_reported: number;
  overall_assessment?: string;
}

interface HuntressSection {
  title: string;
  category: string;
  events_analyzed?: number;
  events_label?: string;
  signals_detected?: number;
  signals_investigated?: number;
  incidents_reported?: number;
  status: "clean" | "warning" | "critical";
  details: string;
}

interface NIS2Relevance {
  category_id: string;
  relevance: string;
}

interface HuntressAnalysis {
  report_period: string;
  organization_name: string;
  summary: HuntressSummary;
  sections: HuntressSection[];
  global_threats?: string[];
  analyst_notes?: string;
  threat_spotlight?: string;
  risk_assessment: string;
  nis2_relevance?: NIS2Relevance[];
}

interface HuntressReportViewerProps {
  analysisResult: HuntressAnalysis;
  fileName: string;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  persistent_footholds: <Bug className="h-4 w-4" />,
  ransomware_canaries: <Crosshair className="h-4 w-4" />,
  process_insights: <Activity className="h-4 w-4" />,
  managed_itdr: <Lock className="h-4 w-4" />,
  managed_siem: <Server className="h-4 w-4" />,
  incident_summary: <Shield className="h-4 w-4" />,
  other: <Info className="h-4 w-4" />,
};

const STATUS_STYLES = {
  clean: { icon: CheckCircle2, color: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2/20", label: "Ingen hændelser" },
  warning: { icon: AlertTriangle, color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/20", label: "Undersøgt" },
  critical: { icon: ShieldX, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Hændelser rapporteret" },
};

const RISK_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "text-chart-2", bg: "bg-chart-2/10", label: "Lav risiko" },
  medium: { color: "text-chart-5", bg: "bg-chart-5/10", label: "Medium risiko" },
  high: { color: "text-destructive", bg: "bg-destructive/10", label: "Høj risiko" },
  critical: { color: "text-destructive", bg: "bg-destructive/10", label: "Kritisk risiko" },
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function HuntressReportViewer({ analysisResult: data, fileName }: HuntressReportViewerProps) {
  const riskStyle = RISK_STYLES[data.risk_assessment] || RISK_STYLES.medium;
  const cleanSections = data.sections.filter(s => s.status === "clean").length;
  const totalSections = data.sections.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-orange-500/10 shrink-0">
          <Shield className="h-7 w-7 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-lg">{data.organization_name}</h3>
            <Badge variant="outline" className="text-xs">{data.report_period}</Badge>
            <Badge className={`${riskStyle.bg} ${riskStyle.color} border-0 text-xs`}>{riskStyle.label}</Badge>
          </div>
          {data.summary.overall_assessment && (
            <p className="text-sm text-muted-foreground">{data.summary.overall_assessment}</p>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Entiteter", value: data.summary.entities_protected, icon: HardDrive },
          { label: "Events analyseret", value: data.summary.total_events_label || formatNumber(data.summary.total_events_analyzed), icon: Activity },
          { label: "Signaler", value: data.summary.signals_detected, icon: EyeIcon },
          { label: "Undersøgt", value: data.summary.signals_investigated, icon: AlertTriangle },
          { label: "Hændelser", value: data.summary.incidents_reported, icon: ShieldAlert },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={i} className="p-3 rounded-lg bg-card border text-center">
            <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Section health bar */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground shrink-0">{cleanSections}/{totalSections} sektioner uden hændelser</p>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
          {data.sections.map((s, i) => (
            <div
              key={i}
              className={`h-full ${
                s.status === "clean" ? "bg-chart-2" : s.status === "warning" ? "bg-chart-5" : "bg-destructive"
              }`}
              style={{ flex: 1 }}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-2">
        {data.sections.map((section, i) => {
          const sCfg = STATUS_STYLES[section.status];
          const SIcon = sCfg.icon;
          return (
            <div key={i} className={`p-4 rounded-lg border ${sCfg.bg} ${sCfg.border}`}>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-background/60 text-muted-foreground mt-0.5">
                  {SECTION_ICONS[section.category] || SECTION_ICONS.other}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{section.title}</span>
                    <SIcon className={`h-3.5 w-3.5 ${sCfg.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{section.details}</p>
                  {(section.events_analyzed || section.signals_detected !== undefined) && (
                    <div className="flex gap-4 text-[11px]">
                      {section.events_analyzed !== undefined && (
                        <span><strong>{section.events_label || formatNumber(section.events_analyzed)}</strong> events</span>
                      )}
                      {section.signals_detected !== undefined && (
                        <span><strong>{section.signals_detected}</strong> signaler</span>
                      )}
                      {section.incidents_reported !== undefined && (
                        <span><strong>{section.incidents_reported}</strong> hændelser</span>
                      )}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${sCfg.color}`}>{sCfg.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Threats */}
      {data.global_threats && data.global_threats.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-chart-5" />
              Globale Trusler
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.global_threats.map((threat, i) => (
                <Badge key={i} variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/20 text-xs">
                  {threat}
                </Badge>
              ))}
            </div>
            {data.analyst_notes && (
              <p className="text-xs text-muted-foreground mt-2">{data.analyst_notes}</p>
            )}
          </div>
        </>
      )}

      {/* Threat Spotlight */}
      {data.threat_spotlight && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              Threat Spotlight
            </h4>
            <p className="text-xs text-muted-foreground">{data.threat_spotlight}</p>
          </div>
        </>
      )}

      {/* NIS2 Relevance */}
      {data.nis2_relevance && data.nis2_relevance.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
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
