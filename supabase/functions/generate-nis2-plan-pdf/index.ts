import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NIS2Item {
  id: string;
  text: string;
  status: string;
  notes: string;
}

interface NIS2Category {
  id: string;
  title: string;
  description: string;
  items: NIS2Item[];
}

interface NIS2Plan {
  title: string;
  version: number;
  status: string;
  risk_level: string | null;
  responsible_person: string | null;
  responsible_role: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  categories: NIS2Category[];
  additional_notes: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Ikke angivet";
  const date = new Date(dateStr);
  const months = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
  return `${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: "Ikke startet", in_progress: "I gang", implemented: "Implementeret", not_applicable: "Ikke relevant"
  };
  return map[status] || status;
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    not_started: "#9ca3af", in_progress: "#f59e0b", implemented: "#10b981", not_applicable: "#d1d5db"
  };
  return map[status] || "#9ca3af";
}

function getRiskLabel(level: string | null): string {
  const map: Record<string, string> = { low: "Lav", medium: "Medium", high: "Høj", critical: "Kritisk" };
  return map[level || "medium"] || "Medium";
}

function getRiskColor(level: string | null): string {
  const map: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444", critical: "#dc2626" };
  return map[level || "medium"] || "#f59e0b";
}

function getCategoryProgress(cat: NIS2Category): number {
  const applicable = cat.items.filter(i => i.status !== "not_applicable");
  if (applicable.length === 0) return 100;
  return Math.round((applicable.filter(i => i.status === "implemented").length / applicable.length) * 100);
}

function getOverallProgress(categories: NIS2Category[]): number {
  const all = categories.flatMap(c => c.items).filter(i => i.status !== "not_applicable");
  if (all.length === 0) return 0;
  return Math.round((all.filter(i => i.status === "implemented").length / all.length) * 100);
}

// Map NIS2 categories to NIST framework phases
function getNistMapping(): { phase: string; color: string; bgColor: string; categories: string[]; items: string[] }[] {
  return [
    { phase: "Identify", color: "#2563eb", bgColor: "#dbeafe", categories: ["Governance & Risikostyring", "Leverandørsikkerhed"], items: ["Asset Management", "Risikovurdering", "Governance", "Forsyningskæde"] },
    { phase: "Protect", color: "#d97706", bgColor: "#fef3c7", categories: ["Adgangskontrol", "HR-sikkerhed & Awareness", "Kryptografi", "Netværkssikkerhed"], items: ["Adgangskontrol", "Awareness-træning", "Kryptering", "Endpoint-beskyttelse"] },
    { phase: "Detect", color: "#7c3aed", bgColor: "#ede9fe", categories: ["Sårbarhedshåndtering"], items: ["Sårbarhedsscanning", "Overvågning", "Detektionsprocesser"] },
    { phase: "Respond", color: "#dc2626", bgColor: "#fee2e2", categories: ["Incident Håndtering"], items: ["Incident Response", "24t Rapportering", "Analyse", "Mitigering"] },
    { phase: "Recover", color: "#16a34a", bgColor: "#dcfce7", categories: ["Business Continuity"], items: ["Recovery-planer", "Backup-strategi", "DR-test", "Kommunikation"] },
  ];
}

function generateHtml(plan: NIS2Plan, customerName: string, customerLogo?: string): string {
  const categories = plan.categories || [];
  const overallProgress = getOverallProgress(categories);
  const nistPhases = getNistMapping();

  const logoSection = customerLogo
    ? `<img src="${customerLogo}" alt="${escapeHtml(customerName)} logo" class="logo" />`
    : `<div class="logo-placeholder">${escapeHtml(customerName.charAt(0))}</div>`;

  const categoriesHtml = categories.map(cat => {
    const progress = getCategoryProgress(cat);
    const itemsHtml = cat.items.map(item => {
      const color = getStatusColor(item.status);
      const label = getStatusLabel(item.status);
      return `
        <div class="item-row">
          <div class="status-dot" style="background:${color}"></div>
          <div class="item-content">
            <div class="item-text">${escapeHtml(item.text)}</div>
            ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
          </div>
          <span class="status-badge" style="background:${color}15;color:${color};border:1px solid ${color}30">${label}</span>
        </div>`;
    }).join('');

    return `
      <div class="category-card">
        <div class="category-header">
          <div>
            <h3 class="category-title">${escapeHtml(cat.title)}</h3>
            <p class="category-desc">${escapeHtml(cat.description)}</p>
          </div>
          <div class="category-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%;background:${progress===100?'#10b981':progress>50?'#f59e0b':'#ef4444'}"></div></div>
            <span class="progress-text">${progress}%</span>
          </div>
        </div>
        <div class="items-list">${itemsHtml}</div>
      </div>`;
  }).join('');

  // Status counts
  const allItems = categories.flatMap(c => c.items);
  const counts = {
    implemented: allItems.filter(i => i.status === "implemented").length,
    in_progress: allItems.filter(i => i.status === "in_progress").length,
    not_started: allItems.filter(i => i.status === "not_started").length,
    not_applicable: allItems.filter(i => i.status === "not_applicable").length,
  };

  // NIST Framework graphic
  const nistArrowsHtml = nistPhases.map((p, i) => `
    <div class="nist-phase" style="--phase-color:${p.color};--phase-bg:${p.bgColor}">
      <div class="nist-arrow">
        <div class="nist-arrow-body">${p.phase}</div>
        <div class="nist-arrow-point"></div>
      </div>
      <ul class="nist-items">${p.items.map(item => `<li>${item}</li>`).join('')}</ul>
      <div class="nist-bar" style="background:${p.color}">${p.categories[0]}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <title>NIS2 Sikkerhedsplan - ${escapeHtml(customerName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;line-height:1.6;color:#1a1a2e;background:#fff}
    .container{max-width:820px;margin:0 auto;padding:40px}
    
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:24px;border-bottom:3px solid #2563eb}
    .title{font-size:26px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
    .subtitle{font-size:14px;color:#6b7280}
    .badges{display:flex;gap:8px;margin-top:8px}
    .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .logo{max-height:70px;max-width:180px;object-fit:contain}
    .logo-placeholder{width:70px;height:70px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff}

    /* NIS2 Intro */
    .nis2-intro{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:12px;padding:24px;margin-bottom:28px}
    .nis2-intro h2{font-size:16px;font-weight:700;color:#1e40af;margin-bottom:8px}
    .nis2-intro p{font-size:13px;color:#374151;line-height:1.7}

    /* NIST Framework */
    .nist-section{margin-bottom:32px}
    .nist-section h2{font-size:16px;font-weight:700;margin-bottom:16px;color:#1a1a2e}
    .nist-framework{display:flex;gap:2px;width:100%}
    .nist-phase{flex:1;text-align:center}
    .nist-arrow{position:relative;display:flex;align-items:center;margin-bottom:10px}
    .nist-arrow-body{background:var(--phase-color);color:#fff;font-weight:700;font-size:13px;padding:10px 8px 10px 14px;flex:1;clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)}
    .nist-phase:first-child .nist-arrow-body{clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%);border-radius:6px 0 0 6px}
    .nist-phase:last-child .nist-arrow-body{clip-path:polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%);border-radius:0 6px 6px 0}
    .nist-arrow-point{display:none}
    .nist-items{list-style:none;padding:0;text-align:left;padding-left:8px}
    .nist-items li{font-size:10px;color:#374151;padding:2px 0;position:relative;padding-left:10px}
    .nist-items li::before{content:"■";color:var(--phase-color);position:absolute;left:0;font-size:7px;top:3px}
    .nist-bar{color:#fff;font-size:9px;font-weight:600;padding:4px 6px;border-radius:4px;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    /* Progress overview */
    .overview{background:#f8fafc;border-radius:14px;padding:24px;margin-bottom:28px}
    .overview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .overview h2{font-size:18px;font-weight:700}
    .progress-big{font-size:36px;font-weight:800;color:${overallProgress===100?'#10b981':'#2563eb'}}
    .progress-bar-big{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden;margin-bottom:16px}
    .progress-fill-big{height:100%;border-radius:5px;background:${overallProgress===100?'#10b981':'#2563eb'};transition:width .5s}
    .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .stat-card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
    .stat-num{font-size:22px;font-weight:700}
    .stat-label{font-size:10px;color:#6b7280;margin-top:2px}

    /* Responsible */
    .responsible{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px}
    .responsible h3{font-size:14px;font-weight:700;color:#166534;margin-bottom:10px}
    .responsible-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .responsible-item label{font-size:10px;color:#6b7280;display:block}
    .responsible-item span{font-size:13px;font-weight:600}

    /* Categories */
    .category-card{border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden;page-break-inside:avoid}
    .category-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
    .category-title{font-size:14px;font-weight:700;color:#1a1a2e}
    .category-desc{font-size:11px;color:#6b7280;margin-top:2px}
    .category-progress{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .progress-bar{width:80px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
    .progress-fill{height:100%;border-radius:3px}
    .progress-text{font-size:12px;font-weight:700;min-width:32px;text-align:right}
    .items-list{padding:12px 20px}
    .item-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6}
    .item-row:last-child{border-bottom:none}
    .status-dot{width:8px;height:8px;border-radius:50%;margin-top:7px;flex-shrink:0}
    .item-content{flex:1;min-width:0}
    .item-text{font-size:12px;color:#1a1a2e}
    .item-notes{font-size:11px;color:#6b7280;font-style:italic;margin-top:2px}
    .status-badge{font-size:9px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0}

    /* Review & Notes */
    .review-section{background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:20px}
    .review-section h2{font-size:16px;font-weight:700;margin-bottom:14px}
    .review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .review-item{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
    .review-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .review-value{font-size:13px;font-weight:600}
    .notes-box{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:16px}
    .notes-box h4{font-size:12px;font-weight:600;margin-bottom:6px}
    .notes-box p{font-size:12px;color:#4b5563;white-space:pre-wrap}

    .footer{margin-top:30px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af}

    @media print{
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .container{padding:20px}
      .category-card,.review-section,.nis2-intro,.nist-section{break-inside:avoid}
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div>
        <h1 class="title">${escapeHtml(plan.title)}</h1>
        <p class="subtitle">NIS2 Sikkerhedsplan for ${escapeHtml(customerName)}</p>
        <div class="badges">
          <span class="badge" style="background:#dbeafe;color:#1e40af">Version ${plan.version}</span>
          <span class="badge" style="background:${plan.status==='active'?'#dcfce7':'#f3f4f6'};color:${plan.status==='active'?'#166534':'#6b7280'}">${plan.status==='active'?'Aktiv':plan.status==='draft'?'Kladde':'Arkiveret'}</span>
          <span class="badge" style="background:${getRiskColor(plan.risk_level)}15;color:${getRiskColor(plan.risk_level)}">${getRiskLabel(plan.risk_level)} risiko</span>
        </div>
      </div>
      ${logoSection}
    </header>

    <!-- NIS2 Introduction -->
    <div class="nis2-intro">
      <h2>Hvad er NIS2?</h2>
      <p>NIS2-direktivet (Network and Information Security Directive 2) er EU's opdaterede rammelovgivning for cybersikkerhed, som trådte i kraft i januar 2023 og skal implementeres i national lovgivning senest oktober 2024. Direktivet stiller skærpede krav til organisationers cybersikkerhed inden for risikostyring, incident-håndtering, forretningskontinuitet, forsyningskædesikkerhed og ledelsesansvar. Manglende overholdelse kan medføre bøder op til €10 mio. eller 2% af global omsætning. Denne plan kortlægger organisationens compliance-status på tværs af alle NIS2-kravområder.</p>
    </div>

    <!-- NIST Framework Graphic -->
    <div class="nist-section">
      <h2>NIST Cybersecurity Framework — Tilknytning til NIS2</h2>
      <div class="nist-framework">${nistArrowsHtml}</div>
    </div>

    <!-- Overall Progress -->
    <div class="overview">
      <div class="overview-header">
        <h2>Samlet NIS2 Compliance</h2>
        <div class="progress-big">${overallProgress}%</div>
      </div>
      <div class="progress-bar-big"><div class="progress-fill-big" style="width:${overallProgress}%"></div></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num" style="color:#10b981">${counts.implemented}</div><div class="stat-label">Implementeret</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#f59e0b">${counts.in_progress}</div><div class="stat-label">I gang</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#9ca3af">${counts.not_started}</div><div class="stat-label">Ikke startet</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#d1d5db">${counts.not_applicable}</div><div class="stat-label">Ikke relevant</div></div>
      </div>
    </div>

    ${plan.responsible_person ? `
    <div class="responsible">
      <h3>Ansvarlig for NIS2 Compliance</h3>
      <div class="responsible-grid">
        <div class="responsible-item"><label>Navn</label><span>${escapeHtml(plan.responsible_person)}</span></div>
        ${plan.responsible_role ? `<div class="responsible-item"><label>Rolle</label><span>${escapeHtml(plan.responsible_role)}</span></div>` : ''}
        ${plan.responsible_email ? `<div class="responsible-item"><label>Email</label><span>${escapeHtml(plan.responsible_email)}</span></div>` : ''}
        ${plan.responsible_phone ? `<div class="responsible-item"><label>Telefon</label><span>${escapeHtml(plan.responsible_phone)}</span></div>` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Categories -->
    ${categoriesHtml}

    <!-- Review -->
    <div class="review-section">
      <h2>Gennemgang</h2>
      <div class="review-grid">
        <div class="review-item"><p class="review-label">Sidst gennemgået</p><p class="review-value">${formatDate(plan.last_reviewed_at)}</p></div>
        <div class="review-item"><p class="review-label">Gennemgået af</p><p class="review-value">${escapeHtml(plan.last_reviewed_by || 'Ikke angivet')}</p></div>
        <div class="review-item"><p class="review-label">Næste gennemgang</p><p class="review-value">${formatDate(plan.next_review_at)}</p></div>
      </div>
      ${plan.additional_notes ? `
      <div class="notes-box">
        <h4>Yderligere noter / Samlet vurdering</h4>
        <p>${escapeHtml(plan.additional_notes)}</p>
      </div>
      ` : ''}
    </div>

    <footer class="footer">
      <span>Oprettet: ${formatDate(plan.created_at)}</span>
      <span>Sidst opdateret: ${formatDate(plan.updated_at)}</span>
    </footer>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { plan, customerName, customerLogo } = await req.json();
    if (!plan) throw new Error("Plan data is required");

    const html = generateHtml(plan, customerName, customerLogo);
    return new Response(html, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    console.error('generate-nis2-plan-pdf error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
