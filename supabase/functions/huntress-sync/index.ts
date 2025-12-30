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
  last_survey_at?: string;
  agent_version?: string;
  domain?: string;
  account?: {
    name: string;
  };
  organization?: {
    name: string;
  };
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
  affected_hosts?: string[];
  remediation_steps?: string;
  indicators?: Record<string, unknown>;
  timeline?: Record<string, unknown>[];
}

interface HuntressReport {
  id: string;
  report_type: string;
  generated_at: string;
}

interface HuntressSignal {
  id: string;
  signal_type: string;
  hostname: string;
  detected_at: string;
}

interface HuntressEscalation {
  id: string;
  title?: string;
  type?: string;
  status: string;
  severity: string;
  affected_host?: string;
  created_at: string;
  organizations?: Array<{ id: number; name: string }>;
}

interface HuntressBilling {
  id: string;
  period_start: string;
  period_end: string;
  endpoints_count: number;
  total_amount: number;
  currency: string;
}

interface HuntressSummaryReport {
  id: string;
  report_period: string;
  report_type: string;
  summary_data: Record<string, unknown>;
  pdf_url?: string;
  generated_at: string;
}

interface SyncOptions {
  incidents: boolean;
  agents: boolean;
  reports: boolean;
  signals: boolean;
  escalations: boolean;
  billing: boolean;
  summaries: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { integrationId, syncOptions: requestSyncOptions } = await req.json();

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

    // Use sync options from request or from integration settings
    const defaultOptions: SyncOptions = {
      incidents: true,
      agents: true,
      reports: true,
      signals: true,
      escalations: true,
      billing: false,
      summaries: true,
    };
    
    const storedOptions = integration.sync_options as Record<string, boolean> | null;
    const syncOptions: SyncOptions = requestSyncOptions || {
      ...defaultOptions,
      ...storedOptions,
    };

    console.log("Sync options:", syncOptions);

    // Update sync status to syncing
    await supabase
      .from("huntress_integrations")
      .update({ sync_status: "syncing", sync_error: null })
      .eq("id", integrationId);

    // Use Basic Auth with API key and secret
    const basicAuth = btoa(`${integration.public_key}:${integration.private_key}`);
    const headers = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    let incidentsData: HuntressIncident[] = [];
    let agentsData: HuntressAgent[] = [];
    let reportsData: HuntressReport[] = [];
    let signalsData: HuntressSignal[] = [];
    let escalationsData: HuntressEscalation[] = [];
    let billingData: HuntressBilling[] = [];
    let summariesData: HuntressSummaryReport[] = [];
    let syncErrors: string[] = [];

    const baseUrl = "https://api.huntress.io/v1";
    const orgFilter = integration.organization_id ? `organization_id=${integration.organization_id}` : "";

    // Fetch incidents
    if (syncOptions.incidents) {
      try {
        console.log("Fetching incidents from Huntress API...");
        const incidentsUrl = orgFilter 
          ? `${baseUrl}/incident_reports?${orgFilter}`
          : `${baseUrl}/incident_reports`;
        
        console.log("Incidents URL:", incidentsUrl);
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
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching incidents:", error);
        syncErrors.push(`Incidents: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch agents
    if (syncOptions.agents) {
      try {
        console.log("Fetching agents from Huntress API...");
        const agentsUrl = orgFilter 
          ? `${baseUrl}/agents?${orgFilter}`
          : `${baseUrl}/agents`;
        
        console.log("Agents URL:", agentsUrl);
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
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching agents:", error);
        syncErrors.push(`Agents: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch reports
    if (syncOptions.reports) {
      try {
        console.log("Fetching reports from Huntress API...");
        const reportsUrl = orgFilter 
          ? `${baseUrl}/reports?${orgFilter}`
          : `${baseUrl}/reports`;
        
        console.log("Reports URL:", reportsUrl);
        const reportsResponse = await fetch(reportsUrl, { headers });
        
        if (reportsResponse.ok) {
          const reportsJson = await reportsResponse.json();
          reportsData = reportsJson.reports || reportsJson.data || [];
          console.log(`Fetched ${reportsData.length} reports`);
        } else {
          const errorText = await reportsResponse.text();
          console.error("Reports fetch failed:", reportsResponse.status, errorText);
          if (reportsResponse.status !== 404) {
            syncErrors.push(`Reports: ${reportsResponse.status}`);
          }
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching reports:", error);
        syncErrors.push(`Reports: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch signals (using footholds endpoint as signals)
    if (syncOptions.signals) {
      try {
        console.log("Fetching footholds/signals from Huntress API...");
        const signalsUrl = orgFilter 
          ? `${baseUrl}/footholds?${orgFilter}`
          : `${baseUrl}/footholds`;
        
        console.log("Signals URL:", signalsUrl);
        const signalsResponse = await fetch(signalsUrl, { headers });
        
        if (signalsResponse.ok) {
          const signalsJson = await signalsResponse.json();
          signalsData = signalsJson.footholds || signalsJson.data || [];
          console.log(`Fetched ${signalsData.length} signals`);
        } else {
          const errorText = await signalsResponse.text();
          console.error("Signals fetch failed:", signalsResponse.status, errorText);
          if (signalsResponse.status !== 404) {
            syncErrors.push(`Signals: ${signalsResponse.status}`);
          }
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching signals:", error);
        syncErrors.push(`Signals: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch escalations
    if (syncOptions.escalations) {
      try {
        console.log("Fetching escalations from Huntress API...");
        const escalationsUrl = orgFilter 
          ? `${baseUrl}/escalations?${orgFilter}`
          : `${baseUrl}/escalations`;
        
        console.log("Escalations URL:", escalationsUrl);
        const escalationsResponse = await fetch(escalationsUrl, { headers });
        
        if (escalationsResponse.ok) {
          const escalationsJson = await escalationsResponse.json();
          escalationsData = escalationsJson.escalations || escalationsJson.data || [];
          console.log(`Fetched ${escalationsData.length} escalations`);
        } else {
          const errorText = await escalationsResponse.text();
          console.error("Escalations fetch failed:", escalationsResponse.status, errorText);
          if (escalationsResponse.status !== 404) {
            syncErrors.push(`Escalations: ${escalationsResponse.status}`);
          }
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching escalations:", error);
        syncErrors.push(`Escalations: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch billing (if enabled - usually requires special permissions)
    if (syncOptions.billing) {
      try {
        console.log("Fetching billing from Huntress API...");
        const billingUrl = `${baseUrl}/billing_reports`;
        
        console.log("Billing URL:", billingUrl);
        const billingResponse = await fetch(billingUrl, { headers });
        
        if (billingResponse.ok) {
          const billingJson = await billingResponse.json();
          billingData = billingJson.billing_reports || billingJson.data || [];
          console.log(`Fetched ${billingData.length} billing records`);
        } else {
          const errorText = await billingResponse.text();
          console.error("Billing fetch failed:", billingResponse.status, errorText);
          if (billingResponse.status !== 404 && billingResponse.status !== 403) {
            syncErrors.push(`Billing: ${billingResponse.status}`);
          }
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching billing:", error);
        syncErrors.push(`Billing: ${error?.message || "Unknown error"}`);
      }
    }

    // Fetch summary reports
    if (syncOptions.summaries) {
      try {
        console.log("Fetching summary reports from Huntress API...");
        const summariesUrl = orgFilter 
          ? `${baseUrl}/summary_reports?${orgFilter}`
          : `${baseUrl}/summary_reports`;
        
        console.log("Summaries URL:", summariesUrl);
        const summariesResponse = await fetch(summariesUrl, { headers });
        
        if (summariesResponse.ok) {
          const summariesJson = await summariesResponse.json();
          summariesData = summariesJson.summary_reports || summariesJson.data || [];
          console.log(`Fetched ${summariesData.length} summary reports`);
        } else {
          const errorText = await summariesResponse.text();
          console.error("Summaries fetch failed:", summariesResponse.status, errorText);
          if (summariesResponse.status !== 404) {
            syncErrors.push(`Summaries: ${summariesResponse.status}`);
          }
        }
      } catch (e: unknown) {
        const error = e as Error;
        console.error("Error fetching summaries:", error);
        syncErrors.push(`Summaries: ${error?.message || "Unknown error"}`);
      }
    }

    // Store incidents with extended fields
    if (syncOptions.incidents && incidentsData.length > 0) {
      console.log("Storing incidents...");
      
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
        affected_hosts: incident.affected_hosts || [],
        remediation_steps: incident.remediation_steps,
        indicators: incident.indicators,
        timeline: incident.timeline,
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

    // Store agents with extended fields
    if (syncOptions.agents && agentsData.length > 0) {
      console.log("Storing agents...");
      
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
        last_survey_at: agent.last_survey_at,
        agent_version: agent.agent_version,
        domain: agent.domain,
        account_name: agent.account?.name,
        organization_name: agent.organization?.name,
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

    // Store reports
    if (syncOptions.reports && reportsData.length > 0) {
      console.log("Storing reports...");
      
      await supabase
        .from("huntress_reports")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const reportsToInsert = reportsData.map((report: HuntressReport) => ({
        huntress_integration_id: integrationId,
        huntress_report_id: String(report.id),
        report_type: report.report_type,
        generated_at: report.generated_at,
        raw_data: report,
      }));

      const { error: insertReportsError } = await supabase
        .from("huntress_reports")
        .insert(reportsToInsert);

      if (insertReportsError) {
        console.error("Error inserting reports:", insertReportsError);
        syncErrors.push(`Insert reports: ${insertReportsError.message}`);
      }
    }

    // Store signals
    if (syncOptions.signals && signalsData.length > 0) {
      console.log("Storing signals...");
      
      await supabase
        .from("huntress_signals")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const signalsToInsert = signalsData.map((signal: HuntressSignal) => ({
        huntress_integration_id: integrationId,
        huntress_signal_id: String(signal.id),
        signal_type: signal.signal_type,
        hostname: signal.hostname,
        detected_at: signal.detected_at,
        raw_data: signal,
      }));

      const { error: insertSignalsError } = await supabase
        .from("huntress_signals")
        .insert(signalsToInsert);

      if (insertSignalsError) {
        console.error("Error inserting signals:", insertSignalsError);
        syncErrors.push(`Insert signals: ${insertSignalsError.message}`);
      }
    }

    // Store escalations
    if (syncOptions.escalations && escalationsData.length > 0) {
      console.log("Storing escalations...");
      
      await supabase
        .from("huntress_escalations")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const escalationsToInsert = escalationsData.map((escalation: HuntressEscalation) => ({
        huntress_integration_id: integrationId,
        huntress_escalation_id: String(escalation.id),
        title: escalation.type || escalation.title || "Unknown",
        status: escalation.status,
        severity: escalation.severity,
        affected_host: escalation.organizations?.[0]?.name || escalation.affected_host,
        detected_at: escalation.created_at,
        raw_data: escalation,
      }));

      const { error: insertEscalationsError } = await supabase
        .from("huntress_escalations")
        .insert(escalationsToInsert);

      if (insertEscalationsError) {
        console.error("Error inserting escalations:", insertEscalationsError);
        syncErrors.push(`Insert escalations: ${insertEscalationsError.message}`);
      }
    }

    // Store billing
    if (syncOptions.billing && billingData.length > 0) {
      console.log("Storing billing...");
      
      await supabase
        .from("huntress_billing")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const billingToInsert = billingData.map((billing: HuntressBilling) => ({
        huntress_integration_id: integrationId,
        period_start: billing.period_start,
        period_end: billing.period_end,
        endpoints_count: billing.endpoints_count,
        total_amount: billing.total_amount,
        currency: billing.currency || "USD",
        raw_data: billing,
      }));

      const { error: insertBillingError } = await supabase
        .from("huntress_billing")
        .insert(billingToInsert);

      if (insertBillingError) {
        console.error("Error inserting billing:", insertBillingError);
        syncErrors.push(`Insert billing: ${insertBillingError.message}`);
      }
    }

    // Store summary reports
    if (syncOptions.summaries && summariesData.length > 0) {
      console.log("Storing summary reports...");
      
      await supabase
        .from("huntress_summary_reports")
        .delete()
        .eq("huntress_integration_id", integrationId);

      const summariesToInsert = summariesData.map((summary: HuntressSummaryReport) => ({
        huntress_integration_id: integrationId,
        huntress_report_id: String(summary.id),
        report_period: summary.report_period,
        report_type: summary.report_type,
        summary_data: summary.summary_data,
        pdf_url: summary.pdf_url,
        generated_at: summary.generated_at,
        raw_data: summary,
      }));

      const { error: insertSummariesError } = await supabase
        .from("huntress_summary_reports")
        .insert(summariesToInsert);

      if (insertSummariesError) {
        console.error("Error inserting summaries:", insertSummariesError);
        syncErrors.push(`Insert summaries: ${insertSummariesError.message}`);
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
        reports_count: reportsData.length,
        signals_count: signalsData.length,
        escalations_count: escalationsData.length,
        billing_count: billingData.length,
        summaries_count: summariesData.length,
        critical_incidents: criticalIncidents,
        high_incidents: highIncidents,
        errors: syncErrors.length > 0 ? syncErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Huntress sync error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
