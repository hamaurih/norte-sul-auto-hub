import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/format";

async function assertStaff(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isStaff = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "gerente");
  if (!isStaff) throw new Error("Forbidden");
}

// -------- BRANDS --------
export type BrandInput = {
  id?: string | null;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  featured?: boolean;
};

export const brandUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrandInput) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Nome obrigatório");
    const slug = (data.slug && data.slug.trim()) || slugify(name);
    const row = { name, slug, logo_url: data.logo_url ?? null, featured: data.featured ?? false };
    if (data.id) {
      const { error } = await context.supabase.from("brands").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("brands").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id };
  });

export const brandDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", data.id);
    if ((count ?? 0) > 0) throw new Error(`Marca em uso por ${count} produto(s). Reatribua antes de excluir.`);
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- CATEGORIES --------
export type CategoryInput = {
  id?: string | null;
  name: string;
  slug?: string | null;
  parent_id?: string | null;
  icon?: string | null;
  image_url?: string | null;
  sort_order?: number;
  active?: boolean;
};

export const categoryUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CategoryInput) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Nome obrigatório");
    const slug = (data.slug && data.slug.trim()) || slugify(name);
    const row = {
      name,
      slug,
      parent_id: data.parent_id || null,
      icon: data.icon ?? null,
      image_url: data.image_url ?? null,
      sort_order: data.sort_order ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      if (row.parent_id === data.id) throw new Error("Categoria não pode ser pai dela mesma");
      const { error } = await context.supabase.from("categories").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("categories").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id };
  });

export const categoryDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const [{ count: prodCount }, { count: childCount }] = await Promise.all([
      context.supabase.from("products").select("id", { count: "exact", head: true }).or(`category_id.eq.${data.id},subcategory_id.eq.${data.id}`),
      context.supabase.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", data.id),
    ]);
    if ((prodCount ?? 0) > 0) throw new Error(`Categoria em uso por ${prodCount} produto(s).`);
    if ((childCount ?? 0) > 0) throw new Error(`Categoria possui ${childCount} subcategoria(s). Exclua-as primeiro.`);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
