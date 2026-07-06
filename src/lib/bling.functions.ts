/**
 * Bling ERP integration — server functions.
 *
 * Bling is the operational ERP: source-of-truth (opcional) for produtos, imagens, estoque,
 * preços B2C, clientes e destino dos pedidos.
 * O site controla preços B2B, promoções, cupons, vendedores, IA A&S Business e app futuro.
 *
 * Secrets esperados (Lovable Cloud → Secrets):
 *   BLING_CLIENT_ID      — Client ID do app registrado em developer.bling.com.br
 *   BLING_CLIENT_SECRET  — Client Secret
 *   BLING_WEBHOOK_SECRET — Assinatura HMAC dos webhooks
 *
 * O callback OAuth vive em /api/public/bling/callback (server route público).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BLING_AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden");
}

async function log(
  supabase: any,
  args: {
    entity: "produto" | "imagem" | "estoque" | "preco" | "cliente" | "pedido";
    entity_id?: string | null;
    action: string;
    status?: "pendente" | "sucesso" | "erro";
    message?: string;
    payload?: any;
  },
) {
  await supabase.from("bling_sync_logs").insert({
    entity: args.entity,
    entity_id: args.entity_id ?? null,
    action: args.action,
    status: args.status ?? "pendente",
    message: args.message ?? null,
    payload: args.payload ?? null,
  });
}

/* ================================================================== *
 * Conexão / OAuth
 * ================================================================== */

export const getBlingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await (context.supabase as any)
      .from("bling_config")
      .select(
        "id,active,last_authorized_at,last_test_at,last_test_status,expires_at,scope,sync_prices,sync_stock,hide_out_of_stock,image_overwrites_manual,manual_price_overrides,source_products,source_stock,source_price_b2c,auto_sync,sync_interval_minutes,redirect_uri",
      )
      .limit(1)
      .maybeSingle();

    // Client id/secret são secrets; nunca retornar valores brutos.
    const clientIdConfigured = !!process.env.BLING_CLIENT_ID;
    const clientSecretConfigured = !!process.env.BLING_CLIENT_SECRET;

    let connectionStatus: "connected" | "disconnected" | "error" | "configuring" = "disconnected";
    if (data?.last_test_status === "erro") connectionStatus = "error";
    else if (data?.last_authorized_at && data?.expires_at && new Date(data.expires_at) > new Date())
      connectionStatus = "connected";
    else if (data?.last_authorized_at) connectionStatus = "configuring";

    return {
      config: data ?? null,
      clientIdConfigured,
      clientSecretConfigured,
      connectionStatus,
    };
  });

export const getBlingAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { redirectUri: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const clientId = process.env.BLING_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "BLING_CLIENT_ID não configurado. Adicione os secrets BLING_CLIENT_ID e BLING_CLIENT_SECRET nas configurações do backend.",
      );
    }
    await (context.supabase as any)
      .from("bling_config")
      .update({ redirect_uri: data.redirectUri, updated_at: new Date().toISOString() })
      .eq("id", (await (context.supabase as any).from("bling_config").select("id").limit(1).single()).data.id);

    const state = crypto.randomUUID();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: data.redirectUri,
      state,
    });
    return { url: `${BLING_AUTHORIZE_URL}?${params.toString()}` };
  });

export const testBlingConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await (context.supabase as any)
      .from("bling_config")
      .select("id,access_token,expires_at")
      .limit(1)
      .maybeSingle();

    let status: "sucesso" | "erro" = "erro";
    let message = "Sem access_token — conecte-se ao Bling primeiro.";
    if (cfg?.access_token && cfg.expires_at && new Date(cfg.expires_at) > new Date()) {
      status = "sucesso";
      message = "Token válido. Conexão com Bling operacional.";
    } else if (cfg?.access_token) {
      status = "erro";
      message = "Access token expirado — renove a conexão.";
    }

    await (context.supabase as any)
      .from("bling_config")
      .update({ last_test_at: new Date().toISOString(), last_test_status: status })
      .eq("id", cfg?.id);

    await log(context.supabase, { entity: "produto", action: "test_connection", status, message });
    return { status, message };
  });

export const revokeBlingConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await (context.supabase as any).from("bling_config").select("id").limit(1).single();
    await (context.supabase as any)
      .from("bling_config")
      .update({
        access_token: null,
        refresh_token: null,
        expires_at: null,
        last_authorized_at: null,
        last_test_status: null,
      })
      .eq("id", cfg.id);
    await log(context.supabase, {
      entity: "produto",
      action: "revoke",
      status: "sucesso",
      message: "Conexão com Bling revogada.",
    });
    return { ok: true };
  });

/* ================================================================== *
 * Config toggles
 * ================================================================== */

export const updateBlingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      active?: boolean;
      source_products?: boolean;
      source_stock?: boolean;
      source_price_b2c?: boolean;
      auto_sync?: boolean;
      sync_interval_minutes?: number;
      sync_prices?: boolean;
      sync_stock?: boolean;
      hide_out_of_stock?: boolean;
      image_overwrites_manual?: boolean;
      manual_price_overrides?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await (context.supabase as any).from("bling_config").select("id").limit(1).single();
    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of Object.keys(data)) if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    const { error } = await (context.supabase as any).from("bling_config").update(patch).eq("id", cfg.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ================================================================== *
 * Sync stubs — reais serão implementados quando o OAuth estiver ativo.
 * Cada função registra um log e retorna imediatamente.
 * ================================================================== */

// Cada server fn precisa ser criada no top-level: o code-splitter do TanStack
// só remove o handler do bundle do cliente quando `createServerFn` é chamado
// diretamente no escopo do módulo. Fábricas deixariam o handler rodar no
// navegador — onde `context.supabase` é undefined e explode com
// "Cannot read properties of undefined (reading 'from')".
async function runSyncStub(
  supabase: any,
  userId: string,
  entity: "produto" | "imagem" | "estoque" | "preco" | "cliente" | "pedido",
  action: string,
) {
  await assertAdmin(supabase, userId);
  const { data: cfg } = await supabase
    .from("bling_config")
    .select("access_token,expires_at,active")
    .limit(1)
    .maybeSingle();
  const hasToken = !!(cfg?.access_token && cfg.expires_at && new Date(cfg.expires_at) > new Date());
  const status: "pendente" | "erro" = hasToken ? "pendente" : "erro";
  const message = hasToken
    ? `Sincronização de ${entity} enfileirada.`
    : `Falha: conexão com Bling não estabelecida. Autorize antes de sincronizar ${entity}.`;
  await log(supabase, { entity, action, status, message });
  return { ok: hasToken, message };
}

export const syncBlingProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "produto", "sync_all"));

export const syncBlingImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "imagem", "sync_all"));

export const syncBlingStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "estoque", "sync_all"));

export const syncBlingPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "preco", "sync_all"));

export const syncBlingCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "cliente", "sync_all"));

export const sendPendingOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => runSyncStub(context.supabase, context.userId, "pedido", "send_pending"));

/* ================================================================== *
 * Reprocess a specific log
 * ================================================================== */

export const reprocessBlingLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { log_id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: original, error } = await (context.supabase as any)
      .from("bling_sync_logs")
      .select("entity,entity_id,action,payload")
      .eq("id", data.log_id)
      .single();
    if (error || !original) throw new Error(error?.message ?? "Log não encontrado");
    await log(context.supabase, {
      entity: original.entity,
      entity_id: original.entity_id,
      action: `${original.action}:retry`,
      status: "pendente",
      message: "Reprocessamento solicitado manualmente.",
      payload: original.payload,
    });
    return { ok: true };
  });

/* ================================================================== *
 * Aggregate stats for tab headers
 * ================================================================== */

export const getBlingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase as any;
    const [{ count: total }, { count: errors }, { count: pending }] = await Promise.all([
      sb.from("bling_sync_logs").select("*", { count: "exact", head: true }),
      sb.from("bling_sync_logs").select("*", { count: "exact", head: true }).eq("status", "erro"),
      sb.from("bling_sync_logs").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    ]);
    return { total: total ?? 0, errors: errors ?? 0, pending: pending ?? 0 };
  });
