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
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^0\./.test(hostname)) return true;
  if (/^::1$/.test(h)) return true;
  if (/^fc00:/i.test(h) || /^fd[0-9a-f]{2}:/i.test(h)) return true;
  if (/^fe80:/i.test(h)) return true;
  if (/^::ffff:/i.test(h)) return true;
  if (!/^[a-z0-9.\-:[\]]+$/i.test(hostname)) return true;
  if (/^[0-9]+$/.test(hostname)) return true;
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  return false;
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function extractAttr(tag: string, attr: string): string | null {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, "i")) ||
    tag.match(new RegExp(`${attr}\\s*=\\s*'([^']+)'`, "i"));
  return m ? m[1] : null;
}

function extractColors(html: string): string[] {
  const colors = new Map<string, number>();
  const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (themeMatch) colors.set(themeMatch[1].toLowerCase(), 100);
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(html)) !== null) {
    let hex = m[0].toLowerCase();
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (r + g + b) / 3;
    if (lum < 25 || lum > 235) continue;
    colors.set(hex, (colors.get(hex) ?? 0) + 1);
  }
  return [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
}

function extractMeta(html: string): { title: string | null; description: string | null; ogImage: string | null; sector: string | null } {
  const t = html.match(/<title>([^<]+)<\/title>/i);
  const d = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const kw = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  return {
    title: t ? t[1].trim() : null,
    description: d ? d[1].trim() : null,
    ogImage: og ? og[1].trim() : null,
    sector: kw ? kw[1].trim() : null,
  };
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

async function fetchSiteContext(website: string): Promise<{
  finalUrl: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  colors: string[];
  snippet: string;
} | null> {
  try {
    const target = normalizeUrl(website);
    const parsed = new URL(target);
    if (isPrivateIp(parsed.hostname)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 PEAKNET-Branding/1.0" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 400_000);
    const meta = extractMeta(html);
    return {
      finalUrl: res.url || target,
      title: meta.title,
      description: meta.description,
      ogImage: meta.ogImage,
      colors: extractColors(html),
      snippet: visibleText(html),
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { name, description, colors, style, website, logoDataUrl, siteTitle, siteDescription } = await req.json();
    if (!name && !description && !website) {
      return json({ error: "Mindst navn, beskrivelse eller hjemmeside er påkrævet" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI nøgle mangler" }, 500);

    // Fetch live site context for richer matching
    const site = website ? await fetchSiteContext(String(website)) : null;

    const mergedColors: string[] = [
      ...(Array.isArray(colors) ? colors : []),
      ...(site?.colors ?? []),
    ].filter((c, i, a) => a.indexOf(c) === i).slice(0, 6);

    const palette = mergedColors.length
      ? mergedColors.join(", ")
      : "deep navy, teal, soft white";

    const effectiveTitle = name || siteTitle || site?.title || "Company";
    const effectiveDescription = description || siteDescription || site?.description || "A professional organization.";
    const siteSnippet = site?.snippet ? site.snippet.slice(0, 800) : "";

    const styleHint = style || "modern, professional, abstract, subtle gradient, no text, no logo, suited for a corporate Microsoft 365 sign-in background";

    const prompt = `Create a 1920x1080 widescreen background image for a Microsoft 365 sign-in page that visually matches this company's brand and website.

Company: ${effectiveTitle}
Tagline / about: ${effectiveDescription}
${site?.finalUrl ? `Website: ${site.finalUrl}` : ""}
${siteSnippet ? `Website content excerpt (use ONLY to infer industry, mood, and visual identity — do NOT render any of this text):\n"""${siteSnippet}"""` : ""}

Brand colors to use as the dominant palette: ${palette}.
${logoDataUrl ? "Reference logo is attached — match its color tones, mood, and visual character. Do NOT include the logo or any text in the output." : ""}

Style: ${styleHint}.

Hard requirements:
- Completely abstract; absolutely NO text, NO words, NO logos, NO people, NO UI elements.
- The dominant palette and atmosphere must clearly evoke the company's industry and visual identity above.
- Leave the right third of the image visually calmer/darker so a sign-in dialog can sit on top with strong contrast.
- Cinematic, premium, high quality, exactly 16:9 (1920x1080).`;

    const userContent: any[] = [{ type: "text", text: prompt }];
    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:image/")) {
      userContent.push({ type: "image_url", image_url: { url: logoDataUrl } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (aiRes.status === 429) return json({ error: "AI er optaget. Prøv igen om lidt." }, 429);
    if (aiRes.status === 402) return json({ error: "AI kreditter er opbrugt." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI image error", aiRes.status, t);
      return json({ error: "AI kunne ikke generere baggrund" }, 500);
    }

    const data = await aiRes.json();
    const imageUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) return json({ error: "AI returnerede ikke et billede" }, 500);

    return json({
      image: imageUrl,
      prompt,
      siteContextUsed: !!site,
      paletteUsed: mergedColors,
    });
  } catch (e) {
    console.error("m365-branding-generate-bg error", e);
    return json({ error: "Kunne ikke generere baggrund" }, 500);
  }
});
