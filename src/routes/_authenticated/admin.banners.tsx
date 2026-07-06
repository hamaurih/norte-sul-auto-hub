import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({ meta: [{ title: "Banners · Admin" }] }),
  component: BannersList,
});

function BannersList() {
  const { data = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data } = await supabase.from("banners").select("*").order("sort_order");
      return data ?? [];
    },
  });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase">Banners</h1>
        <button disabled className="rounded bg-primary/60 px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground opacity-70">
          + Novo Banner (Fase 2)
        </button>
      </div>
      <div className="mb-3 rounded-md border border-dashed border-primary bg-primary/5 p-3 text-xs text-muted-foreground">
        Upload de imagens (desktop/mobile), reordenação e público-alvo chegam na Fase 2.
      </div>
      <div className="space-y-2">
        {data.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <img src={b.image_url} alt="" className="h-16 w-24 rounded object-cover" />
            <div className="flex-1">
              <div className="font-display font-bold uppercase">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.subtitle}</div>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${b.active ? "bg-success text-success-foreground" : "bg-muted"}`}>
              {b.active ? "Ativo" : "Inativo"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
