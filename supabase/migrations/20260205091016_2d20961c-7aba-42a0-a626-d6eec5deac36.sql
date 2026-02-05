-- Drop all Huntress-related tables and their RLS policies
-- Must drop child tables before parent table due to foreign key constraints

-- Drop huntress_agents table
DROP TABLE IF EXISTS public.huntress_agents CASCADE;

-- Drop huntress_billing table
DROP TABLE IF EXISTS public.huntress_billing CASCADE;

-- Drop huntress_escalations table
DROP TABLE IF EXISTS public.huntress_escalations CASCADE;

-- Drop huntress_incidents table
DROP TABLE IF EXISTS public.huntress_incidents CASCADE;

-- Drop huntress_reports table
DROP TABLE IF EXISTS public.huntress_reports CASCADE;

-- Drop huntress_signals table
DROP TABLE IF EXISTS public.huntress_signals CASCADE;

-- Drop huntress_summary_reports table
DROP TABLE IF EXISTS public.huntress_summary_reports CASCADE;

-- Drop huntress_sync_results table
DROP TABLE IF EXISTS public.huntress_sync_results CASCADE;

-- Drop huntress_integrations table (parent table - last)
DROP TABLE IF EXISTS public.huntress_integrations CASCADE;