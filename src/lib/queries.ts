import { supabase } from "@/integrations/supabase/client";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price_b2c: number;
  price_b2b: number | null;
  compare_at_price: number | null;
  stock: number;
  featured: boolean;
  is_new: boolean;
  is_offer: boolean;
  sales_count: number;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
  images: { url: string; is_primary: boolean; sort_order: number }[];
}

const PRODUCT_SELECT = `
  id, sku, name, slug, short_description, description,
  price_b2c, price_b2b, compare_at_price, stock,
  featured, is_new, is_offer, sales_count,
  brand:brands(name, slug),
  category:categories(name, slug),
  images:product_images(url, is_primary, sort_order)
`;

export async function fetchFeatured(): Promise<ProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .eq("featured", true)
    .limit(12);
  return (data as unknown as ProductRow[]) ?? [];
}

export async function fetchOffers(): Promise<ProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .eq("is_offer", true)
    .order("sales_count", { ascending: false })
    .limit(12);
  return (data as unknown as ProductRow[]) ?? [];
}

export async function fetchNewArrivals(): Promise<ProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .eq("is_new", true)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data as unknown as ProductRow[]) ?? [];
}

export async function fetchBestSellers(): Promise<ProductRow[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("sales_count", { ascending: false })
    .limit(12);
  return (data as unknown as ProductRow[]) ?? [];
}

export interface CatalogFilters {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "sales" | "price_asc" | "price_desc" | "new";
}

export async function fetchCatalog(f: CatalogFilters = {}): Promise<ProductRow[]> {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("active", true);

  if (f.q) {
    q = q.or(`name.ilike.%${f.q}%,sku.ilike.%${f.q}%,short_description.ilike.%${f.q}%`);
  }
  if (f.category) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", f.category).maybeSingle();
    if (cat) q = q.eq("category_id", cat.id);
  }
  if (f.brand) {
    const { data: br } = await supabase.from("brands").select("id").eq("slug", f.brand).maybeSingle();
    if (br) q = q.eq("brand_id", br.id);
  }
  if (typeof f.minPrice === "number") q = q.gte("price_b2c", f.minPrice);
  if (typeof f.maxPrice === "number") q = q.lte("price_b2c", f.maxPrice);
  if (f.inStock) q = q.gt("stock", 0);

  switch (f.sort) {
    case "price_asc":
      q = q.order("price_b2c", { ascending: true });
      break;
    case "price_desc":
      q = q.order("price_b2c", { ascending: false });
      break;
    case "new":
      q = q.order("created_at", { ascending: false });
      break;
    default:
      q = q.order("sales_count", { ascending: false });
  }

  const { data } = await q.limit(60);
  return (data as unknown as ProductRow[]) ?? [];
}

export async function fetchProductBySlug(slug: string): Promise<ProductRow | null> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as unknown as ProductRow) ?? null;
}

export async function fetchProductApplications(productId: string) {
  const { data } = await supabase
    .from("product_applications")
    .select("vehicle_make, vehicle_model, year_from, year_to")
    .eq("product_id", productId);
  return data ?? [];
}

export async function fetchRelated(categorySlug: string | null, excludeId: string) {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("active", true).neq("id", excludeId).limit(8);
  if (categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (cat) q = q.eq("category_id", cat.id);
  }
  const { data } = await q;
  return (data as unknown as ProductRow[]) ?? [];
}

export async function fetchCategories() {
  const { data } = await supabase.from("categories").select("id, name, slug, icon, sort_order").eq("active", true).order("sort_order");
  return data ?? [];
}

export async function fetchBrands() {
  const { data } = await supabase.from("brands").select("id, name, slug, logo_url, featured").order("name");
  return data ?? [];
}

export async function fetchBanners() {
  const { data } = await supabase.from("banners").select("*").eq("position", "hero").order("sort_order");
  return data ?? [];
}

export function primaryImage(p: ProductRow): string | null {
  const imgs = (p.images ?? []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return imgs[0]?.url ?? null;
}

export function displayPrice(p: ProductRow, isB2BApproved: boolean) {
  const b2b = isB2BApproved && p.price_b2b ? p.price_b2b : null;
  return {
    retail: p.price_b2c,
    wholesale: b2b,
    compare: p.compare_at_price,
    effective: b2b ?? p.price_b2c,
  };
}
