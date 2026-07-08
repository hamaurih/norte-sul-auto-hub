import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { normalizeTerm } from "../../normalize";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the active product catalog by name, SKU, internal code, description, brand or category. If the query text is itself a brand name (e.g. 'JBL', 'Pioneer', 'Moura', 'Taramps'), returns products of that brand even when the brand name does not appear in the product title. Returns products with prices, stock, brand, image and slug so the agent can quote and check availability.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .describe("Search text: product name, SKU, internal code, description or brand (e.g. 'pastilha freio', 'JBL', 'multimídia Pioneer')."),
    brand: z.string().trim().min(1).optional().describe("Restrict results to this brand name or slug."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
    in_stock_only: z.boolean().optional().describe("If true, only return products with stock greater than zero."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, brand, limit, in_stock_only }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const safe = query.replace(/[,()]/g, " ");

    // Detect brand: match query or explicit `brand` param against brands table
    const brandTerm = (brand ?? query).trim().toLowerCase();
    let matchedBrand: { id: string; name: string; slug: string } | null = null;
    if (brandTerm.length >= 2) {
      const { data: brands } = await supabase
        .from("brands")
        .select("id, name, slug")
        .or(`name.ilike.%${brandTerm}%,slug.ilike.%${brandTerm}%`)
        .limit(3);
      // Prefer exact match if any
      const exact = (brands ?? []).find(
        (b) => b.name.toLowerCase() === brandTerm || b.slug.toLowerCase() === brandTerm,
      );
      matchedBrand = exact ?? brands?.[0] ?? null;
    }

    let q = supabase
      .from("products")
      .select(
        "id, sku, name, slug, short_description, price_b2c, sale_price_b2c, compare_at_price, stock, active, brand:brands(name, slug), images:product_images(url, is_primary, sort_order)",
      )
      .eq("active", true)
      .order("sales_count", { ascending: false })
      .limit(limit ?? 10);

    if (matchedBrand) {
      // Brand-focused query: all products of the brand (optionally still filtered by free text)
      q = q.eq("brand_id", matchedBrand.id);
      if (!brand && safe && safe.toLowerCase() !== matchedBrand.name.toLowerCase()) {
        q = q.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,short_description.ilike.%${safe}%`);
      }
    } else {
      q = q.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,short_description.ilike.%${safe}%`);
    }
    if (in_stock_only) q = q.gt("stock", 0);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const results = (data ?? []).map((p: any) => {
      const imgs = (p.images ?? []).slice().sort(
        (a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
      );
      return {
        id: p.id, sku: p.sku, name: p.name, slug: p.slug,
        short_description: p.short_description,
        price: p.sale_price_b2c ?? p.price_b2c,
        list_price: p.price_b2c,
        compare_at_price: p.compare_at_price,
        stock: p.stock ?? 0,
        available: (p.stock ?? 0) > 0,
        brand: p.brand,
        image_url: imgs[0]?.url ?? null,
      };
    });

    return {
      content: [
        {
          type: "text",
          text: results.length
            ? JSON.stringify({ matchedBrand, count: results.length, results })
            : `Nenhum produto ativo encontrado para "${query}".`,
        },
      ],
      structuredContent: { matchedBrand, count: results.length, results },
    };
  },
});
