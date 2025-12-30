import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityMeasure {
  id: string;
  text: string;
  enabled: boolean;
}

interface EmergencyPlan {
  title: string;
  version: number;
  status: string;
  it_contact_company: string | null;
  it_contact_name: string | null;
  it_contact_phone: string | null;
  it_contact_email: string | null;
  security_measures: SecurityMeasure[];
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  next_review_at: string | null;
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RequestBody {
  plan: EmergencyPlan;
  customerName: string;
  customerLogo?: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Ikke angivet";
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 
                  'juli', 'august', 'september', 'oktober', 'november', 'december'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateHtml(plan: EmergencyPlan, customerName: string, customerLogo?: string): string {
  const enabledMeasures = (plan.security_measures || []).filter(m => m.enabled);
  
  const logoSection = customerLogo 
    ? `<img src="${customerLogo}" alt="${escapeHtml(customerName)} logo" class="logo" />`
    : `<div class="logo-placeholder">${escapeHtml(customerName.charAt(0))}</div>`;

  return `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beredskabsplan - ${escapeHtml(customerName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #ffffff;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid #dc2626;
    }
    
    .header-left {
      flex: 1;
    }
    
    .logo {
      max-height: 80px;
      max-width: 200px;
      object-fit: contain;
    }
    
    .logo-placeholder {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 700;
      color: white;
    }
    
    .title {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 16px;
      color: #6b7280;
    }
    
    .version-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    .alert-section {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border: 2px solid #dc2626;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
    }
    
    .alert-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .alert-icon {
      width: 40px;
      height: 40px;
      background: #dc2626;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .alert-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
    
    .alert-title {
      font-size: 22px;
      font-weight: 700;
      color: #dc2626;
    }
    
    .alert-intro {
      font-size: 16px;
      margin-bottom: 20px;
      color: #1a1a2e;
    }
    
    .contact-box {
      background: white;
      border: 2px solid #fca5a5;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .phone-icon {
      width: 50px;
      height: 50px;
      background: #dc2626;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .phone-icon svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    
    .contact-info h4 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .contact-phone {
      font-size: 28px;
      font-weight: 700;
      color: #dc2626;
      margin-bottom: 4px;
    }
    
    .contact-email {
      color: #6b7280;
      font-size: 14px;
    }
    
    .section {
      background: #f8fafc;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 24px;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .section-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .section-icon.calendar {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    }
    
    .section-icon svg {
      width: 22px;
      height: 22px;
      fill: white;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
    }
    
    .section-intro {
      color: #6b7280;
      margin-bottom: 20px;
      font-size: 14px;
    }
    
    .measures-list {
      list-style: none;
    }
    
    .measure-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: white;
      border-radius: 10px;
      margin-bottom: 10px;
      border: 1px solid #e5e7eb;
    }
    
    .check-icon {
      width: 24px;
      height: 24px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .check-icon svg {
      width: 14px;
      height: 14px;
      fill: white;
    }
    
    .measure-text {
      font-size: 14px;
      line-height: 1.5;
    }
    
    .review-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 20px;
    }
    
    .review-item {
      background: white;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
    }
    
    .review-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    
    .review-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    
    .notes-section {
      background: white;
      padding: 20px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      margin-top: 20px;
    }
    
    .notes-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #1a1a2e;
    }
    
    .notes-content {
      font-size: 14px;
      color: #4b5563;
      white-space: pre-wrap;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #9ca3af;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .container {
        padding: 20px;
      }
      
      .section, .alert-section {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <h1 class="title">${escapeHtml(plan.title)}</h1>
        <p class="subtitle">Beredskabsplan for ${escapeHtml(customerName)}</p>
        <span class="version-badge">Version ${plan.version}</span>
      </div>
      ${logoSection}
    </header>
    
    <section class="alert-section">
      <div class="alert-header">
        <div class="alert-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 4v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
        </div>
        <h2 class="alert-title">AKUT ALARM</h2>
      </div>
      
      <p class="alert-intro">
        Ved cyberkriminalitet hos <strong>${escapeHtml(customerName)}</strong> følges denne Incident Response plan:
      </p>
      
      <div class="contact-box">
        <div class="phone-icon">
          <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        </div>
        <div class="contact-info">
          <h4>Kontakt ${escapeHtml(plan.it_contact_company || 'IT-firma')} ved ${escapeHtml(plan.it_contact_name || 'IT-kontakt')}</h4>
          <p class="contact-phone">Tlf.: ${escapeHtml(plan.it_contact_phone || 'Ikke angivet')}</p>
          ${plan.it_contact_email ? `<p class="contact-email">${escapeHtml(plan.it_contact_email)}</p>` : ''}
        </div>
      </div>
    </section>
    
    <section class="section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
        </div>
        <h2 class="section-title">Forebyggende Tiltag</h2>
      </div>
      
      <p class="section-intro">Vi gør følgende for at undgå cyberkriminalitet i hverdagen:</p>
      
      <ul class="measures-list">
        ${enabledMeasures.map(measure => `
          <li class="measure-item">
            <div class="check-icon">
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
            </div>
            <span class="measure-text">${escapeHtml(measure.text)}</span>
          </li>
        `).join('')}
      </ul>
    </section>
    
    <section class="section">
      <div class="section-header">
        <div class="section-icon calendar">
          <svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
        </div>
        <h2 class="section-title">Gennemgang</h2>
      </div>
      
      <p class="section-intro">
        Vi foretager gennemgang af denne plan og gennemgår ligeledes en awareness-træning af relevant personale en gang årligt.
      </p>
      
      <div class="review-grid">
        <div class="review-item">
          <p class="review-label">Sidst gennemgået</p>
          <p class="review-value">${formatDate(plan.last_reviewed_at)}</p>
        </div>
        <div class="review-item">
          <p class="review-label">Gennemgået af</p>
          <p class="review-value">${escapeHtml(plan.last_reviewed_by || 'Ikke angivet')}</p>
        </div>
        <div class="review-item">
          <p class="review-label">Næste gennemgang</p>
          <p class="review-value">${formatDate(plan.next_review_at)}</p>
        </div>
      </div>
      
      ${plan.additional_notes ? `
        <div class="notes-section">
          <p class="notes-title">Yderligere noter</p>
          <p class="notes-content">${escapeHtml(plan.additional_notes)}</p>
        </div>
      ` : ''}
    </section>
    
    <footer class="footer">
      <span>Oprettet: ${formatDate(plan.created_at)}</span>
      <span>Sidst opdateret: ${formatDate(plan.updated_at)}</span>
    </footer>
  </div>
</body>
</html>
`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plan, customerName, customerLogo } = await req.json() as RequestBody;

    if (!plan || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Plan og kundenavn er påkrævet' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Generating PDF for emergency plan: ${plan.title} - ${customerName}`);

    const html = generateHtml(plan, customerName, customerLogo);

    // Return HTML that can be printed to PDF by the browser
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: unknown) {
    console.error('Error generating emergency plan PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Fejl ved generering af PDF', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
