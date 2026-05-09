import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUNTRESS_BASE = "https://api.huntress.io/v1";
const basicAuth = (k: string, s: string) => "Basic " + btoa(`${k}:${s}`);
const normalizeSecret = (value: string) => value.trim().replace(/^['\"]+|['\"]+$/g, "");

async function fetchAll(path: string, auth: string) {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${HUNTRESS_BASE}${path}${sep}page=${page}&limit=500`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Huntress ${path} ${r.status}`);
    const json = await r.json();
    const items =
      json.agents ?? json.incident_reports ?? json.summary_reports ??
      json.billing_reports ?? json.reports ?? json.organizations ??
      json.identities ?? json.data ?? [];
    if (!Array.isArray(items)) return items;
    all.push(...items);
    const pagination = json.pagination;
    if (!pagination?.next_page_number || items.length === 0) break;
    page = pagination.next_page_number;
    if (page > 50) break;
  }
  return all;
}

async function fetchOne(path: string, auth: string) {
  const r = await fetch(`${HUNTRESS_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Huntress ${path} ${r.status}`);
  return await r.json();
}

async function syncOne(supabase: any, userId: string, auth: string, customerId: string, orgId: string) {
  const [organization, agents, incidents, summaries, billing, identities] = await Promise.all([
    fetchOne(`/organizations/${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    fetchAll(`/agents?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    fetchAll(`/incident_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    fetchAll(`/summary_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    fetchAll(`/billing_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    fetchAll(`/identities?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
  ]);
  const orgPayload = (organization as any)?.organization ?? organization;
  const identitiesArr = Array.isArray(identities) ? identities : [];
  if (identitiesArr.length > 0 && orgPayload && !(orgPayload as any).error) {
    const truthy = (v: any) =>
      v === true || v === 1 || (typeof v === "string" && ["true", "yes", "enabled", "enforced"].includes(v.toLowerCase()));
    const mfaEnabled = identitiesArr.filter((i: any) =>
      truthy(i?.mfa_enabled ?? i?.mfa ?? i?.has_mfa ?? i?.mfa_enforced)
    ).length;
    const admins = identitiesArr.filter((i: any) => truthy(i?.is_admin ?? i?.admin)).length;
    const adminsWithMfa = identitiesArr.filter(
      (i: any) => truthy(i?.is_admin ?? i?.admin) && truthy(i?.mfa_enabled ?? i?.mfa ?? i?.has_mfa ?? i?.mfa_enforced)
    ).length;
    (orgPayload as any).mfa_enabled_count = mfaEnabled;
    (orgPayload as any).identity_count = identitiesArr.length;
    (orgPayload as any).admin_count = admins;
    (orgPayload as any).admin_mfa_enabled_count = adminsWithMfa;
  }
  const rows = [
    { customer_id: customerId, sync_type: "organization", data: { item: orgPayload }, created_by_user_id: userId },
    { customer_id: customerId, sync_type: "agents", data: { items: agents }, created_by_user_id: userId },
    { customer_id: customerId, sync_type: "incidents", data: { items: incidents }, created_by_user_id: userId },
    { customer_id: customerId, sync_type: "summary", data: { items: summaries }, created_by_user_id: userId },
    { customer_id: customerId, sync_type: "billing", data: { items: billing }, created_by_user_id: userId },
    { customer_id: customerId, sync_type: "identities", data: { items: identitiesArr }, created_by_user_id: userId },
  ];
  const { error } = await supabase.from("huntress_sync_data").insert(rows);
  if (error) throw error;
  return {
    agents: Array.isArray(agents) ? agents.length : 0,
    incidents: Array.isArray(incidents) ? incidents.length : 0,
    summaries: Array.isArray(summaries) ? summaries.length : 0,
    billing: Array.isArray(billing) ? billing.length : 0,
    identities: identitiesArr.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const onlyIds: string[] | undefined = Array.isArray(body.customerIds) ? body.customerIds : undefined;

    let query = supabase
      .from("customers")
      .select("id, name, huntress_organization_id")
      .not("huntress_organization_id", "is", null);
    if (onlyIds && onlyIds.length) query = query.in("id", onlyIds);

    const { data: customers, error: custErr } = await query;
    if (custErr) throw custErr;
    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("HUNTRESS_API_KEY");
    const apiSecret = Deno.env.get("HUNTRESS_API_SECRET");
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Huntress API credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth = basicAuth(normalizeSecret(apiKey), normalizeSecret(apiSecret));

    const results: any[] = [];
    let synced = 0, failed = 0;

    // Sequential to avoid Huntress rate limits
    for (const c of customers) {
      try {
        const counts = await syncOne(supabase, userId, auth, c.id, c.huntress_organization_id);
        synced++;
        results.push({ customerId: c.id, name: c.name, status: "ok", counts });
      } catch (e) {
        failed++;
        results.push({ customerId: c.id, name: c.name, status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, total: customers.length, synced, failed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("huntress-sync-all error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});