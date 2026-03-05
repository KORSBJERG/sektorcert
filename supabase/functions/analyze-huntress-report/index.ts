import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportId, pdfBase64 } = await req.json();
    if (!reportId || !pdfBase64) throw new Error("Missing required parameters: reportId and pdfBase64");

    console.log(`Analyzing Huntress report: ${reportId}`);

    const systemPrompt = `Du er en cybersikkerhedsekspert der analyserer Huntress månedlige trusselrapporter (Threat Reports).

Huntress-rapporter indeholder typisk:
- Summary: entities, events analyzed, signals detected, signals investigated, incidents reported
- Persistent Footholds: autorun events analysis
- Ransomware Canaries: canary files monitoring
- Process Insights: process events analysis
- Managed ITDR: Microsoft 365 event analysis
- Managed SIEM: log ingestion and analysis
- Incident Summary
- Global Threat Spotlight / Analyst Notes

Udtræk al struktureret data fra rapporten. Alle tal og statistikker er vigtige.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              {
                type: "text",
                text: "Analysér denne Huntress Threat Report og udtræk alle strukturerede data. Brug tool calling til at returnere resultaterne.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "huntress_report_analysis",
              description: "Return structured Huntress threat report analysis",
              parameters: {
                type: "object",
                properties: {
                  report_period: {
                    type: "string",
                    description: "Report period (e.g. '2026-02-01 - 2026-02-28')",
                  },
                  organization_name: {
                    type: "string",
                    description: "Organization name from the report",
                  },
                  summary: {
                    type: "object",
                    properties: {
                      entities_protected: { type: "number" },
                      total_events_analyzed: { type: "number" },
                      total_events_label: { type: "string", description: "Human-readable label like '1.93M'" },
                      signals_detected: { type: "number" },
                      signals_investigated: { type: "number" },
                      incidents_reported: { type: "number" },
                      overall_assessment: { type: "string", description: "Brief assessment in Danish" },
                    },
                    required: ["entities_protected", "total_events_analyzed", "signals_detected", "incidents_reported"],
                  },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        category: {
                          type: "string",
                          enum: ["persistent_footholds", "ransomware_canaries", "process_insights", "managed_itdr", "managed_siem", "incident_summary", "other"],
                        },
                        events_analyzed: { type: "number" },
                        events_label: { type: "string" },
                        signals_detected: { type: "number" },
                        signals_investigated: { type: "number" },
                        incidents_reported: { type: "number" },
                        status: {
                          type: "string",
                          enum: ["clean", "warning", "critical"],
                          description: "clean = no incidents, warning = signals investigated, critical = incidents reported",
                        },
                        details: { type: "string", description: "Summary of this section in Danish" },
                      },
                      required: ["title", "category", "status", "details"],
                    },
                  },
                  global_threats: {
                    type: "array",
                    description: "Global threat tags/topics mentioned",
                    items: { type: "string" },
                  },
                  analyst_notes: {
                    type: "string",
                    description: "Analyst notes / global threat description in Danish",
                  },
                  threat_spotlight: {
                    type: "string",
                    description: "Global Threat Spotlight summary in Danish",
                  },
                  risk_assessment: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "Overall risk assessment based on findings",
                  },
                  nis2_relevance: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category_id: {
                          type: "string",
                          enum: ["governance", "incident", "continuity", "supply_chain", "network", "vulnerability", "access", "hr_awareness", "crypto"],
                        },
                        relevance: { type: "string", description: "How findings relate to this NIS2 category in Danish" },
                      },
                      required: ["category_id", "relevance"],
                    },
                  },
                },
                required: ["report_period", "organization_name", "summary", "sections", "risk_assessment"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "huntress_report_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Prøv igen om lidt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Betalingskrævet. Tilføj venligst credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No analysis results from AI");

    const analysisResult = JSON.parse(toolCall.function.arguments);
    console.log(`Analysis complete for ${analysisResult.organization_name}: ${analysisResult.risk_assessment} risk`);

    // Calculate a score-like percentage (incidents = 0 is good)
    const summary = analysisResult.summary;
    const overallPercentage = summary.incidents_reported === 0
      ? (summary.signals_investigated === 0 ? 100 : 80)
      : (summary.incidents_reported <= 2 ? 50 : 20);

    const { error: updateError } = await supabase
      .from("security_reports")
      .update({
        analysis_status: "completed",
        analysis_result: analysisResult,
        secure_score_current: overallPercentage,
        overall_status_percentage: overallPercentage,
      })
      .eq("id", reportId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        analysisResult,
        sectionsCount: analysisResult.sections?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-huntress-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
