import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bannerUpsert, bannerDelete, bannerToggle, type BannerInput } from "@/lib/banners.functions";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({ meta: [{ title: "Banners · Admin" }] }),
  component: BannersList,
});

const POSITIONS = ["home_hero", "categoria", "b2b", "promocao", "rodape"];

function emptyBanner(): BannerInput {
  return {
    title: "", subtitle: "", image_url: "", image_mobile_url: "",
    link_url: "", cta_label: "", position: "home_hero",
    sort_order: 0, active: true, audience: "all",
    starts_at: null, ends_at: null,
  };
}

function toInput(v: string | null | undefined) {
  return v ? v.slice(0, 16) : "";
}

function BannersList() {
  const qc = useQueryClient();
  const upsert = useServerFn(bannerUpsert);
  const del = useServerFn(bannerDelete);
  const toggle = useServerFn(bannerToggle);
  const [editing, setEditing] = useState<(BannerInput & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("position").order("sort_order")).data ?? [],
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await upsert({ data: editing });
      toast.success("Banner salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Excluir banner?")) return;
    try { await del({ data: { id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function handleToggle(id: string, active: boolean) {
    try { await toggle({ data: { id, active } }); qc.invalidateQueries({ queryKey: ["admin-banners"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold uppercase">Banners</h1>
        <button onClick={() => setEditing(emptyBanner())} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground">
          <Plus className="h-4 w-4" /> Novo Banner
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-lg border border-border bg-card">
            <img src={b.image_url || "/placeholder.svg"} alt="" className="h-32 w-full object-cover" />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{b.position}</span>
                <span className="text-[10px] uppercase text-muted-foreground">público: {b.audience}</span>
              </div>
              <div className="mt-1 font-display font-bold uppercase">{b.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{b.subtitle}</div>
              <div className="mt-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={b.active} onChange={(e) => handleToggle(b.id, e.target.checked)} />
                  Ativo
                </label>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ ...(b as any) })} title="Editar" className="rounded bg-muted p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(b.id)} title="Excluir" className="rounded bg-muted p-1.5 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && <div className="col-span-full rounded border border-dashed border-border p-8 text-center text-muted-foreground">Nenhum banner ainda.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-card p-6 shadow-xl">
            <h2 className="mb-4 font-display text-xl font-bold uppercase">{editing.id ? "Editar banner" : "Novo banner"}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <L label="Título *" full><input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inp} /></L>
              <L label="Subtítulo" full><input value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} className={inp} /></L>
              <L label="Imagem desktop (URL) *" full><input required value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className={inp} /></L>
              <L label="Imagem mobile (URL)" full><input value={editing.image_mobile_url ?? ""} onChange={(e) => setEditing({ ...editing, image_mobile_url: e.target.value })} className={inp} /></L>
              <L label="Link (URL de destino)"><input value={editing.link_url ?? ""} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} className={inp} /></L>
              <L label="Texto do botão (CTA)"><input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} className={inp} /></L>
              <L label="Posição">
                <select value={editing.position} onChange={(e) => setEditing({ ...editing, position: e.target.value })} className={inp}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </L>
              <L label="Público">
                <select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as any })} className={inp}>
                  <option value="all">Todos</option>
                  <option value="b2c">B2C</option>
                  <option value="b2b">B2B</option>
                </select>
              </L>
              <L label="Ordem"><input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inp} /></L>
              <L label="Ativo">
                <label className="mt-2 inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Publicar
                </label>
              </L>
              <L label="Início"><input type="datetime-local" value={toInput(editing.starts_at)} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inp} /></L>
              <L label="Fim"><input type="datetime-local" value={toInput(editing.ends_at)} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inp} /></L>
            </div>
            {editing.image_url && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Prévia</p>
                <img src={editing.image_url} alt="" className="max-h-48 rounded border border-border object-cover" />
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded border border-border px-4 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded border border-border bg-background p-2 text-sm";
function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block text-sm ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
