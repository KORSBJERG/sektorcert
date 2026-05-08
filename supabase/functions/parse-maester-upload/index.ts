import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

type Severity = "critical" | "high" | "medium" | "low" | "info";

function normaliseSeverity(s: unknown): Severity {
  const v = String(s ?? "").toLowerCase();
  if (v.startsWith("crit")) return "critical";
  if (v.startsWith("high")) return "high";
  if (v.startsWith("med")) return "medium";
  if (v.startsWith("low")) return "low";
  return "info";
}

function normaliseResult(r: unknown): "Passed" | "Failed" | "Skipped" | "NotRun" | "Error" {
  const v = String(r ?? "").toLowerCase();
  if (v === "passed" || v === "pass") return "Passed";
  if (v === "failed" || v === "fail") return "Failed";
  if (v === "skipped" || v === "skip") return "Skipped";
  if (v === "error" || v === "errored") return "Error";
  return "NotRun";
}

/**
 * Maester JSON has evolved over time. We accept multiple shapes:
 *  - { Tests: [...], TenantId, TenantName, ExecutedAt, ... }     (new)
 *  - { Tests: [...], CurrentVersion, Tenant: {...} }              (variant)
 *  - Pester NUnit-ish: { TotalCount, PassedCount, ..., Tests: [] } (legacy)
 * We also accept Result/Outcome and ResultName/Status fields for tests.
 */
function parseMaester(json: any) {
  if (!json || typeof json !== "object") {
    throw new Error("Filen er ikke gyldig JSON.");
  }

  const testsRaw: any[] =
    (Array.isArray(json.Tests) && json.Tests) ||
    (Array.isArray(json.tests) && json.tests) ||
    (Array.isArray(json.Results) && json.Results) ||
    [];

  if (!testsRaw.length) {
    throw new Error("Kunne ikke finde nogen tests i Maester-rapporten.");
  }

  const tests = testsRaw.map((t) => {
    const result = normaliseResult(t.Result ?? t.Outcome ?? t.Status ?? t.ResultName);
    return {
      id: t.Id ?? t.TestId ?? t.Name ?? t.Title ?? "unknown",
      name: t.Name ?? t.Title ?? t.Description ?? "Unnamed test",
      block: t.Block ?? t.Category ?? t.Group ?? null,
      tag: Array.isArray(t.Tag) ? t.Tag : t.Tag ? [t.Tag] : [],
      severity: normaliseSeverity(t.Severity ?? t.Level),
      result,
      helpUrl: t.HelpUrl ?? t.HelpUri ?? t.Url ?? null,
      errorRecord:
        typeof t.ErrorRecord === "string"
          ? t.ErrorRecord
          : t.ErrorRecord?.Exception?.Message ?? t.ErrorMessage ?? null,
      message: t.ResultDetail ?? t.Message ?? null,
    };
  });

  const passed = tests.filter((t) => t.result === "Passed").length;
  const failed = tests.filter((t) => t.result === "Failed").length;
  const skipped = tests.filter((t) => t.result === "Skipped").length;
  const notRun = tests.filter((t) => t.result === "NotRun").length;
  const total = tests.length;
  const denom = passed + failed;
  const passPct = denom > 0 ? Math.round((passed / denom) * 1000) / 10 : 0;

  const severityCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const t of tests) {
    if (t.result === "Failed") severityCounts[t.severity]++;
  }

  const tenantId = json.TenantId ?? json.Tenant?.Id ?? json.Tenant?.TenantId ?? null;
  const tenantName = json.TenantName ?? json.Tenant?.Name ?? json.Tenant?.DisplayName ?? null;
  const executedAt = json.ExecutedAt ?? json.StartTime ?? json.Time ?? json.Timestamp ?? null;
  const maesterVersion = json.CurrentVersion ?? json.MaesterVersion ?? json.Version ?? null;
  const pesterVersion = json.PesterVersion ?? json.Pester?.Version ?? null;

  return {
    tests,
    counts: { total, passed, failed, skipped, notRun },
    passPercentage: passPct,
    severityCounts,
    tenantId,
    tenantName,
    executedAt,
    maesterVersion,
    pesterVersion,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Ikke autentificeret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { customer_id, json_storage_path, html_storage_path, notes } = body ?? {};

    if (!isUuid(customer_id) || typeof json_storage_path !== "string") {
      return new Response(JSON.stringify({ error: "Ugyldige parametre" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (html_storage_path && typeof html_storage_path !== "string") {
      return new Response(JSON.stringify({ error: "Ugyldigt html-felt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role for storage download + insert (RLS still enforced via created_by_user_id)
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify the user owns the storage path (path layout: <user_id>/<customer_id>/...)
    if (!json_storage_path.startsWith(`${userId}/${customer_id}/`)) {
      return new Response(JSON.stringify({ error: "Forbidden path" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: blob, error: dlErr } = await admin.storage
      .from("maester-reports")
      .download(json_storage_path);
    if (dlErr || !blob) throw new Error(`Kunne ikke hente JSON: ${dlErr?.message ?? "ukendt"}`);

    let parsed;
    try {
      const text = await blob.text();
      parsed = parseMaester(JSON.parse(text));
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Kunne ikke parse Maester-JSON: ${(e as Error).message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: run, error: insErr } = await admin
      .from("maester_runs")
      .insert({
        customer_id,
        created_by_user_id: userId,
        tenant_id: parsed.tenantId,
        tenant_name: parsed.tenantName,
        executed_at: parsed.executedAt,
        maester_version: parsed.maesterVersion,
        pester_version: parsed.pesterVersion,
        tests_total: parsed.counts.total,
        tests_passed: parsed.counts.passed,
        tests_failed: parsed.counts.failed,
        tests_skipped: parsed.counts.skipped,
        tests_not_run: parsed.counts.notRun,
        pass_percentage: parsed.passPercentage,
        severity_counts: parsed.severityCounts,
        result_json: { tests: parsed.tests },
        json_path: json_storage_path,
        result_html_path: html_storage_path ?? null,
        notes: typeof notes === "string" ? notes.slice(0, 1000) : null,
        analysis_status: "pending",
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Fire-and-forget AI analysis
    fetch(`${supabaseUrl}/functions/v1/analyze-maester-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ run_id: run.id }),
    }).catch((e) => console.error("trigger analyze-maester-run failed", e));

    return new Response(JSON.stringify({ success: true, run_id: run.id, summary: parsed.counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-maester-upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
