import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  head: () => ({ meta: [{ title: "Produtos · Admin" }] }),
  component: ProductsList,
});

function ProductsList() {
  const { data = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, sku, name, stock, price_b2c, active, featured, is_new, is_bestseller")
        .order("name")
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase">Produtos</h1>
        <button
          disabled
          title="Disponível na Fase 2"
          className="rounded bg-primary/60 px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground opacity-70"
        >
          + Novo Produto (Fase 2)
        </button>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-md border border-dashed border-primary bg-primary/5 p-3 text-xs text-muted-foreground">
        <Package className="h-4 w-4 text-primary" />
        Formulário completo (criar/editar/duplicar/upload de imagens) chega na próxima fase. A listagem abaixo já reflete os novos campos comerciais.
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-right">Estoque</th>
              <th className="p-2 text-right">Preço B2C</th>
              <th className="p-2 text-center">Ativo</th>
              <th className="p-2 text-center">Destaque</th>
              <th className="p-2 text-center">Lançamento</th>
              <th className="p-2 text-center">Top</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{p.sku}</td>
                <td className="p-2">{p.name}</td>
                <td className={`p-2 text-right ${p.stock === 0 ? "text-destructive font-bold" : ""}`}>{p.stock}</td>
                <td className="p-2 text-right">{brl(Number(p.price_b2c))}</td>
                <td className="p-2 text-center">{p.active ? "✓" : "—"}</td>
                <td className="p-2 text-center">{p.featured ? "★" : "—"}</td>
                <td className="p-2 text-center">{p.is_new ? "🆕" : "—"}</td>
                <td className="p-2 text-center">{p.is_bestseller ? "🔥" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
