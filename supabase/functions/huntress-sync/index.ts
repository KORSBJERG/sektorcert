import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HuntressAgent {
  id: string;
  hostname: string;
  os_info: {
    display_name: string;
  };
  external_ip: string;
  last_seen_at: string;
  platform?: string;
  antivirus_installed?: boolean;
}

interface HuntressIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  remediation_status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integrationId } = await req.json();

    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "Integration ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting Huntress sync for integration: ${integrationId}`);

    // Get the integration credentials
    const { data: integration, error: integrationError } = await supabase
      .from("huntress_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found:", integrationError);
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update sync status to syncing
    await supabase
      .from("huntress_integrations")
      .update({ sync_status: "syncing", sync_error: null })
      .eq("id", integrationId);

    const authHeader = btoa(`${integration.public_key}:${integration.private_key}`);
    const headers = {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/json",
    };

    let incidentsData: HuntressIncident[] = [];
    let agentsData: HuntressAgent[] = [];
    let syncErrors: string[] = [];

    // Fetch incidents
    try {
      console.log("Fetching incidents from Huntress API...");
      const incidentsUrl = integration.organization_id
        ? `https://api.huntress.io/v1/organizations/${integration.organization_id}/incident_reports`
        : "https://api.huntress.io/v1/incident_reports";
      
      const incidentsResponse = await fetch(incidentsUrl, { headers });
      
      if (incidentsResponse.ok) {
        const incidentsJson = await incidentsResponse.json();
        incidentsData = incidentsJson.incident_reports || incidentsJson.data || [];
        console.log(`Fetched ${incidentsData.length} incidents`);
      } else {
        const errorText = await incidentsResponse.text();
        console.error("Incidents fetch failed:", incidentsResponse.status, errorText);
        syncErrors.push(`Incidents: ${incidentsResponse.status}`);
      }
    } catch (e: any) {
      console.error("Error fetching incidents:", e);
      syncErrors.push(`Incidents: ${e?.message || "Unknown error"}`);
    }

    // Fetch agents
    try {
      console.log("Fetching agents from Huntress API...");
      const agentsUrl = integration.organization_id
        ? `https://api.huntress.io/v1/organizations/${integration.organization_id}/agents`
        : "https://api.huntress.io/v1/agents";
      
      const agentsResponse = await fetch(agentsUrl, { headers });
      
      if (agentsResponse.ok) {
        const agentsJson = await agentsResponse.json();
        agentsData = agentsJson.agents || agentsJson.data || [];
        console.log(`Fetched ${agentsData.length} agents`);
      } else {
        const errorText = await agentsResponse.text();
        console.error("Agents fetch failed:", agentsResponse.status, errorText);
        syncErrors.push(`Agents: ${agentsResponse.status}`);
      }
    } catch (e: any) {
      console.error("Error fetching agents:", e);
      syncErrors.push(`Agents: ${e?.message || "Unknown error"}`);
    }

    // Store incidents
    if (incidentsData.length > 0) {
      console.log("Storing incidents...");
      
      // Clear old incidents first
      await supabase
        .from("huntress_incidents")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const incidentsToInsert = incidentsData.map((incident: HuntressIncident) => ({
        huntress_integration_id: integrationId,
        huntress_incident_id: String(incident.id),
        title: incident.title || "Unknown",
        severity: incident.severity?.toLowerCase() || "unknown",
        status: incident.status || "unknown",
        detected_at: incident.created_at || new Date().toISOString(),
        remediation_status: incident.remediation_status,
        raw_data: incident,
      }));

      const { error: insertIncidentsError } = await supabase
        .from("huntress_incidents")
        .insert(incidentsToInsert);

      if (insertIncidentsError) {
        console.error("Error inserting incidents:", insertIncidentsError);
        syncErrors.push(`Insert incidents: ${insertIncidentsError.message}`);
      }
    }

    // Store agents
    if (agentsData.length > 0) {
      console.log("Storing agents...");
      
      // Clear old agents first
      await supabase
        .from("huntress_agents")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const agentsToInsert = agentsData.map((agent: HuntressAgent) => ({
        huntress_integration_id: integrationId,
        huntress_agent_id: String(agent.id),
        hostname: agent.hostname || "Unknown",
        os_version: agent.os_info?.display_name || agent.platform || "Unknown",
        defender_status: agent.antivirus_installed ? "enabled" : "disabled",
        external_ip: agent.external_ip,
        last_seen_at: agent.last_seen_at,
        raw_data: agent,
      }));

      const { error: insertAgentsError } = await supabase
        .from("huntress_agents")
        .insert(agentsToInsert);

      if (insertAgentsError) {
        console.error("Error inserting agents:", insertAgentsError);
        syncErrors.push(`Insert agents: ${insertAgentsError.message}`);
      }
    }

    // Calculate sync summary
    const criticalIncidents = incidentsData.filter((i: HuntressIncident) => 
      i.severity?.toLowerCase() === "critical"
    ).length;
    const highIncidents = incidentsData.filter((i: HuntressIncident) => 
      i.severity?.toLowerCase() === "high"
    ).length;
    const mediumIncidents = incidentsData.filter((i: HuntressIncident) => 
      i.severity?.toLowerCase() === "medium"
    ).length;
    const lowIncidents = incidentsData.filter((i: HuntressIncident) => 
      i.severity?.toLowerCase() === "low"
    ).length;

    const defenderEnabledCount = agentsData.filter((a: HuntressAgent) => 
      a.antivirus_installed
    ).length;
    const healthyAgentsPercentage = agentsData.length > 0
      ? (defenderEnabledCount / agentsData.length) * 100
      : 0;

    // Store sync results
    const { error: syncResultError } = await supabase
      .from("huntress_sync_results")
      .insert({
        huntress_integration_id: integrationId,
        incidents_count: incidentsData.length,
        critical_incidents: criticalIncidents,
        high_incidents: highIncidents,
        medium_incidents: mediumIncidents,
        low_incidents: lowIncidents,
        agents_count: agentsData.length,
        healthy_agents_percentage: healthyAgentsPercentage,
        defender_enabled_count: defenderEnabledCount,
      });

    if (syncResultError) {
      console.error("Error storing sync results:", syncResultError);
    }

    // Update integration status
    const hasErrors = syncErrors.length > 0;
    await supabase
      .from("huntress_integrations")
      .update({
        sync_status: hasErrors ? "error" : "completed",
        sync_error: hasErrors ? syncErrors.join("; ") : null,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", integrationId);

    console.log("Huntress sync completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        incidents_count: incidentsData.length,
        agents_count: agentsData.length,
        critical_incidents: criticalIncidents,
        high_incidents: highIncidents,
        errors: syncErrors.length > 0 ? syncErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Huntress sync error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
