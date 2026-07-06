import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Percent, CreditCard } from "lucide-react";
import { HeroCarousel, Rail } from "@/components/site/HeroCarousel";
import { ProductCard } from "@/components/site/ProductCard";
import {
  fetchBanners,
  fetchBrands,
  fetchCategories,
  fetchFeatured,
  fetchNewArrivals,
  fetchOffers,
  fetchBestSellers,
} from "@/lib/queries";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Norte Sul Acessórios · Loja e Atacado Automotivo" },
      { name: "description", content: "Som automotivo, farol LED, pneus, alarmes e muito mais. Frete para todo o Brasil e tabela especial para lojistas, oficinas e revendedores." },
    ],
  }),
  component: Home,
});

function Home() {
  const { isB2BApproved } = useSession();
  const { data: banners = [] } = useQuery({ queryKey: ["banners"], queryFn: fetchBanners });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: offers = [] } = useQuery({ queryKey: ["offers"], queryFn: fetchOffers });
  const { data: news = [] } = useQuery({ queryKey: ["new"], queryFn: fetchNewArrivals });
  const { data: best = [] } = useQuery({ queryKey: ["best"], queryFn: fetchBestSellers });
  const { data: featured = [] } = useQuery({ queryKey: ["featured"], queryFn: fetchFeatured });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: fetchBrands });

  return (
    <div>
      <div className="pt-4">
        <HeroCarousel banners={banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, image_url: b.image_url, link_url: b.link_url, cta_label: b.cta_label }))} />
      </div>

      {/* Trust strip */}
      <section className="container-x mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { icon: Truck, label: "Frete Brasil" },
          { icon: CreditCard, label: "10x sem juros" },
          { icon: Percent, label: "PIX 5% OFF" },
          { icon: ShieldCheck, label: "Compra segura" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold">
            <Icon className="h-4 w-4 text-primary" /> {label}
          </div>
        ))}
      </section>

      {/* Departments grid */}
      <section className="container-x mt-8">
        <h3 className="mb-3 font-display text-2xl font-bold uppercase leading-none">Departamentos</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/catalogo"
              search={{ category: c.slug } as never}
              className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-brand)]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-display text-lg font-black text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                {c.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold uppercase leading-tight">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <Rail title="Ofertas do dia" subtitle="Descontos que não voltam" viewAllHref="/catalogo">
        {offers.map((p) => <ProductCard key={p.id} p={p} isB2B={isB2BApproved} />)}
      </Rail>

      <Rail title="Lançamentos" subtitle="Chegou primeiro na Norte Sul" viewAllHref="/catalogo">
        {news.map((p) => <ProductCard key={p.id} p={p} isB2B={isB2BApproved} />)}
      </Rail>

      {/* B2B CTA */}
      <section className="container-x mt-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-secondary to-primary/80 p-8 text-secondary-foreground md:p-12">
          <div className="relative z-10 max-w-2xl">
            <span className="rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">B2B · Atacado</span>
            <h3 className="mt-3 font-display text-3xl font-black uppercase leading-tight md:text-4xl">Você é lojista, oficina ou revendedor?</h3>
            <p className="mt-2 max-w-lg text-sm text-white/80 md:text-base">
              Cadastre seu CNPJ e desbloqueie a tabela de preços de atacado, condição faturada e catálogo completo pronto para revenda.
            </p>
            <Link
              to="/b2b"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground shadow-[var(--shadow-brand)] hover:brightness-110"
            >
              Compre no atacado <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/40 blur-3xl" />
        </div>
      </section>

      <Rail title="Mais vendidos" subtitle="Escolhidos por quem entende" viewAllHref="/catalogo">
        {best.map((p) => <ProductCard key={p.id} p={p} isB2B={isB2BApproved} />)}
      </Rail>

      <Rail title="Vitrine em destaque" viewAllHref="/catalogo">
        {featured.map((p) => <ProductCard key={p.id} p={p} isB2B={isB2BApproved} />)}
      </Rail>

      {/* Brands */}
      <section className="container-x mt-10">
        <h3 className="mb-3 font-display text-2xl font-bold uppercase leading-none">Marcas parceiras</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {brands.map((b) => (
            <Link
              key={b.id}
              to="/catalogo"
              search={{ brand: b.slug } as never}
              className="grid h-16 place-items-center rounded-lg border border-border bg-card p-3 font-display text-sm font-bold uppercase transition hover:border-primary hover:text-primary"
            >
              {b.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
