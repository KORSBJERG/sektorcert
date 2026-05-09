import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUNTRESS_BASE = "https://api.huntress.io/v1";
const basicAuth = (k: string, s: string) => "Basic " + btoa(`${k}:${s}`);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeSecret = (value: string) => value.trim().replace(/^['\"]+|['\"]+$/g, "");

async function fetchAll(path: string, auth: string) {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${HUNTRESS_BASE}${path}${sep}page=${page}&limit=500`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Huntress ${path} ${r.status}: ${txt}`);
    }
    const json = await r.json();
    const items =
      json.agents ??
      json.incident_reports ??
      json.summary_reports ??
      json.billing_reports ??
      json.reports ??
      json.organizations ??
      json.data ??
      [];
    if (!Array.isArray(items)) return items;
    all.push(...items);
    const pagination = json.pagination;
    if (!pagination || !pagination.next_page_number || items.length === 0) break;
    page = pagination.next_page_number;
    if (page > 50) break;
  }
  return all;
}

async function fetchOne(path: string, auth: string) {
  const r = await fetch(`${HUNTRESS_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Huntress ${path} ${r.status}: ${txt}`);
  }
  return await r.json();
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
    const customerId = body.customerId;
    if (!customerId || typeof customerId !== "string" || !UUID_RE.test(customerId)) {
      return new Response(JSON.stringify({ error: "Invalid customerId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, huntress_organization_id")
      .eq("id", customerId)
      .single();
    if (custErr || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!customer.huntress_organization_id) {
      return new Response(JSON.stringify({ error: "Customer is not linked to a Huntress organization" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawApiKey = Deno.env.get("HUNTRESS_API_KEY");
    const rawApiSecret = Deno.env.get("HUNTRESS_API_SECRET");
    const apiKey = rawApiKey ? normalizeSecret(rawApiKey) : null;
    const apiSecret = rawApiSecret ? normalizeSecret(rawApiSecret) : null;
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Huntress API credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth = basicAuth(apiKey, apiSecret);
    const orgId = customer.huntress_organization_id;

    const [organization, agents, incidents, summaries, billing, identities] = await Promise.all([
      fetchOne(`/organizations/${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
      fetchAll(`/agents?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
      fetchAll(`/incident_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
      fetchAll(`/summary_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
      fetchAll(`/billing_reports?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
      fetchAll(`/identities?organization_id=${encodeURIComponent(orgId)}`, auth).catch((e) => ({ error: String(e) })),
    ]);

    const orgPayload = (organization as any)?.organization ?? organization;

    // Derive MFA / ITDR stats from /identities (Huntress' aggregated org payload
    // does not include per-user MFA, but identities does).
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
    const { error: insertErr } = await supabase.from("huntress_sync_data").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      success: true,
      counts: {
        agents: Array.isArray(agents) ? agents.length : 0,
        incidents: Array.isArray(incidents) ? incidents.length : 0,
        summaries: Array.isArray(summaries) ? summaries.length : 0,
        billing: Array.isArray(billing) ? billing.length : 0,
        identities: identitiesArr.length,
        organization: orgPayload && !(orgPayload as any).error ? 1 : 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("huntress-sync-customer error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});