import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvr } = await req.json();

    if (!cvr) {
      return new Response(
        JSON.stringify({ error: 'CVR nummer er påkrævet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean CVR number (remove spaces and dashes)
    const cleanCvr = cvr.toString().replace(/[\s-]/g, '');

    console.log(`Looking up CVR: ${cleanCvr}`);

    // Use the free cvrapi.dk API
    const response = await fetch(
      `https://cvrapi.dk/api?search=${cleanCvr}&country=dk`,
      {
        headers: {
          'User-Agent': 'SecurityAssessmentTool/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`CVR API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Kunne ikke finde virksomhed med dette CVR nummer' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('CVR API response:', JSON.stringify(data));

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

    return new Response(
      JSON.stringify(companyData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cvr-lookup:', error);
    return new Response(
      JSON.stringify({ error: 'Der opstod en fejl ved CVR opslag' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
