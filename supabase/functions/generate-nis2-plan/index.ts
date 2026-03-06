import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customerId, customerName } = await req.json();
    if (!customerId) throw new Error("customerId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization")!;

    // Fetch all security reports for this customer
    const reportsRes = await fetch(`${SUPABASE_URL}/rest/v1/security_reports?customer_id=eq.${customerId}&analysis_status=eq.completed&select=*`, {
      headers: {
        "Authorization": authHeader,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });
    const reports = await reportsRes.json();

    if (!reports || reports.length === 0) {
      return new Response(JSON.stringify({ error: "Ingen analyserede sikkerhedsrapporter fundet for denne kunde." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a summary of all report findings
    const reportSummaries = reports.map((r: any) => {
      const type = r.report_type === "dns_security" ? "DNS Sikkerhedsrapport (Skysnag)"
        : r.report_type === "huntress_threat" ? "Huntress Trusselsrapport"
        : "Microsoft 365 Baseline Rapport";
      return {
        type,
        file_name: r.file_name,
        analysis: r.analysis_result,
        secure_score_current: r.secure_score_current,
        secure_score_predicted: r.secure_score_predicted,
        overall_status_percentage: r.overall_status_percentage,
      };
    });

    const systemPrompt = `Du er en erfaren cybersikkerhedskonsulent specialiseret i NIS2-compliance. 
Du skal analysere sikkerhedsrapporter og generere en detaljeret NIS2-sikkerhedsplan.

Du SKAL returnere data via tool-kaldet generate_nis2_plan. Udfyld ALLE felter baseret på rapporternes indhold.

For hver kategori-item:
- Sæt status til "implemented" hvis rapporten viser at kravet er opfyldt
- Sæt status til "in_progress" hvis der er delvis opfyldelse
- Sæt status til "not_started" hvis kravet ikke er opfyldt eller ikke nævnt
- Sæt status til "not_applicable" KUN hvis kravet virkelig ikke er relevant
- Tilføj detaljerede noter baseret på rapporternes konkrete fund, scores og anbefalinger
- Inkluder specifikke data fra rapporterne (scores, procentdele, fundne problemer)

NIS2 Kategorier og deres items (brug PRÆCIS disse ID'er):
- governance: gov-1 (Sikkerhedspolitik), gov-2 (Årlig risikovurdering), gov-3 (Roller defineret), gov-4 (Ledelsesdeltagelse)
- incident: inc-1 (Incident response plan), inc-2 (24-timers rapportering), inc-3 (Logning/overvågning), inc-4 (CSIRT kontakt)
- continuity: bc-1 (BC plan), bc-2 (DR test), bc-3 (Backup-strategi), bc-4 (RTO defineret)
- supply_chain: sc-1 (Leverandør risikovurdering), sc-2 (Kontraktkrav), sc-3 (Løbende monitorering)
- network: net-1 (Segmentering), net-2 (Firewall/IDS), net-3 (Kryptering), net-4 (Endpoint-beskyttelse)
- vulnerability: vul-1 (Scanning), vul-2 (Patching), vul-3 (Asset inventory)
- access: acc-1 (MFA), acc-2 (Mindste privilegium), acc-3 (Adgangsgennemgang), acc-4 (PAM)
- hr_awareness: hr-1 (Awareness-træning), hr-2 (Phishing-simulationer), hr-3 (On/offboarding)
- crypto: cry-1 (Krypteringspolitik), cry-2 (Nøglehåndtering), cry-3 (TLS 1.2+)`;

    const userPrompt = `Analysér følgende sikkerhedsrapporter for kunden "${customerName}" og generer en komplet NIS2-sikkerhedsplan:

${JSON.stringify(reportSummaries, null, 2)}

Udfyld alle kategorier og items med status og detaljerede noter baseret på rapporternes fund.
Vurder også det overordnede risikoniveau og skriv en samlet vurdering i additional_notes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              name: "generate_nis2_plan",
              description: "Generate a complete NIS2 security plan based on security report analysis",
              parameters: {
                type: "object",
                properties: {
                  risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  additional_notes: { type: "string", description: "Overall assessment and summary of findings" },
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              status: { type: "string", enum: ["not_started", "in_progress", "implemented", "not_applicable"] },
                              notes: { type: "string" },
                            },
                            required: ["id", "status", "notes"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["id", "items"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["risk_level", "additional_notes", "categories"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_nis2_plan" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "For mange forespørgsler, prøv igen om lidt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditter opbrugt." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const planData = JSON.parse(toolCall.function.arguments);

    // Merge AI results with the default category structure
    const DEFAULT_CATEGORIES = [
      { id: "governance", title: "Governance & Risikostyring", description: "Ledelsesansvar, politikker og risikostyringsprocesser", icon: "building",
        items: [
          { id: "gov-1", text: "Informationssikkerhedspolitik er vedtaget og godkendt af ledelsen" },
          { id: "gov-2", text: "Risikovurdering gennemføres mindst årligt" },
          { id: "gov-3", text: "Roller og ansvar for cybersikkerhed er tydeligt defineret" },
          { id: "gov-4", text: "Ledelsen deltager aktivt i sikkerhedsarbejdet" },
        ],
      },
      { id: "incident", title: "Incident Håndtering", description: "Processer for opdagelse, rapportering og håndtering af sikkerhedshændelser", icon: "alert",
        items: [
          { id: "inc-1", text: "Incident response plan er dokumenteret og testet" },
          { id: "inc-2", text: "Sikkerhedshændelser rapporteres inden for 24 timer" },
          { id: "inc-3", text: "Logning og overvågning af kritiske systemer er implementeret" },
          { id: "inc-4", text: "Kontaktoplysninger til CSIRT/myndigheder er opdaterede" },
        ],
      },
      { id: "continuity", title: "Business Continuity", description: "Forretningskontinuitet og disaster recovery", icon: "refresh",
        items: [
          { id: "bc-1", text: "Business continuity plan er dokumenteret" },
          { id: "bc-2", text: "Disaster recovery plan er testet inden for det seneste år" },
          { id: "bc-3", text: "Backup-strategi inkluderer offline/immutable backups" },
          { id: "bc-4", text: "Recovery Time Objective (RTO) er defineret for kritiske systemer" },
        ],
      },
      { id: "supply_chain", title: "Leverandørsikkerhed", description: "Sikkerhed i forsyningskæden og tredjepartsstyring", icon: "link",
        items: [
          { id: "sc-1", text: "Kritiske leverandører er identificeret og risikovurderet" },
          { id: "sc-2", text: "Sikkerhedskrav er inkluderet i leverandørkontrakter" },
          { id: "sc-3", text: "Leverandørers sikkerhedsstatus monitoreres løbende" },
        ],
      },
      { id: "network", title: "Netværks- & Informationssikkerhed", description: "Beskyttelse af netværk, systemer og data", icon: "network",
        items: [
          { id: "net-1", text: "Netværkssegmentering er implementeret" },
          { id: "net-2", text: "Firewall og IDS/IPS er konfigureret og overvåget" },
          { id: "net-3", text: "Kryptering af data in transit og at rest" },
          { id: "net-4", text: "Endpoint-beskyttelse er installeret på alle enheder" },
        ],
      },
      { id: "vulnerability", title: "Sårbarhedshåndtering", description: "Identifikation og håndtering af sårbarheder", icon: "search",
        items: [
          { id: "vul-1", text: "Sårbarhedsscanning gennemføres regelmæssigt" },
          { id: "vul-2", text: "Patches installeres inden for defineret tidsramme" },
          { id: "vul-3", text: "Asset inventory er opdateret og vedligeholdt" },
        ],
      },
      { id: "access", title: "Adgangskontrol", description: "Styring af adgang til systemer og data", icon: "lock",
        items: [
          { id: "acc-1", text: "MFA er aktiveret for alle brugere" },
          { id: "acc-2", text: "Princippet om mindste privilegium følges" },
          { id: "acc-3", text: "Adgangsrettigheder gennemgås minimum kvartalsvis" },
          { id: "acc-4", text: "Privilegerede konti administreres via PAM-løsning" },
        ],
      },
      { id: "hr_awareness", title: "HR-sikkerhed & Awareness", description: "Medarbejdersikkerhed og awareness-træning", icon: "users",
        items: [
          { id: "hr-1", text: "Security awareness-træning gennemføres årligt" },
          { id: "hr-2", text: "Phishing-simulationer gennemføres regelmæssigt" },
          { id: "hr-3", text: "On/offboarding-processer inkluderer sikkerhedsprocedurer" },
        ],
      },
      { id: "crypto", title: "Kryptografi", description: "Brug af kryptering og nøglehåndtering", icon: "key",
        items: [
          { id: "cry-1", text: "Krypteringspolitik er defineret og implementeret" },
          { id: "cry-2", text: "Nøglehåndtering følger anerkendte standarder" },
          { id: "cry-3", text: "TLS 1.2+ anvendes for alle eksterne forbindelser" },
        ],
      },
    ];

    const mergedCategories = DEFAULT_CATEGORIES.map(defaultCat => {
      const aiCat = planData.categories?.find((c: any) => c.id === defaultCat.id);
      return {
        ...defaultCat,
        items: defaultCat.items.map(defaultItem => {
          const aiItem = aiCat?.items?.find((i: any) => i.id === defaultItem.id);
          return {
            ...defaultItem,
            status: aiItem?.status || "not_started",
            notes: aiItem?.notes || "",
          };
        }),
      };
    });

    return new Response(JSON.stringify({
      risk_level: planData.risk_level || "medium",
      additional_notes: planData.additional_notes || "",
      categories: mergedCategories,
      reports_used: reports.map((r: any) => ({ id: r.id, type: r.report_type, file_name: r.file_name })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-nis2-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
