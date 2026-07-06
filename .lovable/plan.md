
# Refatoração do /admin — Backoffice Operacional

Escopo grande. Vou entregar em **4 fases**, cada uma auto-contida, aprovadas em sequência (cada fase = 1 migration + telas + edge functions). Assim você valida antes de eu seguir.

---

## Fase 1 — Fundação (schema + segurança + navegação)

**Banco (1 migration):**
- Ampliar `products`: `internal_code`, `short_description`, `sale_price_b2c`, `sale_starts_at`, `sale_ends_at`, `is_new`, `is_bestseller`, `hide_when_out_of_stock`, `min_stock`, `subcategory_id`.
- Nova `promotions` (campos do brief: type, discount_type, discount_value, alvo product/category/brand, customer_group, janela, ativo).
- Nova `coupons` + `coupon_usages` (código, regras, limites, primeira compra, alvo, janela).
- Nova `banner_slots` (enum: home_hero, categoria, b2b, promocao, rodape) + campos `image_mobile_url`, `cta_text`, `audience` (all/b2c/b2b), `starts_at`/`ends_at` em `banners`.
- Nova `bling_config` (tokens OAuth, flags de sync, cron), `bling_sync_logs` já existe — só ampliar.
- Nova `ai_aes_config` (api_url, active, allowed_scopes[]).
- `b2b_registrations`: adicionar `admin_notes`, `info_requested_at`.
- `sales_reps`: adicionar `max_discount_pct`, `can_sell_b2b`, `can_create_customer`, `active`.
- Bucket **Supabase Storage** `product-images` (público) e `banners` (público). RLS: upload só staff.
- Funções `has_role`, `is_staff` já existem — adicionar `is_admin_only(uid)` para gates finos (Bling, config).
- RLS em toda tabela nova + GRANTs.

**RBAC efetivo (não só no menu):**
- Admin: tudo.
- Gerente: tudo exceto Bling/Config/Vendedores admin/IA A&S.
- Vendedor: só `/vendedor/*` (já existe).
- Cliente: nunca `/admin`.
- `beforeLoad` em cada subrota checa role específica.

**Navegação:** Menu lateral novo com 14 itens do brief; rotas placeholder para as fases futuras (aviso "em breve" nas ainda não implementadas) para não quebrar links.

---

## Fase 2 — Produtos + Banners + B2B ampliado

**/admin/produtos** (CRUD completo)
- Lista com busca, filtro (categoria, marca, ativo, estoque), ações inline: editar, duplicar, ativar/desativar, excluir (com confirm), toggles destaque/lançamento/mais vendido.
- Form (rota `/admin/produtos/novo` e `/admin/produtos/$id`) com todos os campos do brief, abas: **Geral**, **Preços & Promoção**, **Estoque**, **Imagens**, **SEO/Tags**.
- Uploader de imagens (Supabase Storage → `product_images`): drag-drop, reordenar (dnd-kit), definir principal, remover.
- Server functions: `productUpsert`, `productDuplicate`, `productDelete`, `productToggle`, `productImageUpload`, `productImageReorder`.

**/admin/banners** (CRUD)
- Grid visual, upload desktop + mobile, todos os campos do brief, drag-reorder, preview.

**/admin/cadastros-b2b** (melhorado)
- Detalhe expandido com todos os campos, `admin_notes`, botões Aprovar/Reprovar/Solicitar Info (dispara email via edge fn `b2b-notify`).

---

## Fase 3 — Promoções + Cupons + Vendedores

**/admin/promocoes**: CRUD, seleção de alvo (produto/categoria/marca/grupo), preview de preço final, ativar/desativar. Resolver preço no catálogo via view `v_effective_prices` (SQL) que aplica promoção ativa mais vantajosa.

**/admin/cupons**: CRUD, gerador de código, tabela de uso, integração no `/carrinho` e `/checkout`:
- Novo componente `CouponInput` no carrinho, valida via server fn `couponValidate({code, cart, userId})`, aplica desconto, registra `coupon_usages` no checkout.

**/admin/vendedores**: convite por email (edge fn `invite-sales-rep` usa `supabaseAdmin.auth.admin.inviteUserByEmail`), limites de desconto, toggles de permissão, listagem de pedidos por vendedor.

---

## Fase 4 — Bling OAuth + IA A&S Business

**/admin/bling** (4 abas)
- **Conexão**: Edge fn `bling-oauth-start` (redirect PKCE), `bling-oauth-callback` (troca code por token, salva em `bling_config`). Botões conectar/testar/revogar. Secrets: `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` (vou pedir via `add_secret` no início da Fase 4).
- **Sincronização**: 7 botões, cada um chama edge fn `bling-sync` com `entity` param. Progresso via realtime em `bling_sync_logs`.
- **Logs**: tabela com filtros status/tipo, drawer de detalhes JSON, botão "reprocessar".
- **Configurações**: form das 6 flags + cron via pg_cron (chama `/api/public/hooks/bling-sync-scheduled`).

**/admin/ia-aes-business**
- Form: URL API, chave (via `add_secret` `AES_AI_API_URL`, `AES_AI_API_KEY`), toggle scopes (produtos, pedidos, políticas, estoque).
- Testar conexão, ver logs (`ai_tool_logs` já existe).
- Edge fn `aes-ai-chat` já existe como stub — atualizar para chamar API real quando secrets presentes.

---

## Detalhes técnicos

**Storage:** buckets públicos `product-images` (`/{product_id}/{uuid}.{ext}`) e `banners` (`/{slot}/{uuid}.{ext}`). RLS `storage.objects`: SELECT anon, INSERT/UPDATE/DELETE só `is_staff()`.

**Preço efetivo:** function SQL `get_effective_price(product_id, customer_group)` retorna `{price, original_price, promotion_id}`. Reutilizada em catálogo, carrinho, checkout, IA.

**Segurança:**
- Toda escrita passa por server fn com `requireSupabaseAuth` + checagem de role.
- Bling secrets nunca no client — só edge fns.
- Convite de vendedor via `supabaseAdmin.auth.admin.inviteUserByEmail` (sem senha manual).

**UI:** shadcn Dialog/Sheet para forms, Sonner para toasts, TanStack Query com invalidação por chave, dnd-kit para reordenar.

**Estimativa por fase:** F1 ~pequena, F2 grande (produtos é o maior), F3 média, F4 depende dos secrets do Bling.

---

## Confirmação

Prossigo com **Fase 1** agora? Ela é pré-requisito de todas as outras — sem ela nada funciona. Se algum campo/regra deste plano estiver errado, me diga antes.
