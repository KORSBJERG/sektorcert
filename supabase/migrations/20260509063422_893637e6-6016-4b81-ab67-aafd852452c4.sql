
-- Deduplicate customers sharing the same huntress_organization_id.
-- Keep the oldest row, repoint related data to it, then delete the others.

WITH ranked AS (
  SELECT id, huntress_organization_id,
         FIRST_VALUE(id) OVER (
           PARTITION BY huntress_organization_id
           ORDER BY created_at ASC, id ASC
         ) AS keep_id
  FROM public.customers
  WHERE huntress_organization_id IS NOT NULL
),
mapping AS (
  SELECT id AS dup_id, keep_id
  FROM ranked
  WHERE id <> keep_id
)
SELECT 1;

-- Helper: build mapping again per UPDATE (CTE not reusable across statements).
-- Repoint child tables.
UPDATE public.assessments a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.customer_documents a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.customer_invitations a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

-- customer_users has unique(customer_id, user_id) implicit? Use ON CONFLICT-safe approach via delete-of-conflicts.
DELETE FROM public.customer_users cu
USING (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m, public.customer_users existing
WHERE cu.customer_id = m.dup_id
  AND m.dup_id <> m.keep_id
  AND existing.customer_id = m.keep_id
  AND existing.user_id = cu.user_id;

UPDATE public.customer_users a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.emergency_plans a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.huntress_sync_data a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.maester_runs a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.nis2_plans a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

UPDATE public.security_reports a
SET customer_id = m.keep_id
FROM (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE a.customer_id = m.dup_id AND m.dup_id <> m.keep_id;

-- Now delete the duplicate customer rows
DELETE FROM public.customers c
USING (
  SELECT id AS dup_id,
         FIRST_VALUE(id) OVER (PARTITION BY huntress_organization_id ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.customers WHERE huntress_organization_id IS NOT NULL
) m
WHERE c.id = m.dup_id AND m.dup_id <> m.keep_id;

-- Prevent future duplicates: unique partial index on huntress_organization_id
CREATE UNIQUE INDEX IF NOT EXISTS customers_huntress_org_unique
  ON public.customers (huntress_organization_id)
  WHERE huntress_organization_id IS NOT NULL;
