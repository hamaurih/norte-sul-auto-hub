-- PDV core: cash sessions, atomic sales, split payments and inventory posting.
-- This migration is additive and does not alter the existing ecommerce order flow.

create table if not exists public.pos_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  terminal_code text not null,
  operator_id uuid not null references auth.users(id),
  status text not null default 'open' check (status in ('open','closed')),
  opening_amount numeric(14,2) not null default 0 check (opening_amount >= 0),
  expected_amount numeric(14,2),
  counted_amount numeric(14,2),
  difference_amount numeric(14,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists pos_one_open_session_per_terminal
  on public.pos_cash_sessions (tenant_id, terminal_code) where status = 'open';

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cash_session_id uuid not null references public.pos_cash_sessions(id),
  warehouse_id uuid not null references public.warehouses(id),
  operator_id uuid not null references auth.users(id),
  customer_id uuid,
  status text not null default 'paid' check (status in ('paid','cancelled','refunded')),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  total numeric(14,2) not null check (total >= 0),
  idempotency_key uuid not null,
  fiscal_status text not null default 'pending' check (fiscal_status in ('pending','authorized','rejected','cancelled')),
  fiscal_document_id text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  method text not null check (method in ('cash','pix','debit_card','credit_card','store_credit','b2b_invoice')),
  amount numeric(14,2) not null check (amount > 0),
  installments integer not null default 1 check (installments between 1 and 24),
  provider text,
  provider_reference text,
  status text not null default 'confirmed' check (status in ('pending','confirmed','failed','refunded')),
  created_at timestamptz not null default now()
);

create index if not exists pos_cash_sessions_tenant_idx on public.pos_cash_sessions(tenant_id, opened_at desc);
create index if not exists pos_sales_tenant_idx on public.pos_sales(tenant_id, created_at desc);
create index if not exists pos_sale_items_sale_idx on public.pos_sale_items(sale_id);
create index if not exists pos_payments_sale_idx on public.pos_payments(sale_id);

alter table public.pos_cash_sessions enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;
alter table public.pos_payments enable row level security;

create policy "pos members read cash sessions" on public.pos_cash_sessions for select to authenticated
using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id = pos_cash_sessions.tenant_id and tm.user_id = (select auth.uid())
    and tm.active and tm.role in ('owner','admin','manager','cashier','finance','accountant')
));
create policy "pos members read sales" on public.pos_sales for select to authenticated
using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id = pos_sales.tenant_id and tm.user_id = (select auth.uid())
    and tm.active and tm.role in ('owner','admin','manager','cashier','sales','finance','accountant')
));
create policy "pos members read items" on public.pos_sale_items for select to authenticated
using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id = pos_sale_items.tenant_id and tm.user_id = (select auth.uid())
    and tm.active and tm.role in ('owner','admin','manager','cashier','sales','finance','accountant')
));
create policy "pos members read payments" on public.pos_payments for select to authenticated
using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id = pos_payments.tenant_id and tm.user_id = (select auth.uid())
    and tm.active and tm.role in ('owner','admin','manager','cashier','finance','accountant')
));

create or replace function public.open_pos_cash_session(
  p_tenant_id uuid, p_branch_id uuid, p_warehouse_id uuid,
  p_terminal_code text, p_opening_amount numeric default 0
) returns public.pos_cash_sessions
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.pos_cash_sessions;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=p_tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager','cashier')
  ) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1 from public.warehouses w join public.branches b on b.id=w.branch_id
    where w.id=p_warehouse_id and b.id=p_branch_id
      and w.tenant_id=p_tenant_id and b.tenant_id=p_tenant_id and w.active and b.active
  ) then raise exception 'INVALID_WAREHOUSE'; end if;
  insert into public.pos_cash_sessions
    (tenant_id,branch_id,warehouse_id,terminal_code,operator_id,opening_amount)
  values
    (p_tenant_id,p_branch_id,p_warehouse_id,upper(trim(p_terminal_code)),v_user,p_opening_amount)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.finalize_pos_sale(
  p_tenant_id uuid, p_cash_session_id uuid, p_idempotency_key uuid,
  p_items jsonb, p_payments jsonb, p_discount_amount numeric default 0,
  p_customer_id uuid default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_session public.pos_cash_sessions;
  v_item jsonb; v_payment jsonb; v_sale_id uuid; v_stock public.product_stock;
  v_subtotal numeric(14,2) := 0; v_total numeric(14,2); v_paid numeric(14,2) := 0;
  v_price numeric(14,2); v_qty integer; v_available integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_SALE'; end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments)=0 then raise exception 'PAYMENT_REQUIRED'; end if;

  select * into v_session from public.pos_cash_sessions
  where id=p_cash_session_id and tenant_id=p_tenant_id and status='open' for update;
  if not found then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=p_tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager','cashier','sales')
  ) then raise exception 'FORBIDDEN'; end if;

  select id into v_sale_id from public.pos_sales
  where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
  if found then return v_sale_id; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_price := round((v_item->>'unit_price')::numeric,2);
    if v_qty <= 0 or v_price < 0 then raise exception 'INVALID_ITEM'; end if;
    select * into v_stock from public.product_stock
      where tenant_id=p_tenant_id and warehouse_id=v_session.warehouse_id
        and product_id=(v_item->>'product_id')::uuid for update;
    v_available := coalesce(v_stock.on_hand,0)-coalesce(v_stock.reserved,0);
    if not found or v_available < v_qty then raise exception 'INSUFFICIENT_STOCK:%', v_item->>'product_id'; end if;
    v_subtotal := v_subtotal + (v_qty*v_price);
  end loop;
  v_total := round(v_subtotal-coalesce(p_discount_amount,0),2);
  if v_total < 0 then raise exception 'INVALID_DISCOUNT'; end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    v_paid := v_paid + round((v_payment->>'amount')::numeric,2);
  end loop;
  if v_paid <> v_total then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;

  insert into public.pos_sales
    (tenant_id,cash_session_id,warehouse_id,operator_id,customer_id,subtotal,discount_amount,total,idempotency_key)
  values
    (p_tenant_id,p_cash_session_id,v_session.warehouse_id,v_user,p_customer_id,v_subtotal,coalesce(p_discount_amount,0),v_total,p_idempotency_key)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer; v_price := round((v_item->>'unit_price')::numeric,2);
    update public.product_stock set on_hand=on_hand-v_qty, updated_at=now()
      where tenant_id=p_tenant_id and warehouse_id=v_session.warehouse_id
        and product_id=(v_item->>'product_id')::uuid;
    insert into public.pos_sale_items(tenant_id,sale_id,product_id,quantity,unit_price,line_total)
      values(p_tenant_id,v_sale_id,(v_item->>'product_id')::uuid,v_qty,v_price,v_qty*v_price);
    insert into public.stock_movements(tenant_id,product_id,warehouse_id,type,qty,reference,notes,user_id)
      values(p_tenant_id,(v_item->>'product_id')::uuid,v_session.warehouse_id,'OUT',v_qty,
        'PDV-'||v_sale_id::text,'Venda PDV',v_user);
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into public.pos_payments(tenant_id,sale_id,method,amount,installments,provider,provider_reference,status)
    values(p_tenant_id,v_sale_id,v_payment->>'method',(v_payment->>'amount')::numeric,
      coalesce((v_payment->>'installments')::integer,1),nullif(v_payment->>'provider',''),
      nullif(v_payment->>'provider_reference',''),'confirmed');
  end loop;
  return v_sale_id;
end $$;

create or replace function public.close_pos_cash_session(
  p_session_id uuid, p_counted_amount numeric, p_notes text default null
) returns public.pos_cash_sessions
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_row public.pos_cash_sessions; v_expected numeric(14,2);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.pos_cash_sessions where id=p_session_id and status='open' for update;
  if not found then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm where tm.tenant_id=v_row.tenant_id
      and tm.user_id=v_user and tm.active and tm.role in ('owner','admin','manager','cashier')
  ) then raise exception 'FORBIDDEN'; end if;
  select v_row.opening_amount + coalesce(sum(pp.amount) filter (where pp.method='cash' and pp.status='confirmed'),0)
    into v_expected from public.pos_sales ps join public.pos_payments pp on pp.sale_id=ps.id
    where ps.cash_session_id=p_session_id and ps.status='paid';
  update public.pos_cash_sessions set status='closed', expected_amount=v_expected,
    counted_amount=p_counted_amount, difference_amount=p_counted_amount-v_expected,
    notes=p_notes, closed_at=now()
  where id=p_session_id returning * into v_row;
  return v_row;
end $$;

revoke all on function public.open_pos_cash_session(uuid,uuid,uuid,text,numeric) from public, anon;
revoke all on function public.finalize_pos_sale(uuid,uuid,uuid,jsonb,jsonb,numeric,uuid) from public, anon;
revoke all on function public.close_pos_cash_session(uuid,numeric,text) from public, anon;
grant execute on function public.open_pos_cash_session(uuid,uuid,uuid,text,numeric) to authenticated;
grant execute on function public.finalize_pos_sale(uuid,uuid,uuid,jsonb,jsonb,numeric,uuid) to authenticated;
grant execute on function public.close_pos_cash_session(uuid,numeric,text) to authenticated;
grant select on public.pos_cash_sessions, public.pos_sales, public.pos_sale_items, public.pos_payments to authenticated;
