import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SecurityReport {
  id: string;
  file_name: string;
  analysis_status: string;
  secure_score_current: number | null;
  secure_score_predicted: number | null;
  overall_status_percentage: number | null;
  created_at: string;
  customers: {
    name: string;
    address: string | null;
    contact_person: string | null;
    operation_type: string;
  };
}

interface ReportMatch {
  id: string;
  report_recommendation_name: string;
  report_status: string | null;
  match_confidence: number | null;
  suggested_maturity_level: number | null;
  applied: boolean;
  recommendations: {
    number: number;
    title: string;
  } | null;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();

    if (!reportId || typeof reportId !== 'string') {
      console.error('Invalid reportId provided:', reportId);
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(reportId)) {
      console.error('Invalid UUID format:', reportId);
      return new Response(
        JSON.stringify({ error: 'Invalid report ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating PDF for security report:', reportId);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Fetch security report with customer data
    const { data: report, error: reportError } = await supabaseClient
      .from("security_reports")
      .select("*, customers(*)")
      .eq("id", reportId)
      .single();

    if (reportError) {
      console.error('Error fetching report:', reportError);
      throw reportError;
    }

    console.log('Report fetched:', report.file_name);

    // Fetch matches with recommendations
    const { data: matches, error: matchesError } = await supabaseClient
      .from("security_report_matches")
      .select("*, recommendations(number, title)")
      .eq("security_report_id", reportId)
      .order("match_confidence", { ascending: false });

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      throw matchesError;
    }

    console.log('Matches fetched:', matches?.length || 0);

    // Generate HTML for PDF
    const html = generateHTMLReport(report as SecurityReport, matches as ReportMatch[]);

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

function generateHTMLReport(report: SecurityReport, matches: ReportMatch[]): string {
  const date = new Date(report.created_at).toLocaleDateString("da-DK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusColors: Record<string, string> = {
    "Passed": "#22c55e",
    "Failed": "#ef4444",
    "Not Applicable": "#6b7280",
    "Pending": "#f59e0b",
  };

  const getStatusColor = (status: string | null): string => {
    if (!status) return "#6b7280";
    for (const [key, color] of Object.entries(statusColors)) {
      if (status.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return "#6b7280";
  };

  const getConfidenceColor = (confidence: number | null): string => {
    if (confidence === null) return "#6b7280";
    if (confidence >= 80) return "#22c55e";
    if (confidence >= 50) return "#f59e0b";
    return "#ef4444";
  };

  // Count statistics
  const passedCount = matches.filter(m => m.report_status?.toLowerCase().includes('passed')).length;
  const failedCount = matches.filter(m => m.report_status?.toLowerCase().includes('failed')).length;
  const appliedCount = matches.filter(m => m.applied).length;
  const matchedCount = matches.filter(m => m.recommendations).length;

  const matchesHTML = matches
    .map(
      (match) => `
    <div style="page-break-inside: avoid; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: ${match.applied ? '#f0fdf4' : '#ffffff'};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex: 1;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #1e293b; font-size: 14px;">
            ${match.report_recommendation_name}
          </p>
          ${match.recommendations ? `
            <p style="margin: 0; font-size: 12px; color: #3b82f6;">
              → Matcher #${match.recommendations.number}: ${match.recommendations.title}
            </p>
          ` : `
            <p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic;">
              Ingen match fundet
            </p>
          `}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="padding: 4px 10px; border-radius: 9999px; background: ${getStatusColor(match.report_status)}20; color: ${getStatusColor(match.report_status)}; font-size: 11px; font-weight: 600;">
            ${match.report_status || 'Ukendt'}
          </div>
          ${match.applied ? `
            <div style="padding: 4px 10px; border-radius: 9999px; background: #22c55e20; color: #22c55e; font-size: 11px; font-weight: 600;">
              ✓ Anvendt
            </div>
          ` : ''}
        </div>
      </div>
      
      <div style="display: flex; gap: 16px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
        <div>
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 600;">KONFIDENS</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 600; color: ${getConfidenceColor(match.match_confidence)};">
            ${match.match_confidence !== null ? `${match.match_confidence}%` : '-'}
          </p>
        </div>
        <div>
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 600;">FORESLÅET NIVEAU</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 600; color: #1e293b;">
            ${match.suggested_maturity_level !== null ? `${match.suggested_maturity_level}/4` : '-'}
          </p>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="da">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sikkerhedsrapport Analyse - ${report.customers.name}</title>
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
          border-bottom: 3px solid #8b5cf6;
          margin-bottom: 40px;
        }
        .logo {
          font-size: 48px;
          font-weight: bold;
          color: #8b5cf6;
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
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }
        .summary-card {
          padding: 24px;
          border-radius: 12px;
          text-align: center;
        }
        .summary-card.primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
          color: white;
        }
        .summary-card.success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }
        .summary-card.danger {
          background: #fef2f2;
          border: 1px solid #fecaca;
        }
        .summary-card.info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }
        .summary-score {
          font-size: 36px;
          font-weight: bold;
          margin: 8px 0;
        }
        .summary-label {
          font-size: 12px;
          opacity: 0.9;
        }
        h2 {
          color: #1e293b;
          font-size: 24px;
          margin: 40px 0 20px 0;
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
        <div class="logo">📊 AI Analyse</div>
        <div class="subtitle">Sikkerhedsrapport Analyse</div>
        <h1 style="margin: 24px 0 8px 0; font-size: 28px;">${report.customers.name}</h1>
        <p style="color: #64748b; margin: 0;">Kilde: ${report.file_name}</p>
      </div>

      <div class="info-grid">
        <div>
          <div class="info-item">
            <div class="info-label">ANALYSERET</div>
            <div class="info-value">${date}</div>
          </div>
          <div class="info-item">
            <div class="info-label">RAPPORTFIL</div>
            <div class="info-value">${report.file_name}</div>
          </div>
        </div>
        <div>
          <div class="info-item">
            <div class="info-label">KUNDE</div>
            <div class="info-value">${report.customers.name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">DRIFTSTYPE</div>
            <div class="info-value">${report.customers.operation_type}</div>
          </div>
        </div>
      </div>

      <div class="summary-grid">
        ${report.secure_score_current !== null ? `
          <div class="summary-card primary">
            <div class="summary-label">MICROSOFT SECURE SCORE</div>
            <div class="summary-score">${report.secure_score_current.toFixed(0)}</div>
            <div class="summary-label">Nuværende</div>
          </div>
        ` : ''}
        
        ${report.secure_score_predicted !== null ? `
          <div class="summary-card info">
            <div class="summary-label" style="color: #3b82f6;">FORVENTET SCORE</div>
            <div class="summary-score" style="color: #3b82f6;">${report.secure_score_predicted.toFixed(0)}</div>
            <div class="summary-label" style="color: #3b82f6;">Ved fuld implementering</div>
          </div>
        ` : ''}
        
        <div class="summary-card success">
          <div class="summary-label" style="color: #22c55e;">BESTÅET</div>
          <div class="summary-score" style="color: #22c55e;">${passedCount}</div>
          <div class="summary-label" style="color: #22c55e;">anbefalinger</div>
        </div>
        
        <div class="summary-card danger">
          <div class="summary-label" style="color: #ef4444;">FEJLET</div>
          <div class="summary-score" style="color: #ef4444;">${failedCount}</div>
          <div class="summary-label" style="color: #ef4444;">anbefalinger</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1e293b;">${matches.length}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Anbefalinger i rapport</p>
        </div>
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #3b82f6;">${matchedCount}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Matchede anbefalinger</p>
        </div>
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #22c55e;">${appliedCount}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Anvendt i vurdering</p>
        </div>
      </div>

      <h2>Detaljeret Analyse (${matches.length} anbefalinger)</h2>
      ${matchesHTML}

      <div class="footer">
        <p style="margin: 8px 0;"><strong>Peaknet AI Sikkerhedsanalyse</strong></p>
        <p style="margin: 8px 0;">Genereret ${new Date().toLocaleDateString("da-DK", { year: "numeric", month: "long", day: "numeric" })}</p>
        <p style="margin: 8px 0;">Denne analyse er genereret automatisk ved hjælp af AI og bør verificeres af en sikkerhedsekspert.</p>
      </div>
    </body>
    </html>
  `;
}
