// Placeholder so this folder is recognized as an edge function context.
// Real document-access logic lives in the `log_document_download` RPC and RLS policies.
// See ./access_test.ts for integration tests.
Deno.serve(() => new Response("ok"));