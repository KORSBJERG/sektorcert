import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, description, colors, style } = await req.json();
    if (!name && !description) {
      return json({ error: "Mindst navn eller beskrivelse er påkrævet" }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI nøgle mangler" }, 500);

    const palette = Array.isArray(colors) && colors.length
      ? colors.slice(0, 4).join(", ")
      : "deep navy, teal, soft white";

    const styleHint = style || "modern, professional, abstract, subtle gradient, no text, no logo, suited for a corporate Microsoft 365 sign-in background";

    const prompt = `Create a 1920x1080 widescreen background image for a Microsoft 365 sign-in page.
Brand: ${name ?? "Company"}.
About: ${description ?? "A professional organization."}
Use a color palette inspired by: ${palette}.
Style: ${styleHint}.
Important: completely abstract, no text, no logos, no people, no UI elements. Leave the right third visually calmer so a sign-in dialog can sit on top with good contrast. Cinematic, high quality, 16:9.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
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
    if (!imageUrl) {
      return json({ error: "AI returnerede ikke et billede" }, 500);
    }

    return json({ image: imageUrl, prompt });
  } catch (e) {
    console.error("m365-branding-generate-bg error", e);
    return json({ error: "Kunne ikke generere baggrund" }, 500);
  }
});