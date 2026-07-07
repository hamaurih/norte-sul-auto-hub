import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "check_stock",
  title: "Check stock",
  description:
    "Check current stock and price for one or more products by SKU or slug. Use before quoting or committing to a sale to confirm availability.",
  inputSchema: {
    skus: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(50)
      .optional()
      .describe("List of SKUs to check."),
    slugs: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(50)
      .optional()
      .describe("List of product slugs to check."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ skus, slugs }) => {
    if ((!skus || skus.length === 0) && (!slugs || slugs.length === 0)) {
      return {
        content: [{ type: "text", text: "Informe pelo menos um SKU ou slug." }],
        isError: true,
      };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("products")
      .select("sku, slug, name, stock, price_b2c, sale_price_b2c, active");
    if (skus && slugs) q = q.or(`sku.in.(${skus.join(",")}),slug.in.(${slugs.join(",")})`);
    else if (skus) q = q.in("sku", skus);
    else if (slugs) q = q.in("slug", slugs);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const items = (data ?? []).map((p) => ({
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      active: p.active,
      stock: p.stock ?? 0,
      available: (p.stock ?? 0) > 0 && p.active,
      price: p.sale_price_b2c ?? p.price_b2c,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});
