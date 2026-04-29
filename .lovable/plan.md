## Huntress API integration — træk kundedata automatisk

### Vigtig afklaring først: MCP vs. REST API

Du linker til Huntress **MCP Server**. MCP (Model Context Protocol) er beregnet til at udvide AI-assistenter (som mig under udvikling) — det kan **ikke** kaldes fra en webapp som din. 

Heldigvis findes præcis det samme data via **Huntress REST API** (`https://api.huntress.io/v1`), som er det MCP-serveren selv bruger under motorhjelmen. Vi bruger derfor REST API'et direkte. Det kræver de samme credentials (API Key + Secret) som MCP.

Tilgængelige endpoints (read-only, public beta):
1. Account
2. Organizations
3. Agents
4. Incident Reports
5. Summary Reports
6. Signals / Bulletins

Auth: HTTP Basic Auth (`base64(api_key:api_secret)`).

### Hvad vi bygger

En komplet integration hvor du kan:
- Gemme Huntress API-nøgler globalt (som secrets — ikke per kunde, da én Huntress-konto typisk dækker alle dine MSP-kunder).
- Knytte hver Lovable-kunde til en Huntress `organization_id`.
- Synkronisere agenter, incidents og summary report for den kunde med ét klik.
- Vise live data (antal agenter, åbne incidents, sidste 30 dages signals) på kundens detaljeside og i `SecurityDashboard`.

### Tekniske ændringer

**1. Secrets**
Tilføj to runtime-secrets via secret-tool:
- `HUNTRESS_API_KEY`
- `HUNTRESS_API_SECRET`

**2. Database (migration)**

Ny kolonne på `customers`:
- `huntress_organization_id` (text, nullable) — Huntress' org ID for denne kunde.

Ny tabel `huntress_sync_data`:
```
id uuid pk
customer_id uuid not null
sync_type text  -- 'agents' | 'incidents' | 'summary' | 'organization'
data jsonb
synced_at timestamptz default now()
created_by_user_id uuid
```
RLS: kun ejer (`created_by_user_id = auth.uid()`) kan se/skrive.

**3. Edge functions** (alle med `verify_jwt = true`)

- `huntress-list-organizations` — henter alle organisationer fra Huntress (bruges i en dropdown når man knytter kunde til Huntress-org).
- `huntress-sync-customer` — tager `customer_id` + `huntress_organization_id`, henter agents + incidents + summary report fra Huntress, gemmer i `huntress_sync_data`.
- `huntress-get-data` — henter cachede sync-data for en kunde (eller trigger ny sync hvis ældre end x timer).

Alle tre:
- Validerer JWT i koden.
- Læser `HUNTRESS_API_KEY` / `HUNTRESS_API_SECRET` fra env.
- Kalder `https://api.huntress.io/v1/...` med `Authorization: Basic <base64>`.
- Håndterer pagination (Huntress bruger `?page=N&limit=500`, max 500).
- Returnerer 429 venligt hvis rate-limited.

**4. Frontend**

- Ny komponent `HuntressLinkDialog.tsx` — på CustomerDetail. Knap "Forbind til Huntress" åbner dialog med dropdown over organisationer fra Huntress, vælg én → gemmer `huntress_organization_id` på kunden.
- Ny komponent `HuntressLiveData.tsx` — vises på CustomerDetail når kunden er linket. Viser:
  - Antal aktive agenter
  - Åbne / lukkede incidents (sidste 30 dage)
  - Liste over seneste 10 incidents med severity, status, tidspunkt
  - "Synkroniser nu"-knap → kalder `huntress-sync-customer`.
- Udvid `SecurityDashboard.tsx` med et nyt panel "Huntress Live" der viser status (grøn = 0 åbne incidents, gul = 1-2, rød = 3+).

**5. Flow-diagram**

```text
Customer Detail page
   │
   ├─ "Forbind Huntress" knap
   │     └─► huntress-list-organizations ──► Huntress API
   │           └─► gem huntress_organization_id på customer
   │
   └─ HuntressLiveData panel
         ├─ "Sync nu" ──► huntress-sync-customer
         │                  ├─► GET /v1/agents?organization_id=X
         │                  ├─► GET /v1/incident_reports?organization_id=X
         │                  └─► GET /v1/summary_reports?organization_id=X
         │                       └─► gemmer i huntress_sync_data
         └─ viser data fra huntress_sync_data (cached)
```

### Spørgsmål inden jeg starter

1. Du har sikkert allerede en Huntress API Key + Secret (genereres i Huntress-konsollen under Account → API Credentials). Er du klar til at indtaste dem som secrets når jeg spørger?
2. Vil du have automatisk daglig sync via en cron-job (kan tilføjes senere), eller er manuel "Sync nu"-knap nok til at starte med?