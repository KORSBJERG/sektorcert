import { useMemo } from "react";
import {
  ShieldAlert, Server, AlertTriangle, KeyRound, Clock, TrendingUp,
  WifiOff, ShieldOff, Activity, UserX, UserCheck,
} from "lucide-react";
import { differenceInDays, differenceInHours } from "date-fns";

interface Props {
  agents: any[];
  incidents: any[];
  identities: any[];
  billing?: any[];
}

const truthy = (v: any) =>
  v === true || v === 1 ||
  (typeof v === "string" && ["true", "yes", "enabled", "enforced"].includes(v.toLowerCase()));

const daysAgo = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return differenceInDays(new Date(), d);
};

const sev = (s: any) => String(s ?? "").toLowerCase();

const Stat = ({
  icon: Icon, label, value, hint, tone = "default",
}: {
  icon: any; label: string; value: React.ReactNode; hint?: string;
  tone?: "default" | "ok" | "warn" | "bad";
}) => {
  const toneCls =
    tone === "ok" ? "text-green-600" :
    tone === "warn" ? "text-yellow-600" :
    tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div>
    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {title}
    </h4>
    {children}
  </div>
);

const Bar = ({ label, value, total, tone }: { label: string; value: number; total: number; tone: "ok" | "warn" | "bad" | "muted" }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const bar =
    tone === "ok" ? "bg-green-600" :
    tone === "warn" ? "bg-yellow-500" :
    tone === "bad" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}{total > 0 ? ` / ${total}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${bar} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

export const HuntressInsights = ({ agents, incidents, identities }: Props) => {
  // ------ Endpoint health ------
  const endpoint = useMemo(() => {
    const total = agents.length;
    const offline7 = agents.filter(a => (daysAgo(a?.last_callback_at) ?? 999) > 7).length;
    const offline30 = agents.filter(a => (daysAgo(a?.last_callback_at) ?? 999) > 30).length;
    const isolated = agents.filter(a => a?.isolation_state && String(a.isolation_state).toLowerCase() !== "normal").length;

    const versions = agents.map(a => a?.version).filter(Boolean) as string[];
    const versionCount = new Map<string, number>();
    versions.forEach(v => versionCount.set(v, (versionCount.get(v) ?? 0) + 1));
    const newest = [...versionCount.entries()].sort((a,b) => b[0].localeCompare(a[0], undefined, { numeric: true }))[0]?.[0];
    const onLatest = versions.filter(v => v === newest).length;
    const skew = total - onLatest;

    const defenderUnhealthy = agents.filter(a => {
      const s = String(a?.defender_status ?? "").toLowerCase();
      return s && s !== "protected" && s !== "healthy";
    }).length;
    const policyNonCompliant = agents.filter(a =>
      String(a?.defender_policy_status ?? "").toLowerCase() === "non compliant"
    ).length;

    const platforms = new Map<string, number>();
    agents.forEach(a => {
      const p = String(a?.platform ?? "unknown").toLowerCase();
      platforms.set(p, (platforms.get(p) ?? 0) + 1);
    });

    return { total, offline7, offline30, isolated, skew, newest, onLatest, defenderUnhealthy, policyNonCompliant, platforms };
  }, [agents]);

  // ------ Incidents ------
  const incs = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter(i => !["closed", "resolved"].includes(String(i?.status ?? "").toLowerCase()));
    const closed = incidents.filter(i => ["closed", "resolved"].includes(String(i?.status ?? "").toLowerCase()) && i?.closed_at && i?.sent_at);

    const sevDist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, other: 0 };
    incidents.forEach(i => {
      const s = sev(i?.severity);
      if (s in sevDist) sevDist[s]++;
      else sevDist.other++;
    });

    const ttrHours = closed
      .map(i => differenceInHours(new Date(i.closed_at), new Date(i.sent_at)))
      .filter(n => Number.isFinite(n) && n >= 0)
      .sort((a,b) => a-b);
    const median = ttrHours.length ? ttrHours[Math.floor(ttrHours.length / 2)] : null;

    const last30 = incidents.filter(i => (daysAgo(i?.sent_at) ?? 999) <= 30).length;

    return { total, open: open.length, sevDist, median, last30, openSev: {
      critical: open.filter(i => sev(i?.severity) === "critical").length,
      high: open.filter(i => sev(i?.severity) === "high").length,
    }};
  }, [incidents]);

  // ------ Identity risks ------
  const ids = useMemo(() => {
    const enabled = identities.filter(i => truthy(i?.enabled));
    const total = enabled.length;
    const mfaOn = enabled.filter(i => truthy(i?.mfa_enabled)).length;
    const mfaOff = total - mfaOn;
    const admins = enabled.filter(i => truthy(i?.is_admin ?? i?.admin));
    const adminsNoMfa = admins.filter(i => !truthy(i?.mfa_enabled)).length;
    const external = enabled.filter(i => truthy(i?.external)).length;
    const stale = enabled.filter(i => {
      const d = daysAgo(i?.password_last_changed_at ?? i?.updated_at);
      return d !== null && d > 365;
    }).length;
    const risky = enabled.filter(i => {
      const r = String(i?.risk_level ?? "").toLowerCase();
      return r === "high" || r === "medium";
    }).length;
    return { total, mfaOn, mfaOff, admins: admins.length, adminsNoMfa, external, stale, risky };
  }, [identities]);

  if (agents.length === 0 && incidents.length === 0 && identities.length === 0) return null;

  const platformList = [...endpoint.platforms.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* ENDPOINT HEALTH */}
      {endpoint.total > 0 && (
        <Section title="Endpoint sundhed" icon={Server}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat
              icon={WifiOff}
              label="Offline > 7 dage"
              value={endpoint.offline7}
              hint={endpoint.offline30 > 0 ? `${endpoint.offline30} over 30 dage` : "Alle nyligt online"}
              tone={endpoint.offline7 === 0 ? "ok" : endpoint.offline7 < 3 ? "warn" : "bad"}
            />
            <Stat
              icon={ShieldOff}
              label="Isolerede agenter"
              value={endpoint.isolated}
              hint="Aktivt isoleret af Huntress"
              tone={endpoint.isolated === 0 ? "ok" : "bad"}
            />
            <Stat
              icon={TrendingUp}
              label="Versions-skew"
              value={endpoint.skew}
              hint={endpoint.newest ? `Nyeste: v${endpoint.newest}` : undefined}
              tone={endpoint.skew === 0 ? "ok" : endpoint.skew < 5 ? "warn" : "bad"}
            />
            <Stat
              icon={ShieldAlert}
              label="Defender ikke OK"
              value={endpoint.defenderUnhealthy}
              hint={endpoint.policyNonCompliant > 0 ? `${endpoint.policyNonCompliant} non-compliant policy` : undefined}
              tone={endpoint.defenderUnhealthy === 0 ? "ok" : "warn"}
            />
          </div>
          {platformList.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Platform-fordeling</p>
              <div className="space-y-2">
                {platformList.map(([p, n]) => (
                  <Bar key={p} label={p} value={n} total={endpoint.total} tone="muted" />
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* INCIDENTS */}
      {incs.total > 0 && (
        <Section title="Hændelser & respons" icon={AlertTriangle}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat
              icon={AlertTriangle}
              label="Åbne (kritisk/høj)"
              value={incs.openSev.critical + incs.openSev.high}
              hint={`${incs.open} åbne i alt`}
              tone={(incs.openSev.critical + incs.openSev.high) === 0 ? "ok" : "bad"}
            />
            <Stat
              icon={Clock}
              label="Median MTTR"
              value={incs.median !== null ? `${incs.median}t` : "—"}
              hint="Tid til lukket"
              tone={incs.median === null ? "default" : incs.median <= 24 ? "ok" : incs.median <= 72 ? "warn" : "bad"}
            />
            <Stat
              icon={Activity}
              label="Seneste 30 dage"
              value={incs.last30}
              hint={`${incs.total} samlet`}
            />
            <Stat
              icon={ShieldAlert}
              label="Critical i alt"
              value={incs.sevDist.critical}
              tone={incs.sevDist.critical === 0 ? "ok" : "bad"}
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Severity-fordeling</p>
            <div className="space-y-2">
              <Bar label="Critical" value={incs.sevDist.critical} total={incs.total} tone="bad" />
              <Bar label="High"     value={incs.sevDist.high}     total={incs.total} tone="bad" />
              <Bar label="Medium"   value={incs.sevDist.medium}   total={incs.total} tone="warn" />
              <Bar label="Low"      value={incs.sevDist.low}      total={incs.total} tone="ok" />
              {incs.sevDist.other > 0 && <Bar label="Andet" value={incs.sevDist.other} total={incs.total} tone="muted" />}
            </div>
          </div>
        </Section>
      )}

      {/* IDENTITIES */}
      {ids.total > 0 && (
        <Section title="Identitetsrisici" icon={KeyRound}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat
              icon={UserX}
              label="Admins uden MFA"
              value={ids.adminsNoMfa}
              hint={`${ids.admins} admins i alt`}
              tone={ids.adminsNoMfa === 0 ? "ok" : "bad"}
            />
            <Stat
              icon={KeyRound}
              label="Brugere uden MFA"
              value={ids.mfaOff}
              hint={`${ids.mfaOn} af ${ids.total} har MFA`}
              tone={ids.mfaOff === 0 ? "ok" : ids.mfaOff < 5 ? "warn" : "bad"}
            />
            <Stat
              icon={UserCheck}
              label="Eksterne / gæste"
              value={ids.external}
              hint="Konti markeret eksterne"
            />
            <Stat
              icon={Clock}
              label="Password > 1 år"
              value={ids.stale}
              tone={ids.stale === 0 ? "ok" : "warn"}
            />
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <Bar label="MFA aktiveret" value={ids.mfaOn} total={ids.total} tone={ids.mfaOff === 0 ? "ok" : "warn"} />
            {ids.risky > 0 && (
              <p className="text-xs text-destructive">
                {ids.risky} identitet(er) markeret med risiko-niveau medium/høj af Huntress.
              </p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
};
