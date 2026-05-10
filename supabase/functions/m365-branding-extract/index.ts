import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function abs(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractAttr(tag: string, attr: string): string | null {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "i")) ||
    tag.match(new RegExp(`${attr}\\s*=\\s*'([^']+)'`, "i"));
  return m ? m[1] : null;
}

function extractLogos(html: string, base: string): string[] {
  const candidates: { url: string; score: number }[] = [];
  const linkTags = html.match(/<link[^>]+>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = (extractAttr(tag, "rel") ?? "").toLowerCase();
    const href = extractAttr(tag, "href");
    if (!href) continue;
    if (rel.includes("apple-touch-icon")) candidates.push({ url: abs(base, href), score: 90 });
    else if (rel.includes("icon")) candidates.push({ url: abs(base, href), score: 50 });
    else if (rel.includes("mask-icon")) candidates.push({ url: abs(base, href), score: 60 });
  }
  const metaTags = html.match(/<meta[^>]+>/gi) ?? [];
  for (const tag of metaTags) {
    const prop = (extractAttr(tag, "property") ?? extractAttr(tag, "name") ?? "").toLowerCase();
    const content = extractAttr(tag, "content");
    if (!content) continue;
    if (prop === "og:image" || prop === "og:logo" || prop === "twitter:image") {
      candidates.push({ url: abs(base, content), score: 80 });
    }
  }
  const imgTags = html.match(/<img[^>]+>/gi) ?? [];
  for (const tag of imgTags) {
    const src = extractAttr(tag, "src");
    const alt = (extractAttr(tag, "alt") ?? "").toLowerCase();
    const cls = (extractAttr(tag, "class") ?? "").toLowerCase();
    if (!src) continue;
    const isLogo = /logo/i.test(src) || /logo/.test(alt) || /logo/.test(cls);
    if (isLogo) candidates.push({ url: abs(base, src), score: 70 });
  }
  // Deduplicate keeping highest score
  const map = new Map<string, number>();
  for (const c of candidates) {
    map.set(c.url, Math.max(map.get(c.url) ?? 0, c.score));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
}

function extractColors(html: string): string[] {
  const colors = new Map<string, number>();
  // theme-color meta
  const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (themeMatch) colors.set(themeMatch[1].toLowerCase(), 100);

  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(html)) !== null) {
    let hex = m[0].toLowerCase();
    if (hex.length === 4) {
      hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    // skip near-white and near-black
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (r + g + b) / 3;
    if (lum < 25 || lum > 235) continue;
    colors.set(hex, (colors.get(hex) ?? 0) + 1);
  }
  return [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ error: "URL er påkrævet" }, 400);
    }
    const target = normalizeUrl(url);

    try {
      const parsed = new URL(target);
      if (isPrivateIp(parsed.hostname)) {
        return json({ error: "Interne adresser er ikke tilladt" }, 400);
      }
    } catch {
      return json({ error: "Ugyldig URL" }, 400);
    }

    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 PEAKNET-Branding/1.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      return json({ error: `Kunne ikke hente hjemmesiden (${res.status})` }, 400);
    }
    const html = await res.text();
    const finalUrl = res.url || target;

    const logos = extractLogos(html, finalUrl);
    const colors = extractColors(html);
    const title = extractTitle(html);
    const description = extractDescription(html);

    return json({
      url: finalUrl,
      title,
      description,
      logos,
      colors,
    });
  } catch (e) {
    console.error("m365-branding-extract error", e);
    return json({ error: "Kunne ikke analysere hjemmesiden" }, 500);
  }
});