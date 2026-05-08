
# Maester-rapport upload pr. kunde

Du kører selv `Invoke-Maester` lokalt og uploader output-filen på kundens side. Vi gemmer den, parser den, og viser et overskueligt dashboard + fuld rapport pr. kunde — samme mønster som jeres eksisterende M365 baseline-/DNS-rapporter.

## Hvad du uploader

Maester producerer flere filer i sin output-mappe. Vi accepterer to formater:

1. **`TestResults.json`** *(anbefalet — alt vi behøver)*
   Indeholder alle test-resultater struktureret: `Tests[]` med `Name`, `Result` (Passed/Failed/Skipped/NotRun), `Block`, `Tag`, `ErrorRecord`, `HelpUrl`, `Severity`, samt `TenantId`, `TenantName`, `ExecutedAt`, `Pester`-version osv.
2. **`TestResults.html`** *(valgfri)*
   Den pæne Maester-rapport som vi viser indlejret i en sandboxed iframe.

Du kan uploade én eller begge filer i samme upload (eller en `.zip` af hele output-mappen — vi pakker den ud server-side og finder de relevante filer).

## Datamodel (én ny tabel + én bucket)

Tabel `maester_runs`:
- `customer_id`, `created_by_user_id`
- `tenant_id`, `tenant_name`
- `executed_at` (timestamptz fra rapporten)
- `maester_version`, `pester_version`
- `tests_total`, `tests_passed`, `tests_failed`, `tests_skipped`, `tests_not_run`
- `pass_percentage` (numeric, beregnet)
- `severity_counts` (jsonb: `{ critical, high, medium, low, info }`)
- `result_json` (jsonb — fuldt parset Maester-output)
- `result_html_path` (storage path, nullable)
- `json_path` (storage path)
- `nis2_mapping` (jsonb, sat af AI-analysen)
- `analysis_status` — `pending` · `completed` · `failed`
- `notes` (text — fri kommentar)

Storage-bucket `maester-reports` (privat) — RLS scopet pr. bruger, samme mønster som `security-reports`.

RLS på `maester_runs`: bruger kan kun se/oprette/slette egne runs (`created_by_user_id = auth.uid()`).

## Edge functions

1. **`parse-maester-upload`** *(kaldes efter upload)*
   - Input: `{ customer_id, json_storage_path, html_storage_path? }`
   - Henter JSON fra storage, validerer struktur med Zod
   - Beregner counts, pass-procent, severity-fordeling
   - Indsætter `maester_runs`-row, status `pending` for AI-analyse
   - Trigger `analyze-maester-run` async
2. **`analyze-maester-run`**
   - Lovable AI (Gemini 2.5 Flash) — prompt med failed/skipped tests
   - Mapper findings til de 9 NIS2-domæner (samme `nis2-categories.ts`-id'er som I bruger andre steder)
   - Gemmer `nis2_mapping`, sætter `analysis_status=completed`

Begge funktioner følger samme CORS/JWT-mønster som `analyze-dns-report` og `analyze-security-report`.

## UI på kundesiden (`CustomerDetail`)

Ny sektion **"Maester – M365 sikkerhedstest"** (indsat under Sikkerhedsrapporter, før Beredskabsplan):

- **`MaesterReportUpload`** — knap *"Upload Maester-rapport"* åbner dialog:
  - Drag-and-drop / vælg fil (`.json`, `.html`, `.zip`, max 20 MB)
  - Hvis kun HTML uploades: fejlbesked om at JSON er nødvendig for analyse
  - Loader-state mens parse + AI kører
- **`MaesterReportsList`** — tabel med alle runs for kunden:
  - Kolonner: dato (executed_at), tenant, pass-procent (badge: grøn ≥90%, gul ≥70%, rød), failed/total, severity-chips, AI-status, handlinger
  - Handlinger: "Vis rapport", "Sammenlign", slet
- **`MaesterDashboardCard`** øverst i sektionen:
  - KPI-tal: seneste pass-procent, failed-count, dato
  - Donut: failed pr. NIS2-domæne
  - Sparkline-trend over de seneste 6 runs (genbruger samme komponent som ITDR-trenden)
- **`MaesterReportViewer`** dialog (åbnes fra "Vis rapport"):
  - Tab 1 *"Oversigt"*: KPI'er, severity-fordeling, top-failed tests (med Maester `HelpUrl` som "Læs mere")
  - Tab 2 *"NIS2-mapping"*: AI-genereret per-domæne analyse (samme stil som DNS-rapport)
  - Tab 3 *"Fuld rapport"*: indlejret HTML i sandboxed iframe (signed storage URL) — fallback hvis HTML ikke uploadet: render fra JSON som tabel
  - Knap "Download original" (signed URL til JSON+HTML)
- Optag i **Unified Security Dashboard**: tilføj Maester som ny datakilde sammen med M365 baseline, DNS og Huntress.

## Robusthed

- Zod-schema for Maester JSON, så vi giver en pæn fejlmeddelelse hvis filen ikke er gyldig (hvis Maester ændrer felter, fejler vi tydeligt og logger den ukendte struktur).
- Filtypevalidering + størrelsesgrænse client-side OG i edge function.
- Signed URLs (kort levetid) til rapport-visning — aldrig offentlig bucket.
- HTML-rapporten vises i `<iframe sandbox>` uden `allow-same-origin` for at undgå XSS.
- Audit-log entry pr. upload (genbruger jeres `audit_logs`-mønster).

## Faseplan

1. **Migration** — `maester_runs`-tabel, RLS, storage-bucket + policies.
2. **Edge functions** — `parse-maester-upload`, `analyze-maester-run`.
3. **UI** — `MaesterReportUpload`, `MaesterReportsList`, `MaesterReportViewer`, `MaesterDashboardCard`, indsæt i `CustomerDetail`.
4. **Unified Dashboard** — tilføj Maester-datakilde.
5. **QA** — test med en rigtig Maester-output, verificér parsing, AI-mapping, HTML-visning.

## Hvad der ikke er med (med vilje)

- Ingen runner / ingen kald til M365 / ingen credentials gemmes — du kører Maester selv.
- Ingen automatisk planlægning af runs — kun upload på demand.

Sig til når jeg skal gå i gang, så starter jeg med migrationen.
