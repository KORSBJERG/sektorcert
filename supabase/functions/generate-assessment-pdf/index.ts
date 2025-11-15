import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssessmentData {
  id: string;
  assessment_date: string;
  consultant_name: string;
  overall_maturity_score: number;
  status: string;
  customers: {
    name: string;
    address: string;
    contact_person: string;
    operation_type: string;
  };
}

interface AssessmentItem {
  maturity_level: number;
  notes: string;
  recommended_actions: string;
  status: string;
  recommendations: {
    number: number;
    title: string;
    description: string;
    importance_reason: string;
  };
}

// UUID validation function
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessmentId } = await req.json();

    // Validate input
    if (!assessmentId || typeof assessmentId !== 'string') {
      console.error('Invalid assessmentId provided:', assessmentId);
      return new Response(
        JSON.stringify({ error: 'Assessment ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(assessmentId)) {
      console.error('Invalid UUID format:', assessmentId);
      return new Response(
        JSON.stringify({ error: 'Invalid assessment ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating PDF for assessment:', assessmentId);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch assessment data
    const { data: assessment, error: assessmentError } = await supabaseClient
      .from("assessments")
      .select("*, customers(*)")
      .eq("id", assessmentId)
      .single();

    if (assessmentError) throw assessmentError;

    // Fetch assessment items with recommendations
    const { data: items, error: itemsError } = await supabaseClient
      .from("assessment_items")
      .select("*, recommendations(*)")
      .eq("assessment_id", assessmentId)
      .order("recommendations(number)");

    if (itemsError) throw itemsError;

    // Generate HTML for PDF
    const html = generateHTMLReport(assessment as AssessmentData, items as AssessmentItem[]);

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateHTMLReport(assessment: AssessmentData, items: AssessmentItem[]): string {
  const date = new Date(assessment.assessment_date).toLocaleDateString("da-DK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statusColors: Record<string, string> = {
    not_fulfilled: "#ef4444",
    partially_fulfilled: "#f59e0b",
    fulfilled: "#22c55e",
    not_applicable: "#6b7280",
  };

  const statusLabels: Record<string, string> = {
    not_fulfilled: "Ikke opfyldt",
    partially_fulfilled: "Delvist opfyldt",
    fulfilled: "Opfyldt",
    not_applicable: "Ikke relevant",
  };

  const itemsHTML = items
    .map(
      (item) => `
    <div style="page-break-inside: avoid; margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #ffffff;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="background: #3b82f6; color: white; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">
          ${item.recommendations.number}
        </div>
        <h3 style="margin: 0; font-size: 20px; color: #1e293b;">${item.recommendations.title}</h3>
      </div>

      <div style="margin-bottom: 12px;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Beskrivelse:</strong></p>
        <p style="margin: 0; color: #475569; font-size: 14px;">${item.recommendations.description}</p>
      </div>

      <div style="margin-bottom: 12px;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;"><strong>Derfor er det vigtigt:</strong></p>
        <p style="margin: 0; color: #475569; font-size: 14px;">${item.recommendations.importance_reason}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <div>
          <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">MODENHEDSNIVEAU</p>
          <p style="margin: 0; color: #1e293b; font-size: 24px; font-weight: bold;">${item.maturity_level}/4</p>
        </div>
        <div>
          <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">STATUS</p>
          <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: ${statusColors[item.status] || "#6b7280"}20; color: ${statusColors[item.status] || "#6b7280"}; font-size: 14px; font-weight: 600;">
            ${statusLabels[item.status] || item.status}
          </div>
        </div>
      </div>

      ${
        item.notes
          ? `
      <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 6px;">
        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; font-weight: 600;">NOTER</p>
        <p style="margin: 0; color: #475569; font-size: 14px;">${item.notes}</p>
      </div>
      `
          : ""
      }

      ${
        item.recommended_actions
          ? `
      <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 6px;">
        <p style="margin: 0 0 4px 0; color: #92400e; font-size: 12px; font-weight: 600;">ANBEFALEDE HANDLINGER</p>
        <p style="margin: 0; color: #78350f; font-size: 14px;">${item.recommended_actions}</p>
      </div>
      `
          : ""
      }
    </div>
  `
    )
    .join("");

  // Calculate score distribution
  const scoreDistribution = [0, 0, 0, 0, 0]; // 0-4
  items.forEach((item) => {
    scoreDistribution[item.maturity_level || 0]++;
  });

  return `
    <!DOCTYPE html>
    <html lang="da">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sikkerhedsvurdering - ${assessment.customers.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
          background: #ffffff;
        }
        @media print {
          body {
            margin: 0;
            padding: 15mm;
          }
        }
        .header {
          text-align: center;
          padding: 40px 0;
          border-bottom: 3px solid #3b82f6;
          margin-bottom: 40px;
        }
        .logo {
          font-size: 48px;
          font-weight: bold;
          color: #3b82f6;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #64748b;
          font-size: 18px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 40px;
          padding: 24px;
          background: #f8fafc;
          border-radius: 12px;
        }
        .info-item {
          margin-bottom: 12px;
        }
        .info-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 16px;
          color: #1e293b;
          font-weight: 500;
        }
        .summary-card {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
          color: white;
          padding: 32px;
          border-radius: 12px;
          margin-bottom: 40px;
          text-align: center;
        }
        .summary-score {
          font-size: 72px;
          font-weight: bold;
          margin: 16px 0;
        }
        .distribution {
          display: flex;
          gap: 8px;
          margin-top: 24px;
          justify-content: center;
        }
        .distribution-bar {
          flex: 1;
          text-align: center;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
        }
        .distribution-count {
          font-size: 24px;
          font-weight: bold;
        }
        .distribution-label {
          font-size: 12px;
          opacity: 0.9;
        }
        h2 {
          color: #1e293b;
          font-size: 28px;
          margin: 48px 0 24px 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #e5e7eb;
        }
        .footer {
          margin-top: 60px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #64748b;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🛡️ SektorCERT</div>
        <div class="subtitle">Cybersikkerhedsvurdering</div>
        <h1 style="margin: 24px 0 8px 0; font-size: 32px;">${assessment.customers.name}</h1>
        <p style="color: #64748b; margin: 0;">Baseret på SektorCERTs 25 anbefalinger</p>
      </div>

      <div class="info-grid">
        <div>
          <div class="info-item">
            <div class="info-label">VURDERINGSDATO</div>
            <div class="info-value">${date}</div>
          </div>
          <div class="info-item">
            <div class="info-label">KONSULENT</div>
            <div class="info-value">${assessment.consultant_name}</div>
          </div>
        </div>
        <div>
          <div class="info-item">
            <div class="info-label">ADRESSE</div>
            <div class="info-value">${assessment.customers.address || "Ikke angivet"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">DRIFTSTYPE</div>
            <div class="info-value">${assessment.customers.operation_type}</div>
          </div>
          <div class="info-item">
            <div class="info-label">KONTAKTPERSON</div>
            <div class="info-value">${assessment.customers.contact_person || "Ikke angivet"}</div>
          </div>
        </div>
      </div>

      <div class="summary-card">
        <h3 style="margin: 0 0 8px 0; font-size: 18px; opacity: 0.9;">SAMLET MODENHEDSSCORE</h3>
        <div class="summary-score">${assessment.overall_maturity_score?.toFixed(2) || "0.00"}/4</div>
        <p style="margin: 0; opacity: 0.9;">Baseret på ${items.length} anbefalinger</p>
        
        <div class="distribution">
          ${scoreDistribution
            .map(
              (count, level) => `
            <div class="distribution-bar">
              <div class="distribution-count">${count}</div>
              <div class="distribution-label">Niveau ${level}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <h2>Detaljeret Vurdering</h2>
      ${itemsHTML}

      <div class="footer">
        <p style="margin: 8px 0;"><strong>SektorCERT Cybersikkerhed Assessment</strong></p>
        <p style="margin: 8px 0;">Genereret ${new Date().toLocaleDateString("da-DK", { year: "numeric", month: "long", day: "numeric" })}</p>
        <p style="margin: 8px 0;">Dette dokument indeholder en vurdering af cybersikkerhed baseret på SektorCERTs 25 anbefalinger.</p>
      </div>
    </body>
    </html>
  `;
}
