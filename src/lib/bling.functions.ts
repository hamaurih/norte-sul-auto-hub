/**
 * Bling ERP integration — server function stubs.
 *
 * Structure ready for OAuth 2.0 flow with Bling REST API v3.
 * Real implementation will:
 *   1. Redirect user to https://www.bling.com.br/Api/v3/oauth/authorize
 *   2. Exchange code for access_token + refresh_token
 *   3. Store tokens in public.bling_config
 *   4. On any product/stock/price/order change, call Bling and record in public.bling_sync_logs
 *   5. Receive webhooks at /api/public/webhooks/bling for inbound sync
 *
 * Required future secrets:
 *   BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_WEBHOOK_SECRET
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const blingSyncProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify staff
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "gerente");
    if (!isStaff) throw new Error("Forbidden");

    // TODO: implement OAuth 2.0 call to Bling API v3 /produtos
    await supabase.from("bling_sync_logs").insert({
      entity: "produto",
      entity_id: data.productId,
      action: "sync_out",
      status: "pendente",
      message: "Bling integration not yet configured. Add BLING_CLIENT_ID/BLING_CLIENT_SECRET to enable.",
    });
    return { ok: true, note: "stub" };
  });

export const blingSyncOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("bling_sync_logs").insert({
      entity: "pedido",
      entity_id: data.orderId,
      action: "create",
      status: "pendente",
      message: "Order will be sent to Bling once integration is configured.",
    });
    return { ok: true, note: "stub" };
  });
