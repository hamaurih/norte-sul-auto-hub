import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the active product catalog by name, SKU, or internal code. Returns products with prices, stock, brand and slug so the agent can quote and check availability.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .describe("Search text matched against product name, SKU, internal code and description."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
    in_stock_only: z
      .boolean()
      .optional()
      .describe("If true, only return products with stock greater than zero."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, in_stock_only }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const safe = query.replace(/[,()]/g, " ");
    let q = supabase
      .from("products")
      .select(
        "id, sku, name, slug, short_description, price_b2c, sale_price_b2c, compare_at_price, stock, active, brand:brands(name, slug)",
      )
      .eq("active", true)
      .or(
        `name.ilike.%${safe}%,sku.ilike.%${safe}%,short_description.ilike.%${safe}%`,
      )
      .order("sales_count", { ascending: false })
      .limit(limit ?? 10);
    if (in_stock_only) q = q.gt("stock", 0);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const results = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: results.length
            ? JSON.stringify(results)
            : `Nenhum produto ativo encontrado para "${query}".`,
        },
      ],
      structuredContent: { count: results.length, results },
    };
  },
});
