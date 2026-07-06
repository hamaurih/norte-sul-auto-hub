import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "gerente");
  if (!isStaff) throw new Error("Forbidden");
}

export type ProductInput = {
  id?: string | null;
  sku: string;
  internal_code?: string | null;
  name: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  price_b2c: number;
  price_b2b?: number | null;
  compare_at_price?: number | null;
  sale_price_b2c?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
  stock: number;
  min_stock?: number;
  hide_when_out_of_stock?: boolean;
  active?: boolean;
  featured?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  is_offer?: boolean;
  weight_kg?: number | null;
  images?: { url: string; alt?: string | null; is_primary?: boolean }[];
};

export const productUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProductInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStaff(supabase, userId);
    const { images, id, ...row } = data;
    const payload = { ...row, updated_at: new Date().toISOString() };
    let productId = id;
    if (id) {
      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      productId = inserted.id;
    }
    // Replace images
    if (images && productId) {
      await supabase.from("product_images").delete().eq("product_id", productId);
      if (images.length > 0) {
        const rows = images.map((img, i) => ({
          product_id: productId!,
          url: img.url,
          alt: img.alt ?? null,
          is_primary: img.is_primary ?? i === 0,
          sort_order: i,
        }));
        const { error } = await supabase.from("product_images").insert(rows);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true, id: productId };
  });

export const productDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const productToggle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; field: "active" | "featured" | "is_new" | "is_bestseller" | "is_offer"; value: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, boolean> = { [data.field]: data.value };
    const { error } = await context.supabase.from("products").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const productDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: src, error } = await context.supabase.from("products").select("*").eq("id", data.id).single();
    if (error || !src) throw new Error(error?.message ?? "Produto não encontrado");
    const suffix = Math.random().toString(36).slice(2, 6);
    const { id: _id, created_at: _c, updated_at: _u, sales_count: _s, bling_id: _b, ...rest } = src as any;
    const copy = {
      ...rest,
      sku: `${src.sku}-COPY-${suffix}`,
      slug: `${src.slug}-copy-${suffix}`,
      name: `${src.name} (cópia)`,
      active: false,
    };
    const { data: inserted, error: insErr } = await context.supabase.from("products").insert(copy).select("id").single();
    if (insErr) throw new Error(insErr.message);
    // Copy images
    const { data: imgs } = await context.supabase.from("product_images").select("url, alt, is_primary, sort_order").eq("product_id", data.id);
    if (imgs && imgs.length > 0) {
      await context.supabase.from("product_images").insert(imgs.map((i) => ({ ...i, product_id: inserted.id })));
    }
    return { ok: true, id: inserted.id };
  });
