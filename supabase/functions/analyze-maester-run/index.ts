import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NIS2_IDS = [
  "governance",
  "incident",
  "continuity",
  "supply_chain",
  "network",
  "vulnerability",
  "access",
  "hr_awareness",
  "crypto",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { run_id } = await req.json();
    if (typeof run_id !== "string") throw new Error("run_id mangler");

    // Verify ownership via RLS-enforced query
    const { data: runCheck, error: checkErr } = await userClient
      .from("maester_runs")
      .select("id")
      .eq("id", run_id)
      .single();
    if (checkErr || !runCheck) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY mangler");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: run, error: runErr } = await admin
      .from("maester_runs")
      .select("id, result_json, tests_total, tests_failed, tenant_name")
      .eq("id", run_id)
      .single();
    if (runErr || !run) throw new Error(`Kunne ikke finde run: ${runErr?.message}`);

    const tests = (run.result_json as any)?.tests ?? [];
    const failed = tests.filter((t: any) => t.result === "Failed").slice(0, 80);
    const skipped = tests.filter((t: any) => t.result === "Skipped").slice(0, 30);

    const compact = {
      tenant: run.tenant_name,
      total: run.tests_total,
      failed_count: run.tests_failed,
      failed: failed.map((t: any) => ({
        id: t.id,
        name: t.name,
        block: t.block,
        severity: t.severity,
        message: t.errorRecord ?? t.message ?? null,
      })),
      skipped: skipped.map((t: any) => ({ id: t.id, name: t.name, block: t.block })),
    };

    const systemPrompt = `Du er en Microsoft 365-sikkerhedsekspert med dyb viden om Maester-tests og NIS2-direktivet.
Du analyserer fejlede Maester-tests fra en M365 tenant og mapper dem til de relevante NIS2-domæner.
Skriv kortfattet, konkret og på dansk. Brug ikke fyldord.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "Analysér nedenstående Maester-resultat. Returnér en kort overordnet vurdering, top-findings prioriteret efter severity, og NIS2-relevans pr. relevant domæne.\n\n" +
              JSON.stringify(compact),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "maester_analysis",
              description: "Strukturerede resultater af Maester-analyse",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Kort overordnet vurdering på dansk (max 3 sætninger)" },
                  risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  top_findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        test_id: { type: "string" },
                        title: { type: "string" },
                        severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
                        impact: { type: "string", description: "Hvad fejlen betyder for kunden, på dansk" },
                        recommendation: { type: "string", description: "Konkret handling, på dansk" },
                      },
                      required: ["test_id", "title", "severity", "impact", "recommendation"],
                    },
                  },
                  nis2_relevance: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category_id: { type: "string", enum: [...NIS2_IDS] },
                        relevance: { type: "string", description: "Hvordan fejlene relaterer til denne NIS2-kategori, på dansk" },
                        affected_test_ids: { type: "array", items: { type: "string" } },
                      },
                      required: ["category_id", "relevance"],
                    },
                  },
                },
                required: ["summary", "risk_level", "top_findings", "nis2_relevance"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "maester_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      await admin.from("maester_runs").update({ analysis_status: "failed" }).eq("id", run_id);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI gateway: " + aiRes.status }), {
          status: aiRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Intet tool-call svar fra AI");
    const analysis = JSON.parse(toolCall.function.arguments);

    await admin
      .from("maester_runs")
      .update({ nis2_mapping: analysis, analysis_status: "completed" })
      .eq("id", run_id);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-maester-run error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
