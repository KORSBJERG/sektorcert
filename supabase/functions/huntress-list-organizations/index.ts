import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUNTRESS_BASE = "https://api.huntress.io/v1";
const basicAuth = (k: string, s: string) => "Basic " + btoa(`${k}:${s}`);

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

    const apiKey = Deno.env.get("HUNTRESS_API_KEY");
    const apiSecret = Deno.env.get("HUNTRESS_API_SECRET");
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Huntress API credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const all: any[] = [];
    let page = 1;
    while (true) {
      const r = await fetch(`${HUNTRESS_BASE}/organizations?page=${page}&limit=500`, {
        headers: { Authorization: basicAuth(apiKey, apiSecret), Accept: "application/json" },
      });
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ error: `Huntress API ${r.status}: ${txt}` }), {
          status: r.status === 401 ? 401 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await r.json();
      const orgs = json.organizations ?? json.data ?? [];
      all.push(...orgs);
      const pagination = json.pagination;
      if (!pagination || !pagination.next_page_number || orgs.length === 0) break;
      page = pagination.next_page_number;
      if (page > 50) break;
    }

    return new Response(JSON.stringify({ organizations: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("huntress-list-organizations error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});