-- Align manual POS cancellation with the existing payment lifecycle.
create or replace function public.cancel_pos_sale(p_sale_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=auth.uid(); v_sale public.pos_sales; v_item record;
begin
if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
select * into v_sale from public.pos_sales where id=p_sale_id for update;
if not found then raise exception 'SALE_NOT_FOUND'; end if;
if not exists(select 1 from public.tenant_memberships tm where tm.tenant_id=v_sale.tenant_id and tm.user_id=v_user and tm.active and tm.role in ('owner','admin','manager')) then raise exception 'CANCELLATION_REQUIRES_MANAGER'; end if;
if v_sale.status='cancelled' then return v_sale.id; end if;
if v_sale.status<>'paid' then raise exception 'SALE_NOT_CANCELLABLE'; end if;
if v_sale.fiscal_status in ('authorized','cancellation_pending') then raise exception 'FISCAL_CANCELLATION_REQUIRED'; end if;
if exists(select 1 from public.pos_payments pp where pp.sale_id=v_sale.id and pp.status='confirmed' and pp.provider is not null) then raise exception 'PAYMENT_REVERSAL_REQUIRED'; end if;
for v_item in select psi.product_id,psi.quantity from public.pos_sale_items psi where psi.sale_id=v_sale.id for update loop
update public.product_stock set on_hand=on_hand+v_item.quantity,updated_at=now() where tenant_id=v_sale.tenant_id and warehouse_id=v_sale.warehouse_id and product_id=v_item.product_id;
if not found then raise exception 'STOCK_ROW_NOT_FOUND:%',v_item.product_id; end if;
insert into public.stock_movements(tenant_id,product_id,warehouse_id,type,qty,reference,notes,user_id) values(v_sale.tenant_id,v_item.product_id,v_sale.warehouse_id,'IN',v_item.quantity,'PDV-CANCEL-'||v_sale.id::text,'Cancelamento PDV: '||trim(p_reason),v_user);
end loop;
update public.pos_payments set status='refunded' where sale_id=v_sale.id and status='confirmed';
update public.pos_sales set status='cancelled',cancelled_at=now() where id=v_sale.id;
return v_sale.id;
end $function$;
revoke all on function public.cancel_pos_sale(uuid,text) from public,anon;
grant execute on function public.cancel_pos_sale(uuid,text) to authenticated;
