import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { reportId, csvContent, recommendations } = await req.json();

    if (!reportId || !csvContent) {
      throw new Error("Missing required parameters: reportId and csvContent");
    }

    // Build the analysis prompt
    const systemPrompt = `Du er en sikkerhedsekspert der analyserer Microsoft 365 sikkerhedsrapporter.
    
Din opgave er at:
1. Parse CSV-rapporten og identificere hver sikkerhedsanbefaling med status
2. Matche hver anbefaling fra rapporten med de relevante anbefalinger fra kundens sikkerhedsvurdering
3. Foreslå et modenhedsniveau (0-4) baseret på status i rapporten

Modenhedsniveauer:
- 0: Ikke implementeret (Failed)
- 1: Grundlæggende implementering påbegyndt
- 2: Delvist implementeret
- 3: Hovedsageligt implementeret
- 4: Fuldt implementeret (Passed)

Returnér struktureret data med matches.`;

    const userPrompt = `Her er sikkerhedsrapporten (CSV):
${csvContent}

Her er de eksisterende anbefalinger i kundens sikkerhedsvurdering:
${JSON.stringify(recommendations, null, 2)}

Analysér rapporten og match hver anbefaling fra rapporten med de mest relevante anbefalinger fra sikkerhedsvurderingen.
For hver match, foreslå et modenhedsniveau baseret på rapportens status.`;

    // Call AI to analyze the report
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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_analysis",
              description: "Report the security analysis results with matched recommendations",
              parameters: {
                type: "object",
                properties: {
                  secure_score_current: {
                    type: "number",
                    description: "Current Microsoft Secure Score if found in report",
                  },
                  secure_score_predicted: {
                    type: "number",
                    description: "Predicted Secure Score if all recommendations applied",
                  },
                  overall_status_percentage: {
                    type: "number",
                    description: "Overall compliance percentage if found",
                  },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        report_recommendation_name: {
                          type: "string",
                          description: "Name of the recommendation from the CSV report",
                        },
                        report_status: {
                          type: "string",
                          description: "Status from the report (Passed, Failed, etc.)",
                        },
                        recommendation_id: {
                          type: "number",
                          description: "ID of the matched recommendation from the assessment, or null if no match",
                        },
                        match_confidence: {
                          type: "number",
                          description: "Confidence score 0-100 for how well this matches",
                        },
                        suggested_maturity_level: {
                          type: "number",
                          description: "Suggested maturity level 0-4 based on report status",
                        },
                      },
                      required: ["report_recommendation_name", "report_status", "suggested_maturity_level"],
                    },
                  },
                },
                required: ["matches"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_analysis" } },
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
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
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

    // Update the security report with analysis results
    const { error: updateError } = await supabase
      .from("security_reports")
      .update({
        analysis_status: "completed",
        analysis_result: analysisResult,
        secure_score_current: analysisResult.secure_score_current,
        secure_score_predicted: analysisResult.secure_score_predicted,
        overall_status_percentage: analysisResult.overall_status_percentage,
      })
      .eq("id", reportId);

    if (updateError) {
      console.error("Error updating report:", updateError);
      throw updateError;
    }

    // Insert matches into the matches table
    if (analysisResult.matches && analysisResult.matches.length > 0) {
      const matchInserts = analysisResult.matches.map((match: any) => ({
        security_report_id: reportId,
        recommendation_id: match.recommendation_id || null,
        report_recommendation_name: match.report_recommendation_name,
        report_status: match.report_status,
        match_confidence: match.match_confidence || null,
        suggested_maturity_level: match.suggested_maturity_level,
      }));

      const { error: matchError } = await supabase
        .from("security_report_matches")
        .insert(matchInserts);

      if (matchError) {
        console.error("Error inserting matches:", matchError);
        throw matchError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysisResult,
        matchCount: analysisResult.matches?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-security-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
