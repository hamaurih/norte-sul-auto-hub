import { defineMcp } from "@lovable.dev/mcp-js";
import searchProductsTool from "./tools/search-products";
import getProductTool from "./tools/get-product";

export default defineMcp({
  name: "aes-store-mcp",
  title: "A&S Store MCP",
  version: "0.1.0",
  instructions:
    "Tools for the A&S e-commerce catalog. Use `search_products` to find items and `get_product` to fetch full details by slug.",
  tools: [searchProductsTool, getProductTool],
});
