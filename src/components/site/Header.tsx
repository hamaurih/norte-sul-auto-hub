import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, User, Wrench, Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories } from "@/lib/queries";
import { useCart } from "@/lib/cart-store";
import { useSession } from "@/lib/session";
import logo from "@/assets/norte-sul-logo.png.asset.json";

export function Header() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();
  const { user, isStaff, isSalesRep, isB2BApproved } = useSession();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/catalogo", search: { q } as never });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-secondary text-secondary-foreground">
      {/* Top strip */}
      <div className="border-b border-white/10 bg-black/30 text-[11px]">
        <div className="container-x flex h-8 items-center justify-between">
          <span className="hidden sm:inline">Frete para todo Brasil · PIX com 5% OFF · 10x sem juros</span>
          <div className="flex items-center gap-3">
            <Link to="/b2b" className="hover:text-primary">Compre no Atacado (B2B)</Link>
            <span className="opacity-40">|</span>
            <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer" className="hover:text-primary">WhatsApp</a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="container-x flex items-center gap-3 py-3">
        <button
          className="md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link to="/" className="group flex items-center" aria-label="Norte Sul Acessórios - Início">
          <img
            src={logo.url}
            alt="Norte Sul Acessórios e Peças"
            className="h-14 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105 md:h-16"
            loading="eager"
            decoding="async"
          />
        </Link>

        <form onSubmit={submit} className="ml-auto flex flex-1 max-w-2xl items-center rounded-md bg-white text-foreground">
          <div className="hidden items-center gap-1 border-r border-border px-3 text-xs font-semibold text-muted-foreground sm:flex">
            <span>SKU · Produto · Marca · Aplicação</span>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busque por som, farol LED, Gol 2020…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button className="grid h-full aspect-square place-items-center rounded-r-md bg-primary px-3 text-primary-foreground" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </button>
        </form>

        <nav className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link to="/conta" className="hidden items-center gap-1 rounded px-2 py-1 text-sm hover:text-primary md:flex">
                <User className="h-4 w-4" /> Minha Conta
              </Link>
              {isSalesRep && (
                <Link to="/vendedor" className="hidden items-center gap-1 rounded bg-hot px-2 py-1 text-xs font-bold uppercase text-hot-foreground md:flex">
                  Vendedor
                </Link>
              )}
              {isStaff && (
                <Link to="/admin" className="hidden items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground md:flex">
                  <Wrench className="h-3 w-3" /> Admin
                </Link>
              )}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                title="Sair"
                className="hidden md:inline-flex rounded p-2 hover:text-primary"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="hidden items-center gap-1 rounded px-2 py-1 text-sm hover:text-primary md:flex">
              <User className="h-4 w-4" /> Entrar
            </Link>
          )}
          <Link to="/carrinho" className="relative flex items-center gap-1 rounded px-2 py-1 text-sm hover:text-primary">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Departments */}
      <div className="border-t border-white/10 bg-black/20">
        <div className="container-x scroll-rail py-2 text-sm">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/catalogo"
              search={{ category: c.slug } as never}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu drop */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-secondary p-4 md:hidden">
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/catalogo" onClick={() => setMenuOpen(false)}>Catálogo</Link>
            <Link to="/b2b" onClick={() => setMenuOpen(false)}>Compre no Atacado</Link>
            {user ? (
              <>
                <Link to="/conta" onClick={() => setMenuOpen(false)}>Minha conta</Link>
                <Link to="/pedidos" onClick={() => setMenuOpen(false)}>Meus pedidos</Link>
                {isStaff && <Link to="/admin" onClick={() => setMenuOpen(false)}>Painel Admin</Link>}
                <button
                  className="text-left text-primary"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setMenuOpen(false);
                  }}
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setMenuOpen(false)}>Entrar / Cadastrar</Link>
            )}
            {isB2BApproved && (
              <span className="mt-2 rounded bg-success px-2 py-1 text-xs font-bold uppercase text-success-foreground">
                Preço atacado ativo
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
