import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integrationId } = await req.json();

    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "Integration ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting Huntress data analysis for integration: ${integrationId}`);

    // Get integration with customer info
    const { data: integration, error: integrationError } = await supabase
      .from("huntress_integrations")
      .select("*, customers(*)")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Huntress data
    const [incidentsResult, agentsResult, syncResultsResult] = await Promise.all([
      supabase
        .from("huntress_incidents")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("detected_at", { ascending: false }),
      supabase
        .from("huntress_agents")
        .select("*")
        .eq("huntress_integration_id", integrationId),
      supabase
        .from("huntress_sync_results")
        .select("*")
        .eq("huntress_integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const incidents = incidentsResult.data || [];
    const agents = agentsResult.data || [];
    const latestSync = syncResultsResult.data?.[0];

    // Fetch all recommendations
    const { data: recommendations } = await supabase
      .from("recommendations")
      .select("*");

    if (!recommendations || recommendations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recommendations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare data summary for AI
    const huntressSummary = {
      total_incidents: incidents.length,
      critical_incidents: incidents.filter((i) => i.severity === "critical").length,
      high_incidents: incidents.filter((i) => i.severity === "high").length,
      medium_incidents: incidents.filter((i) => i.severity === "medium").length,
      low_incidents: incidents.filter((i) => i.severity === "low").length,
      recent_incidents: incidents.slice(0, 10).map((i) => ({
        title: i.title,
        severity: i.severity,
        status: i.status,
        detected_at: i.detected_at,
      })),
      total_agents: agents.length,
      defender_enabled: agents.filter((a) => a.defender_status === "enabled").length,
      defender_disabled: agents.filter((a) => a.defender_status !== "enabled").length,
      os_distribution: agents.reduce((acc: Record<string, number>, a) => {
        const os = a.os_version || "Unknown";
        acc[os] = (acc[os] || 0) + 1;
        return acc;
      }, {}),
    };

    const recommendationsSummary = recommendations.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      description: r.description,
      level_1: r.level_1_description,
      level_2: r.level_2_description,
      level_3: r.level_3_description,
      level_4: r.level_4_description,
    }));

    const systemPrompt = `Du er en sikkerhedsekspert, der analyserer Huntress sikkerhedsdata og matcher dem med NIS2 sikkerhedsanbefalinger.

Din opgave er at:
1. Analysere Huntress-data (incidents og endpoint status)
2. Vurdere den aktuelle sikkerhedsmodenhed baseret på dataene
3. Matche relevante fund med sikkerhedsanbefalingerne
4. Foreslå et modenhedsniveau (0-4) for hver relevant anbefaling

Modenhedsniveauer:
- 0: Ingen implementering
- 1: Grundlæggende/ad-hoc
- 2: Delvist implementeret
- 3: Fuldt implementeret
- 4: Optimeret og kontinuerligt forbedret

Fokuser særligt på:
- Endpoint protection (Defender status)
- Incident response (baseret på incident typer og håndtering)
- Trusselsdetektering (baseret på detekterede trusler)
- Systemhårdning (baseret på OS versioner og konfiguration)`;

    const userPrompt = `Analyser følgende Huntress sikkerhedsdata og match med anbefalingerne:

HUNTRESS DATA:
${JSON.stringify(huntressSummary, null, 2)}

SIKKERHEDSANBEFALINGER:
${JSON.stringify(recommendationsSummary, null, 2)}

Returner matches som en JSON-array med objekter der indeholder:
- recommendation_id (nummer)
- suggested_maturity_level (0-4)
- confidence (0-100)
- reasoning (kort begrundelse på dansk)`;

    console.log("Calling Lovable AI for analysis...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "huntress_analysis",
              description: "Return the analysis of Huntress data matched with recommendations",
              parameters: {
                type: "object",
                properties: {
                  overall_security_score: {
                    type: "number",
                    description: "Overall security score from 0-100",
                  },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recommendation_id: { type: "number" },
                        suggested_maturity_level: { type: "number" },
                        confidence: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["recommendation_id", "suggested_maturity_level", "confidence", "reasoning"],
                    },
                  },
                  key_findings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key security findings in Danish",
                  },
                  risk_areas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Areas of concern in Danish",
                  },
                },
                required: ["overall_security_score", "matches", "key_findings", "risk_areas"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "huntress_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log("AI response received");

    let analysisResult;
    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysisResult = JSON.parse(toolCall.function.arguments);
      } else {
        throw new Error("No tool call in response");
      }
    } catch (e) {
      console.error("Error parsing AI response:", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the latest sync result with analysis
    if (latestSync) {
      await supabase
        .from("huntress_sync_results")
        .update({ analysis_result: analysisResult })
        .eq("id", latestSync.id);
    }

    console.log("Huntress analysis completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisResult,
        data_summary: huntressSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Huntress analysis error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
