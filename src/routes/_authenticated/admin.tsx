import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { LayoutDashboard, Users, Package, ShoppingBag, Image as ImageIcon, RefreshCcw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Norte Sul" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "gerente");
    if (!isStaff) throw redirect({ to: "/" });
  },
  component: Admin,
});

type Tab = "dashboard" | "b2b" | "orders" | "products" | "banners" | "sync";

function Admin() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { isStaff } = useSession();

  if (!isStaff) {
    return (
      <div className="container-x py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-2">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="container-x py-6">
      <h1 className="mb-4 font-display text-3xl font-bold uppercase">Painel Administrativo</h1>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1 text-sm">
          {[
            { k: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { k: "b2b", label: "Cadastros B2B", icon: Users },
            { k: "orders", label: "Pedidos", icon: ShoppingBag },
            { k: "products", label: "Produtos", icon: Package },
            { k: "banners", label: "Banners", icon: ImageIcon },
            { k: "sync", label: "Logs Bling", icon: RefreshCcw },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as Tab)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${tab === t.k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div>
          {tab === "dashboard" && <Dashboard />}
          {tab === "b2b" && <B2BList />}
          {tab === "orders" && <OrdersList />}
          {tab === "products" && <ProductsList />}
          {tab === "banners" && <BannersList />}
          {tab === "sync" && <SyncLogs />}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: orders }, { count: products }, { count: customers }, { count: pending }] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("b2b_registrations").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      ]);
      const { data: lowStock } = await supabase.from("products").select("sku, name, stock").lt("stock", 5).order("stock").limit(5);
      return { orders, products, customers, pending, lowStock: lowStock ?? [] };
    },
  });

  const cards = [
    { label: "Pedidos", value: data?.orders ?? 0 },
    { label: "Produtos", value: data?.products ?? 0 },
    { label: "Clientes", value: data?.customers ?? 0 },
    { label: "B2B pendentes", value: data?.pending ?? 0, hot: true },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-lg border p-4 ${c.hot ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            <div className="text-xs uppercase text-muted-foreground">{c.label}</div>
            <div className="mt-1 font-display text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 font-display text-lg font-bold uppercase">Estoque crítico</h3>
        {(data?.lowStock ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Tudo em estoque.</p>
        ) : (
          <ul className="text-sm">
            {data?.lowStock.map((p) => (
              <li key={p.sku} className="flex justify-between border-b border-border py-1 last:border-0">
                <span>{p.name} <span className="text-xs text-muted-foreground">({p.sku})</span></span>
                <span className={`font-bold ${p.stock === 0 ? "text-destructive" : "text-hot"}`}>{p.stock} unid.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function B2BList() {
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: ["b2b-list"],
    queryFn: async () => {
      const { data } = await supabase.from("b2b_registrations").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function decide(regId: string, userId: string, status: "aprovado" | "reprovado", groupRole?: string) {
    await supabase.from("b2b_registrations").update({ status, reviewed_at: new Date().toISOString() }).eq("id", regId);
    if (status === "aprovado" && groupRole) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "b2b_pendente");
      await supabase.from("user_roles").insert({ user_id: userId, role: groupRole });
    }
    toast.success(`Cadastro ${status}`);
    qc.invalidateQueries({ queryKey: ["b2b-list"] });
  }

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cadastro.</p>}
      {list.map((r) => (
        <div key={r.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg font-bold uppercase">{r.razao_social}</div>
              <div className="text-xs text-muted-foreground">
                CNPJ {r.cnpj} · {r.cidade}{r.estado ? `/${r.estado}` : ""} · {r.segmento}
              </div>
              {r.nome_fantasia && <div className="text-xs">Fantasia: {r.nome_fantasia}</div>}
              <div className="text-xs">WhatsApp: {r.whatsapp} · Volume: {r.volume_medio_compra ?? "—"}</div>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${r.status === "pendente" ? "bg-hot text-hot-foreground" : r.status === "aprovado" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
              {r.status}
            </span>
          </div>
          {r.status === "pendente" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {["revendedor", "oficina", "distribuidor"].map((g) => (
                <button key={g} onClick={() => decide(r.id, r.user_id, "aprovado", g)} className="rounded bg-success px-3 py-1.5 text-xs font-bold uppercase text-success-foreground hover:brightness-110">
                  Aprovar como {g}
                </button>
              ))}
              <button onClick={() => decide(r.id, r.user_id, "reprovado")} className="rounded bg-destructive px-3 py-1.5 text-xs font-bold uppercase text-destructive-foreground hover:brightness-110">
                Reprovar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OrdersList() {
  const { data = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id, customer_name, customer_email, status, total, created_at, is_b2b, bling_number").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase">
          <tr>
            <th className="p-2 text-left">Pedido</th>
            <th className="p-2 text-left">Cliente</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-left">Bling</th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="p-2 font-mono text-xs">#{o.id.slice(0, 8)}</td>
              <td className="p-2">{o.customer_name}<br /><span className="text-xs text-muted-foreground">{o.customer_email}</span></td>
              <td className="p-2 text-xs uppercase">{o.status}</td>
              <td className="p-2 text-xs">{o.is_b2b ? "B2B" : "B2C"}</td>
              <td className="p-2 text-right price-tag">{brl(Number(o.total))}</td>
              <td className="p-2 text-xs">{o.bling_number ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsList() {
  const { data = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, sku, name, stock, price_b2c, active, featured").order("name").limit(200);
      return data ?? [];
    },
  });
  return (
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
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border p-3 text-xs text-muted-foreground">
        Edição completa de produtos será feita pela integração com Bling (próxima fase).
      </p>
    </div>
  );
}

function BannersList() {
  const { data = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data } = await supabase.from("banners").select("*").order("sort_order");
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      {data.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <img src={b.image_url} alt="" className="h-16 w-24 rounded object-cover" />
          <div className="flex-1">
            <div className="font-display font-bold uppercase">{b.title}</div>
            <div className="text-xs text-muted-foreground">{b.subtitle}</div>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${b.active ? "bg-success text-success-foreground" : "bg-muted"}`}>{b.active ? "Ativo" : "Inativo"}</span>
        </div>
      ))}
    </div>
  );
}

function SyncLogs() {
  const { data = [] } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("bling_sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm">
        <b>Integração Bling</b> — Estrutura pronta. Configure as credenciais OAuth 2.0 na próxima fase para iniciar a sincronização de produtos, estoque, preços, clientes e pedidos.
      </div>
      {data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum log ainda.</p>}
      {data.map((l) => (
        <div key={l.id} className="rounded border border-border bg-card p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase">{l.entity} · {l.action}</span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${l.status === "sucesso" ? "bg-success text-success-foreground" : l.status === "erro" ? "bg-destructive text-destructive-foreground" : "bg-hot text-hot-foreground"}`}>{l.status}</span>
          </div>
          <div className="mt-1 text-muted-foreground">{l.message}</div>
          <div className="mt-1 text-[10px] opacity-70">{new Date(l.created_at).toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}
