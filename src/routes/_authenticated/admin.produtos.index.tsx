import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { productDelete, productDuplicate, productToggle } from "@/lib/products.functions";
import { Plus, Pencil, Copy, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/produtos/")({
  head: () => ({ meta: [{ title: "Produtos · Admin" }] }),
  component: ProductsList,
});

function ProductsList() {
  const qc = useQueryClient();
  const del = useServerFn(productDelete);
  const dup = useServerFn(productDuplicate);
  const toggle = useServerFn(productToggle);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [filterStock, setFilterStock] = useState<"" | "in" | "out">("");

  const { data: brands = [] } = useQuery({ queryKey: ["brands-all"], queryFn: async () => (await supabase.from("brands").select("id,name").order("name")).data ?? [] });
  const { data: cats = [] } = useQuery({ queryKey: ["categories-all"], queryFn: async () => (await supabase.from("categories").select("id,name,parent_id").order("name")).data ?? [] });

  const { data = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, sku, name, stock, price_b2c, sale_price_b2c, active, featured, is_new, is_bestseller, brand_id, category_id")
        .order("name")
        .limit(500);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return data.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.sku.toLowerCase().includes(q.toLowerCase())) return false;
      if (filterCat && p.category_id !== filterCat) return false;
      if (filterBrand && p.brand_id !== filterBrand) return false;
      if (filterActive === "true" && !p.active) return false;
      if (filterActive === "false" && p.active) return false;
      if (filterStock === "in" && p.stock <= 0) return false;
      if (filterStock === "out" && p.stock > 0) return false;
      return true;
    });
  }, [data, q, filterCat, filterBrand, filterActive, filterStock]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Essa ação não pode ser desfeita.`)) return;
    try { await del({ data: { id } }); toast.success("Produto excluído"); qc.invalidateQueries({ queryKey: ["admin-products"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleDuplicate(id: string) {
    try { await dup({ data: { id } }); toast.success("Produto duplicado"); qc.invalidateQueries({ queryKey: ["admin-products"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleToggle(id: string, field: "active" | "featured" | "is_new" | "is_bestseller", value: boolean) {
    try { await toggle({ data: { id, field, value } }); qc.invalidateQueries({ queryKey: ["admin-products"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase">Produtos <span className="text-sm text-muted-foreground">({filtered.length})</span></h1>
        <Link to="/admin/produtos/novo" className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo Produto
        </Link>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou SKU" className="w-full rounded border border-border bg-background p-2 pl-8 text-sm" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="rounded border border-border bg-background p-2 text-sm">
          <option value="">Todas categorias</option>
          {cats.filter((c) => !c.parent_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="rounded border border-border bg-background p-2 text-sm">
          <option value="">Todas marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex gap-2">
          <select value={filterActive} onChange={(e) => setFilterActive(e.target.value as any)} className="flex-1 rounded border border-border bg-background p-2 text-sm">
            <option value="">Ativos/Inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
          <select value={filterStock} onChange={(e) => setFilterStock(e.target.value as any)} className="flex-1 rounded border border-border bg-background p-2 text-sm">
            <option value="">Estoque</option>
            <option value="in">Em estoque</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-right">Estoque</th>
              <th className="p-2 text-right">Preço</th>
              <th className="p-2 text-center">Ativo</th>
              <th className="p-2 text-center">Destaque</th>
              <th className="p-2 text-center">Lanç.</th>
              <th className="p-2 text-center">Top</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const price = p.sale_price_b2c ? Number(p.sale_price_b2c) : Number(p.price_b2c);
              return (
                <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-2 font-mono text-xs">{p.sku}</td>
                  <td className="p-2">{p.name}</td>
                  <td className={`p-2 text-right ${p.stock === 0 ? "text-destructive font-bold" : ""}`}>{p.stock}</td>
                  <td className="p-2 text-right">{brl(price)}</td>
                  <td className="p-2 text-center"><input type="checkbox" checked={p.active} onChange={(e) => handleToggle(p.id, "active", e.target.checked)} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={p.featured} onChange={(e) => handleToggle(p.id, "featured", e.target.checked)} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={p.is_new} onChange={(e) => handleToggle(p.id, "is_new", e.target.checked)} /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={p.is_bestseller} onChange={(e) => handleToggle(p.id, "is_bestseller", e.target.checked)} /></td>
                  <td className="p-2 text-right">
                    <div className="inline-flex gap-1">
                      <Link to="/admin/produtos/$id" params={{ id: p.id }} title="Editar" className="rounded bg-muted p-1.5 hover:bg-primary hover:text-primary-foreground"><Pencil className="h-3.5 w-3.5" /></Link>
                      <button onClick={() => handleDuplicate(p.id)} title="Duplicar" className="rounded bg-muted p-1.5 hover:bg-primary hover:text-primary-foreground"><Copy className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(p.id, p.name)} title="Excluir" className="rounded bg-muted p-1.5 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
