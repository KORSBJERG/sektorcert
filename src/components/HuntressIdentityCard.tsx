import { ShieldCheck, Users, KeyRound, AlertTriangle } from "lucide-react";

interface Props {
  organization: any;
  customerOperationType?: string | null;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * Aggregeret ITDR/MFA oversigt pr. kunde.
 * Huntress' offentlige API eksponerer ikke pr-bruger detaljer — kun aggregerede tællere.
 * Vi viser derfor en sammenfatning pr. brugertype (alle M365-brugere, fakturerbare identiteter,
 * SAT-deltagere) og en estimeret MFA/ITDR-dækning.
 */
export const HuntressIdentityCard = ({ organization, customerOperationType }: Props) => {
  if (!organization) return null;

  const m365Users = num(organization.microsoft_365_users_count);
  const billable = num(organization.billable_identity_count);
  const sat = num(organization.sat_learner_count);
  const itdrEnrolled = num(
    organization.itdr_identity_count ??
      organization.itdr_enrolled_count ??
      organization.identities_protected_count ??
      billable
  );
  const mfaEnabled = num(
    organization.mfa_enabled_count ??
      organization.identities_with_mfa_count ??
      organization.mfa_user_count
  );
  const mfaUnknown = !(
    "mfa_enabled_count" in organization ||
    "identities_with_mfa_count" in organization ||
    "mfa_user_count" in organization
  );

  const itdrCoverage = pct(itdrEnrolled, m365Users);
  const mfaCoverage = pct(mfaEnabled, m365Users);
  const unprotected = Math.max(m365Users - itdrEnrolled, 0);

  const rows: Array<{ label: string; total: number; covered: number; coverage: number; tone: "ok" | "warn" | "bad" }> = [
    {
      label: "Alle M365-brugere",
      total: m365Users,
      covered: itdrEnrolled,
      coverage: itdrCoverage,
      tone: itdrCoverage >= 95 ? "ok" : itdrCoverage >= 75 ? "warn" : "bad",
    },
    {
      label: "Fakturerbare identiteter (ITDR)",
      total: billable,
      covered: billable,
      coverage: 100,
      tone: "ok",
    },
    {
      label: "SAT-deltagere (træning)",
      total: m365Users,
      covered: sat,
      coverage: pct(sat, m365Users),
      tone: sat === 0 ? "bad" : pct(sat, m365Users) >= 80 ? "ok" : "warn",
    },
  ];

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">ITDR &amp; MFA – aggregeret</h4>
        </div>
        {customerOperationType && (
          <span className="text-xs text-muted-foreground">{customerOperationType}</span>
        )}
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <Users className="h-3 w-3" /> ITDR-dækning
          </div>
          <p className="text-2xl font-bold text-foreground">{itdrCoverage}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {itdrEnrolled} af {m365Users}
          </p>
        </div>
        <div className="rounded border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <KeyRound className="h-3 w-3" /> MFA-dækning
          </div>
          <p className="text-2xl font-bold text-foreground">
            {mfaUnknown ? "—" : `${mfaCoverage}%`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mfaUnknown ? "Ikke eksponeret af API" : `${mfaEnabled} af ${m365Users}`}
          </p>
        </div>
        <div className="rounded border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <AlertTriangle className="h-3 w-3" /> Ubeskyttede
          </div>
          <p
            className={`text-2xl font-bold ${
              unprotected === 0 ? "text-foreground" : unprotected <= 2 ? "text-yellow-600" : "text-destructive"
            }`}
          >
            {unprotected}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">M365-brugere uden ITDR</p>
        </div>
      </div>

      {/* Per type breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Pr. brugertype
        </p>
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground">{r.label}</span>
              <span className="text-muted-foreground">
                {r.covered} / {r.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  r.tone === "ok"
                    ? "bg-green-600"
                    : r.tone === "warn"
                    ? "bg-yellow-500"
                    : "bg-destructive"
                }`}
                style={{ width: `${Math.min(r.coverage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Huntress eksponerer ikke pr-bruger MFA-status via API. Tallene er aggregerede pr. organisation.
      </p>
    </div>
  );
};