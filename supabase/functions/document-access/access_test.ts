import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Negative-path integration tests verifying that the document-access surface
 * cannot be used by unauthenticated clients. Positive-path tests for the
 * consultant + invited customer roles require service-role provisioning of
 * test users and are documented in the project README.
 */

Deno.test("anon cannot call log_document_download RPC", async () => {
  const supabase = anonClient();
  const { error } = await supabase.rpc("log_document_download", {
    _document_id: RANDOM_UUID,
  });
  assert(error, "Expected RPC to fail for anonymous caller");
  // Either auth.uid() is null -> 'Not authenticated' or function not exposed
  const msg = (error.message || "").toLowerCase();
  assert(
    msg.includes("not authenticated") ||
      msg.includes("permission") ||
      msg.includes("denied") ||
      msg.includes("not found"),
    `Unexpected error message: ${error.message}`,
  );
});

Deno.test("anon cannot SELECT customer_documents (RLS hides rows)", async () => {
  const supabase = anonClient();
  const { data, error } = await supabase
    .from("customer_documents")
    .select("id")
    .limit(5);
  // RLS returns empty result, not an error
  assertEquals(error, null);
  assertEquals(data, []);
});

Deno.test("anon cannot INSERT into customer_documents", async () => {
  const supabase = anonClient();
  const { error } = await supabase.from("customer_documents").insert({
    customer_id: RANDOM_UUID,
    title: "hack",
    file_name: "x.pdf",
    file_path: `${RANDOM_UUID}/x.pdf`,
    uploaded_by_user_id: RANDOM_UUID,
  });
  assert(error, "Expected INSERT to be blocked by RLS");
});

Deno.test("anon cannot list objects in private customer-documents bucket", async () => {
  const supabase = anonClient();
  const { data, error } = await supabase.storage
    .from("customer-documents")
    .list(RANDOM_UUID);
  // Either an error or an empty list — never real file metadata
  if (!error) {
    assertEquals(data, []);
  }
});

Deno.test("anon cannot create signed URL for arbitrary path", async () => {
  const supabase = anonClient();
  const { data, error } = await supabase.storage
    .from("customer-documents")
    .createSignedUrl(`${RANDOM_UUID}/anything.pdf`, 60);
  assert(error || !data?.signedUrl, "Anon must not get a signed URL");
});

Deno.test("anon cannot call has_role helper directly", async () => {
  const supabase = anonClient();
  const { error } = await supabase.rpc("has_role", {
    _user_id: RANDOM_UUID,
    _role: "admin",
  });
  assert(error, "Expected has_role to be denied for anon");
});

Deno.test("anon cannot call user_has_customer_access directly", async () => {
  const supabase = anonClient();
  const { error } = await supabase.rpc("user_has_customer_access", {
    _user_id: RANDOM_UUID,
    _customer_id: RANDOM_UUID,
  });
  assert(error, "Expected user_has_customer_access to be denied for anon");
});