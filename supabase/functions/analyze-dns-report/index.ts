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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportId, pdfBase64 } = await req.json();

    if (!reportId || !pdfBase64) {
      throw new Error("Missing required parameters: reportId and pdfBase64");
    }

    console.log(`Analyzing DNS security report: ${reportId}`);

    const systemPrompt = `Du er en DNS-sikkerhedsekspert der analyserer Skysnag og lignende DNS-sikkerhedsrapporter.

Din opgave er at analysere rapporten og udtrække strukturerede data om DNS-sikkerhedsstatus.

Rapporter indeholder typisk:
- Email Security Score
- DMARC status og konfiguration
- SPF status og konfiguration
- DKIM status
- TLS-RPT status
- MTA-STS status
- BIMI status
- Anbefalinger og action items

Udtræk al relevant information og vurdér hvert område.`;

    // Send PDF as base64 image to Gemini (supports document understanding)
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
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Analysér denne DNS-sikkerhedsrapport og udtræk alle strukturerede data. Brug tool calling til at returnere resultaterne.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "dns_security_analysis",
              description: "Return structured DNS security analysis results from the report",
              parameters: {
                type: "object",
                properties: {
                  report_source: {
                    type: "string",
                    description: "Source/vendor of the report (e.g. Skysnag, MXToolbox)",
                  },
                  domain: {
                    type: "string",
                    description: "The domain analyzed",
                  },
                  email_security_score: {
                    type: "number",
                    description: "Email security score (0-10 scale)",
                  },
                  email_security_max_score: {
                    type: "number",
                    description: "Maximum possible score (usually 10)",
                  },
                  summary: {
                    type: "string",
                    description: "Brief summary of findings in Danish",
                  },
                  findings: {
                    type: "array",
                    description: "Individual DNS security findings",
                    items: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          enum: ["DMARC", "SPF", "DKIM", "TLS-RPT", "MTA-STS", "BIMI", "DNSSEC", "OTHER"],
                        },
                        title: {
                          type: "string",
                          description: "Finding title",
                        },
                        status: {
                          type: "string",
                          enum: ["pass", "warning", "fail", "info"],
                        },
                        details: {
                          type: "string",
                          description: "Detailed description of the finding",
                        },
                        record_value: {
                          type: "string",
                          description: "The actual DNS record value if available",
                        },
                      },
                      required: ["category", "title", "status", "details"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    description: "Action items and recommendations from the report",
                    items: {
                      type: "object",
                      properties: {
                        priority: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                        },
                        title: {
                          type: "string",
                        },
                        description: {
                          type: "string",
                        },
                      },
                      required: ["priority", "title", "description"],
                    },
                  },
                  nis2_relevance: {
                    type: "array",
                    description: "Which NIS2 categories these findings relate to",
                    items: {
                      type: "object",
                      properties: {
                        category_id: {
                          type: "string",
                          enum: ["governance", "incident", "continuity", "supply_chain", "network", "vulnerability", "access", "hr_awareness", "crypto"],
                        },
                        relevance: {
                          type: "string",
                          description: "How this relates to the NIS2 category in Danish",
                        },
                      },
                      required: ["category_id", "relevance"],
                    },
                  },
                },
                required: ["domain", "email_security_score", "summary", "findings", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "dns_security_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Prøv igen om lidt." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Betalingskrævet. Tilføj venligst credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No analysis results from AI");
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);
    console.log(`Analysis complete for ${analysisResult.domain}: score ${analysisResult.email_security_score}`);

    // Calculate overall percentage from score
    const overallPercentage = analysisResult.email_security_max_score
      ? (analysisResult.email_security_score / analysisResult.email_security_max_score) * 100
      : (analysisResult.email_security_score / 10) * 100;

    // Update the security report with analysis results
    const { error: updateError } = await supabase
      .from("security_reports")
      .update({
        analysis_status: "completed",
        analysis_result: analysisResult,
        secure_score_current: analysisResult.email_security_score,
        secure_score_predicted: analysisResult.email_security_max_score || 10,
        overall_status_percentage: overallPercentage,
      })
      .eq("id", reportId);

    if (updateError) {
      console.error("Error updating report:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysisResult,
        findingsCount: analysisResult.findings?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-dns-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
