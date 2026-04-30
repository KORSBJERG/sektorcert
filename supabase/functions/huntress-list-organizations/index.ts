import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUNTRESS_BASE = "https://api.huntress.io/v1";
const basicAuth = (k: string, s: string) => "Basic " + btoa(`${k}:${s}`);

const normalizeSecret = (value: string) => value.trim().replace(/^['\"]+|['\"]+$/g, "");

const credentialMeta = (value: string) => ({
  length: value.length,
  prefix: value.slice(0, 3),
  hasLeadingOrTrailingWhitespace: value !== value.trim(),
  wrappedInQuotes: /^['\"].*['\"]$/.test(value),
});

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

    const rawApiKey = Deno.env.get("HUNTRESS_API_KEY");
    const rawApiSecret = Deno.env.get("HUNTRESS_API_SECRET");
    const apiKey = rawApiKey ? normalizeSecret(rawApiKey) : null;
    const apiSecret = rawApiSecret ? normalizeSecret(rawApiSecret) : null;
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Huntress API credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("huntress-list-organizations auth meta", {
      apiKey: credentialMeta(rawApiKey ?? ""),
      apiSecret: credentialMeta(rawApiSecret ?? ""),
      normalizedKeyPrefix: apiKey.slice(0, 3),
      normalizedSecretPrefix: apiSecret.slice(0, 3),
    });

    const all: any[] = [];
    let page = 1;
    while (true) {
      const r = await fetch(`${HUNTRESS_BASE}/organizations?page=${page}&limit=500`, {
        headers: { Authorization: basicAuth(apiKey, apiSecret), Accept: "application/json" },
      });
      if (!r.ok) {
        const txt = await r.text();
        const hint = r.status === 401
          ? "Huntress afviste legitimationsoplysningerne. Bekræft at HUNTRESS_API_KEY er Key ID (typisk hk_) og HUNTRESS_API_SECRET er Secret Key (typisk hs_) for samme Huntress-konto."
          : undefined;

        return new Response(JSON.stringify({ error: `Huntress API ${r.status}: ${txt}`, hint }), {
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