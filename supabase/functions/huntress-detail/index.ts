import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUNTRESS_BASE = "https://api.huntress.io/v1";
const basicAuth = (k: string, s: string) => "Basic " + btoa(`${k}:${s}`);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeSecret = (v: string) => v.trim().replace(/^['\"]+|['\"]+$/g, "");

async function fetchOne(path: string, auth: string) {
  const r = await fetch(`${HUNTRESS_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Huntress ${path} ${r.status}: ${txt}`);
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
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
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { customerId, kind, id } = body ?? {};
    if (!customerId || !UUID_RE.test(customerId) || !["agent", "incident"].includes(kind) || !id) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const numericId = String(id).replace(/[^0-9]/g, "");
    if (!numericId) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify customer is linked (RLS will also enforce visibility)
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, huntress_organization_id")
      .eq("id", customerId)
      .single();
    if (custErr || !customer?.huntress_organization_id) {
      return new Response(JSON.stringify({ error: "Customer not linked to Huntress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = normalizeSecret(Deno.env.get("HUNTRESS_API_KEY") ?? "");
    const apiSecret = normalizeSecret(Deno.env.get("HUNTRESS_API_SECRET") ?? "");
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Huntress credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const auth = basicAuth(apiKey, apiSecret);

    if (kind === "agent") {
      const agent = await fetchOne(`/agents/${numericId}`, auth);
      return new Response(JSON.stringify({ agent: (agent as any)?.agent ?? agent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // incident
    const incident = await fetchOne(`/incident_reports/${numericId}`, auth);
    let remediations: any = null;
    try {
      const rem = await fetchOne(`/incident_reports/${numericId}/remediations`, auth);
      remediations = (rem as any)?.remediations ?? rem;
    } catch (_e) { /* ignore */ }
    return new Response(JSON.stringify({
      incident: (incident as any)?.incident_report ?? (incident as any)?.report ?? incident,
      remediations,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("huntress-detail error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});