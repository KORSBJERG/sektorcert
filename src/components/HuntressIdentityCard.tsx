import { ShieldCheck, Users, KeyRound, AlertTriangle, Info, Settings2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface Props {
  organization: any;
  customerId?: string;
  customerOperationType?: string | null;
  lastSyncedAt?: string | null;
  source?: string;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

type Thresholds = {
  itdrOk: number; itdrWarn: number;
  mfaOk: number;  mfaWarn: number;
  satOk: number;  satWarn: number;
  unprotectedWarn: number; unprotectedBad: number;
};

const DEFAULT_THRESHOLDS: Thresholds = {
  itdrOk: 95, itdrWarn: 75,
  mfaOk: 95,  mfaWarn: 75,
  satOk: 80,  satWarn: 50,
  unprotectedWarn: 1, unprotectedBad: 3,
};

const STORAGE_KEY = "huntress-identity-thresholds";

const loadThresholds = (): Thresholds => {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
};

const tone = (coverage: number, ok: number, warn: number): "ok" | "warn" | "bad" =>
  coverage >= ok ? "ok" : coverage >= warn ? "warn" : "bad";

/**
 * Aggregeret ITDR/MFA oversigt pr. kunde.
 * Huntress' offentlige API eksponerer ikke pr-bruger detaljer — kun aggregerede tællere.
 * Vi viser derfor en sammenfatning pr. brugertype (alle M365-brugere, fakturerbare identiteter,
 * SAT-deltagere) og en estimeret MFA/ITDR-dækning.
 */
export const HuntressIdentityCard = ({
  organization,
  customerId,
  customerOperationType,
  lastSyncedAt,
  source = "Huntress REST API · /v1/organizations/{id}",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setThresholds(loadThresholds());
  }, []);

  const saveThresholds = (next: Thresholds) => {
    setThresholds(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const { data: history } = useQuery({
    queryKey: ["huntress-identity-history", customerId],
    enabled: !!customerId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("huntress_sync_data")
        .select("synced_at, data")
        .eq("customer_id", customerId!)
        .eq("sync_type", "organization")
        .order("synced_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []).reverse().map((row: any) => {
        const item = row?.data?.item ?? {};
        const m365 = num(item.microsoft_365_users_count);
        const itdr = num(
          item.itdr_identity_count ??
            item.itdr_enrolled_count ??
            item.identities_protected_count ??
            item.billable_identity_count
        );
        const mfa = num(
          item.mfa_enabled_count ??
            item.identities_with_mfa_count ??
            item.mfa_user_count
        );
        const mfaKnown =
          "mfa_enabled_count" in item ||
          "identities_with_mfa_count" in item ||
          "mfa_user_count" in item;
        return {
          synced_at: row.synced_at as string,
          itdrCoverage: pct(itdr, m365),
          mfaCoverage: mfaKnown ? pct(mfa, m365) : null,
        };
      });
    },
  });

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

  const unprotectedTone: "ok" | "warn" | "bad" =
    unprotected >= thresholds.unprotectedBad ? "bad" :
    unprotected >= thresholds.unprotectedWarn ? "warn" : "ok";

  const rows: Array<{ label: string; total: number; covered: number; coverage: number; tone: "ok" | "warn" | "bad" }> = [
    {
      label: "Alle M365-brugere",
      total: m365Users,
      covered: itdrEnrolled,
      coverage: itdrCoverage,
      tone: tone(itdrCoverage, thresholds.itdrOk, thresholds.itdrWarn),
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
      tone: sat === 0 ? "bad" : tone(pct(sat, m365Users), thresholds.satOk, thresholds.satWarn),
    },
  ];

  return (
    <>
    <div className="relative">
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
          <p className={`text-2xl font-bold ${
            tone(itdrCoverage, thresholds.itdrOk, thresholds.itdrWarn) === "ok"
              ? "text-green-600"
              : tone(itdrCoverage, thresholds.itdrOk, thresholds.itdrWarn) === "warn"
              ? "text-yellow-600"
              : "text-destructive"
          }`}>{itdrCoverage}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {itdrEnrolled} af {m365Users}
          </p>
        </div>
        <div className="rounded border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <KeyRound className="h-3 w-3" /> MFA-dækning
          </div>
          <p className={`text-2xl font-bold ${
            mfaUnknown
              ? "text-foreground"
              : tone(mfaCoverage, thresholds.mfaOk, thresholds.mfaWarn) === "ok"
              ? "text-green-600"
              : tone(mfaCoverage, thresholds.mfaOk, thresholds.mfaWarn) === "warn"
              ? "text-yellow-600"
              : "text-destructive"
          }`}>
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
              unprotectedTone === "ok"
                ? "text-foreground"
                : unprotectedTone === "warn"
                ? "text-yellow-600"
                : "text-destructive"
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

    {/* Settings cog (positioned absolutely so it stays outside the clickable button) */}
    <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Justér thresholds"
          className="absolute top-3 right-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Thresholds (%)</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => saveThresholds(DEFAULT_THRESHOLDS)}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Nulstil
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Grøn ≥ OK · Gul ≥ Advarsel · Rød under Advarsel.
        </p>

        <ThresholdRow
          label="ITDR-dækning"
          ok={thresholds.itdrOk}
          warn={thresholds.itdrWarn}
          onChange={(ok, warn) => saveThresholds({ ...thresholds, itdrOk: ok, itdrWarn: warn })}
        />
        <ThresholdRow
          label="MFA-dækning"
          ok={thresholds.mfaOk}
          warn={thresholds.mfaWarn}
          onChange={(ok, warn) => saveThresholds({ ...thresholds, mfaOk: ok, mfaWarn: warn })}
        />
        <ThresholdRow
          label="SAT-deltagelse"
          ok={thresholds.satOk}
          warn={thresholds.satWarn}
          onChange={(ok, warn) => saveThresholds({ ...thresholds, satOk: ok, satWarn: warn })}
        />

        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ubeskyttede (antal)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Gul fra</Label>
              <Input
                type="number"
                min={0}
                value={thresholds.unprotectedWarn}
                onChange={(e) =>
                  saveThresholds({ ...thresholds, unprotectedWarn: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Rød fra</Label>
              <Input
                type="number"
                min={0}
                value={thresholds.unprotectedBad}
                onChange={(e) =>
                  saveThresholds({ ...thresholds, unprotectedBad: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-8"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Gemmes lokalt i din browser.</p>
      </PopoverContent>
    </Popover>
    </div>

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

const ThresholdRow = ({
  label,
  ok,
  warn,
  onChange,
}: {
  label: string;
  ok: number;
  warn: number;
  onChange: (ok: number, warn: number) => void;
}) => {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Grøn ≥</p>
          <Input
            type="number"
            min={0}
            max={100}
            value={ok}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0), warn)}
            className="h-8"
          />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Gul ≥</p>
          <Input
            type="number"
            min={0}
            max={100}
            value={warn}
            onChange={(e) => onChange(ok, clamp(Number(e.target.value) || 0))}
            className="h-8"
          />
        </div>
      </div>
    </div>
  );
};