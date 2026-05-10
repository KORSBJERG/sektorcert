import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isPrivateIp(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^0\./.test(hostname)) return true;
  if (/^::1$/.test(hostname)) return true;
  if (/^fc00:/i.test(hostname)) return true;
  if (/^fe80:/i.test(hostname)) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "Ugyldig URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const parsed = new URL(url);
      if (isPrivateIp(parsed.hostname)) {
        return new Response(JSON.stringify({ error: "Interne adresser er ikke tilladt" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Ugyldig URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 PEAKNET-Branding/1.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Hentning fejlede (${res.status})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    return new Response(JSON.stringify({ dataUrl: `data:${contentType};base64,${b64}`, contentType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-image error", e);
    return new Response(JSON.stringify({ error: "Kunne ikke hente billede" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
