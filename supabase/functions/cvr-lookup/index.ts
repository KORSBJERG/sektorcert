import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeCvr = (value: unknown) =>
  value
    ?.toString()
    .trim()
    .replace(/^DK/i, '')
    .replace(/\D/g, '') ?? '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvr } = await req.json();
    const cleanCvr = normalizeCvr(cvr);

    if (!cleanCvr) {
      return jsonResponse({ error: 'CVR nummer er påkrævet' });
    }

    if (!/^\d{8}$/.test(cleanCvr)) {
      return jsonResponse({ error: 'CVR nummer skal være 8 cifre' });
    }

    console.log(`Looking up CVR: ${cleanCvr}`);

    const response = await fetch(
      `https://cvrapi.dk/api?search=${cleanCvr}&country=dk`,
      {
        headers: {
          'User-Agent': 'SecurityAssessmentTool/1.0',
        },
      }
    );

    const rawText = await response.text();
    let data: Record<string, unknown> | null = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    console.log('CVR API response:', rawText);

    if (data?.error === 'QUOTA_EXCEEDED') {
      return jsonResponse({
        error: 'CVR opslag er midlertidigt utilgængeligt lige nu. Prøv igen senere eller indtast oplysninger manuelt.',
        code: 'QUOTA_EXCEEDED',
      });
    }

    if (!response.ok) {
      console.error(`CVR API error: ${response.status}`);
      return jsonResponse({ error: 'Kunne ikke finde virksomhed med dette CVR nummer' });
    }

    if (!data || (!data.name && !data.vat)) {
      return jsonResponse({ error: 'Kunne ikke finde virksomhed med dette CVR nummer' });
    }

    // Map the response to our format
    const companyData = {
      name: data.name || null,
      address: data.address ? `${data.address}, ${data.zipcode} ${data.city}` : null,
      phone: data.phone || null,
      email: data.email || null,
      cvr: data.vat || cleanCvr,
      industry: data.industrydesc || null,
      companyType: data.companydesc || null,
      employees: data.employees || null,
      founded: data.founded || null,
      city: data.city || null,
      zipcode: data.zipcode || null,
    };

    return jsonResponse(companyData);

  } catch (error) {
    console.error('Error in cvr-lookup:', error);
    return jsonResponse({ error: 'Der opstod en fejl ved CVR opslag' }, 500);
  }
});
