import { ShieldCheck, Users, KeyRound, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Props {
  organization: any;
  customerOperationType?: string | null;
  lastSyncedAt?: string | null;
  source?: string;
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
export const HuntressIdentityCard = ({
  organization,
  customerOperationType,
  lastSyncedAt,
  source = "Huntress REST API · /v1/organizations/{id}",
}: Props) => {
  const [open, setOpen] = useState(false);
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
    <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full text-left rounded-lg border border-border p-4 space-y-4 hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">ITDR &amp; MFA – aggregeret</h4>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {customerOperationType && <span>{customerOperationType}</span>}
          <Info className="h-3.5 w-3.5" />
        </div>
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
        Klik for detaljer · Huntress eksponerer ikke pr-bruger MFA-status via API.
      </p>
    </button>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> ITDR &amp; MFA detaljer
          </DialogTitle>
          <DialogDescription>
            Aggregerede tal fra Huntress for {organization.name ?? "organisationen"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="M365-brugere (i alt)" value={m365Users} />
            <Metric label="Fakturerbare identiteter" value={billable} />
            <Metric label="ITDR-tilmeldte" value={itdrEnrolled} />
            <Metric
              label="MFA-aktiverede"
              value={mfaUnknown ? "—" : mfaEnabled}
              hint={mfaUnknown ? "Ikke eksponeret af API" : undefined}
            />
            <Metric label="SAT-deltagere" value={sat} />
            <Metric label="Ubeskyttede M365-brugere" value={unprotected} />
          </div>

          <div className="rounded border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Beregnet dækning</p>
            <div className="text-sm text-foreground space-y-1">
              <p>ITDR-dækning: <strong>{itdrCoverage}%</strong> ({itdrEnrolled} af {m365Users})</p>
              <p>MFA-dækning: <strong>{mfaUnknown ? "Ukendt" : `${mfaCoverage}%`}</strong></p>
              <p>SAT-deltagelse: <strong>{pct(sat, m365Users)}%</strong> ({sat} af {m365Users})</p>
            </div>
          </div>

          <div className="rounded border border-border p-3 space-y-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Kilde &amp; synkronisering</p>
            <p className="text-foreground"><span className="text-muted-foreground">Kilde:</span> {source}</p>
            <p className="text-foreground">
              <span className="text-muted-foreground">Sidst synkroniseret:</span>{" "}
              {lastSyncedAt
                ? format(new Date(lastSyncedAt), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })
                : "Ukendt"}
            </p>
            {organization.id && (
              <p className="text-foreground">
                <span className="text-muted-foreground">Huntress org-ID:</span> {organization.id}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Bemærk: Huntress' offentlige REST API leverer kun aggregerede tællere pr. organisation —
            ikke pr-bruger MFA-status eller individuelle ITDR-records.
          </p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

const Metric = ({ label, value, hint }: { label: string; value: number | string; hint?: string }) => (
  <div className="rounded border border-border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-bold text-foreground">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);