-- PDV hardening: server-side pricing plus audited cash supply/withdrawal.
create table if not exists public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cash_session_id uuid not null references public.pos_cash_sessions(id) on delete cascade,
  operator_id uuid not null references auth.users(id),
  type text not null check (type in ('supply','withdrawal')),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);
create index if not exists pos_cash_movements_session_idx
  on public.pos_cash_movements(cash_session_id, created_at);
alter table public.pos_cash_movements enable row level security;
create policy "pos members read cash movements" on public.pos_cash_movements
for select to authenticated using (exists (
  select 1 from public.tenant_memberships tm
  where tm.tenant_id=pos_cash_movements.tenant_id
    and tm.user_id=(select auth.uid()) and tm.active
    and tm.role in ('owner','admin','manager','cashier','finance','accountant')
));

create or replace function public.record_pos_cash_movement(
  p_session_id uuid, p_type text, p_amount numeric, p_reason text
) returns public.pos_cash_movements
language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid(); v_session public.pos_cash_sessions; v_row public.pos_cash_movements;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('supply','withdrawal') or p_amount <= 0 or length(trim(p_reason)) < 3
    then raise exception 'INVALID_CASH_MOVEMENT'; end if;
  select * into v_session from public.pos_cash_sessions
    where id=p_session_id and status='open' for update;
  if not found then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=v_session.tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager','cashier')
  ) then raise exception 'FORBIDDEN'; end if;
  if v_session.operator_id <> v_user and not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=v_session.tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager')
  ) then raise exception 'SESSION_OWNED_BY_ANOTHER_OPERATOR'; end if;
  insert into public.pos_cash_movements(tenant_id,cash_session_id,operator_id,type,amount,reason)
  values(v_session.tenant_id,p_session_id,v_user,p_type,round(p_amount,2),trim(p_reason))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.finalize_pos_sale(
  p_tenant_id uuid, p_cash_session_id uuid, p_idempotency_key uuid,
  p_items jsonb, p_payments jsonb, p_discount_amount numeric default 0,
  p_customer_id uuid default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid(); v_session public.pos_cash_sessions;
  v_item jsonb; v_payment jsonb; v_sale_id uuid; v_stock public.product_stock;
  v_product public.products; v_subtotal numeric(14,2):=0; v_total numeric(14,2); v_paid numeric(14,2):=0;
  v_price numeric(14,2); v_qty integer; v_available integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_SALE'; end if;
  if jsonb_typeof(p_payments)<>'array' or jsonb_array_length(p_payments)=0 then raise exception 'PAYMENT_REQUIRED'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    group by i->>'product_id' having count(*)>1
  ) then raise exception 'DUPLICATE_PRODUCT'; end if;

  select * into v_session from public.pos_cash_sessions
    where id=p_cash_session_id and tenant_id=p_tenant_id and status='open' for update;
  if not found then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=p_tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager','cashier','sales')
  ) then raise exception 'FORBIDDEN'; end if;
  if v_session.operator_id<>v_user and not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id=p_tenant_id and tm.user_id=v_user and tm.active
      and tm.role in ('owner','admin','manager')
  ) then raise exception 'SESSION_OWNED_BY_ANOTHER_OPERATOR'; end if;

  select id into v_sale_id from public.pos_sales
    where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
  if found then return v_sale_id; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<=0 then raise exception 'INVALID_ITEM'; end if;
    select * into v_product from public.products
      where id=(v_item->>'product_id')::uuid and tenant_id=p_tenant_id and active for share;
    if not found then raise exception 'PRODUCT_UNAVAILABLE:%',v_item->>'product_id'; end if;
    v_price:=round(coalesce(nullif(v_product.sale_price_b2c,0),v_product.price_b2c),2);
    if v_price<0 then raise exception 'INVALID_PRODUCT_PRICE'; end if;
    select * into v_stock from public.product_stock
      where tenant_id=p_tenant_id and warehouse_id=v_session.warehouse_id
        and product_id=v_product.id for update;
    v_available:=coalesce(v_stock.on_hand,0)-coalesce(v_stock.reserved,0);
    if not found or v_available<v_qty then raise exception 'INSUFFICIENT_STOCK:%',v_product.id; end if;
    v_subtotal:=v_subtotal+(v_qty*v_price);
  end loop;
  v_total:=round(v_subtotal-coalesce(p_discount_amount,0),2);
  if v_total<0 then raise exception 'INVALID_DISCOUNT'; end if;
  if coalesce(p_discount_amount,0)>0 and not exists (
    select 1 from public.tenant_memberships tm where tm.tenant_id=p_tenant_id
      and tm.user_id=v_user and tm.active and tm.role in ('owner','admin','manager')
  ) then raise exception 'DISCOUNT_REQUIRES_MANAGER'; end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    if (v_payment->>'amount')::numeric<=0 then raise exception 'INVALID_PAYMENT'; end if;
    v_paid:=v_paid+round((v_payment->>'amount')::numeric,2);
  end loop;
  if v_paid<>v_total then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;

  insert into public.pos_sales
    (tenant_id,cash_session_id,warehouse_id,operator_id,customer_id,subtotal,discount_amount,total,idempotency_key)
  values(p_tenant_id,p_cash_session_id,v_session.warehouse_id,v_user,p_customer_id,v_subtotal,
    coalesce(p_discount_amount,0),v_total,p_idempotency_key) returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=(v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
    v_price:=round(coalesce(nullif(v_product.sale_price_b2c,0),v_product.price_b2c),2);
    update public.product_stock set on_hand=on_hand-v_qty,updated_at=now()
      where tenant_id=p_tenant_id and warehouse_id=v_session.warehouse_id and product_id=v_product.id;
    insert into public.pos_sale_items(tenant_id,sale_id,product_id,quantity,unit_price,line_total)
      values(p_tenant_id,v_sale_id,v_product.id,v_qty,v_price,v_qty*v_price);
    insert into public.stock_movements(tenant_id,product_id,warehouse_id,type,qty,reference,notes,user_id)
      values(p_tenant_id,v_product.id,v_session.warehouse_id,'OUT',v_qty,'PDV-'||v_sale_id::text,'Venda PDV',v_user);
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
  p_session_id uuid,p_counted_amount numeric,p_notes text default null
) returns public.pos_cash_sessions
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_row public.pos_cash_sessions; v_expected numeric(14,2);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_counted_amount<0 then raise exception 'INVALID_COUNTED_AMOUNT'; end if;
  select * into v_row from public.pos_cash_sessions where id=p_session_id and status='open' for update;
  if not found then raise exception 'CASH_SESSION_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships tm where tm.tenant_id=v_row.tenant_id
      and tm.user_id=v_user and tm.active and tm.role in ('owner','admin','manager','cashier')
  ) then raise exception 'FORBIDDEN'; end if;
  if v_row.operator_id<>v_user and not exists (
    select 1 from public.tenant_memberships tm where tm.tenant_id=v_row.tenant_id
      and tm.user_id=v_user and tm.active and tm.role in ('owner','admin','manager')
  ) then raise exception 'SESSION_OWNED_BY_ANOTHER_OPERATOR'; end if;
  select v_row.opening_amount
    +coalesce((select sum(pp.amount) from public.pos_sales ps join public.pos_payments pp on pp.sale_id=ps.id
      where ps.cash_session_id=p_session_id and ps.status='paid' and pp.method='cash' and pp.status='confirmed'),0)
    +coalesce((select sum(cm.amount) from public.pos_cash_movements cm
      where cm.cash_session_id=p_session_id and cm.type='supply'),0)
    -coalesce((select sum(cm.amount) from public.pos_cash_movements cm
      where cm.cash_session_id=p_session_id and cm.type='withdrawal'),0)
  into v_expected;
  update public.pos_cash_sessions set status='closed',expected_amount=v_expected,
    counted_amount=round(p_counted_amount,2),difference_amount=round(p_counted_amount-v_expected,2),
    notes=nullif(trim(p_notes),''),closed_at=now()
  where id=p_session_id returning * into v_row;
  return v_row;
end $$;

revoke all on function public.record_pos_cash_movement(uuid,text,numeric,text) from public,anon;
grant execute on function public.record_pos_cash_movement(uuid,text,numeric,text) to authenticated;
grant select on public.pos_cash_movements to authenticated;