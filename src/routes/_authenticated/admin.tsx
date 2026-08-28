import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { fetchAccessContext } from "@/lib/access";
import { canViewModule, type PermissionModuleKey } from "@/lib/permissions";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Briefcase,
  ShoppingBag,
  Package,
  FolderTree,
  Tag,
  Percent,
  Ticket,
  Image as ImageIcon,
  RefreshCcw,
  Bot,
  Settings,
  ShieldAlert,
  Network,
  Building2,
  Warehouse,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });

    // Membership decides access. An authenticated user without any membership
    // goes to the activation screen, never to a generic error or a loop.
    const context = await fetchAccessContext();
    if (context.organizations.length > 0 || context.tenants.length > 0) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "gerente");
    if (!isStaff) throw redirect({ to: "/ativacao" });
  },
  component: AdminLayout,
});

type Item = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "operacao" | "catalogo" | "estoque" | "marketing" | "integracoes" | "sistema";
  permission: PermissionModuleKey;
  adminOnly?: boolean;
};

const items: Item[] = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "operacao",
    permission: "dashboard",
  },
  {
    to: "/admin/orcamentos",
    label: "Orçamentos",
    icon: FileText,
    group: "operacao",
    permission: "sales",
  },
  {
    to: "/admin/pedidos",
    label: "Pedidos",
    icon: ShoppingBag,
    group: "operacao",
    permission: "sales",
  },
  {
    to: "/admin/cadastros-b2b",
    label: "Cadastros B2B",
    icon: Briefcase,
    group: "operacao",
    permission: "crm",
  },
  { to: "/admin/clientes", label: "Clientes", icon: Users, group: "operacao", permission: "crm" },
  {
    to: "/admin/vendedores",
    label: "Vendedores",
    icon: UserCog,
    group: "operacao",
    permission: "sales",
    adminOnly: true,
  },

  {
    to: "/admin/produtos",
    label: "Produtos",
    icon: Package,
    group: "catalogo",
    permission: "catalog",
  },
  {
    to: "/admin/categorias",
    label: "Categorias",
    icon: FolderTree,
    group: "catalogo",
    permission: "catalog",
  },
  { to: "/admin/marcas", label: "Marcas", icon: Tag, group: "catalogo", permission: "catalog" },

  {
    to: "/admin/filiais",
    label: "Filiais e Depósitos",
    icon: Building2,
    group: "estoque",
    permission: "inventory",
  },
  {
    to: "/admin/estoque",
    label: "Estoque",
    icon: Warehouse,
    group: "estoque",
    permission: "inventory",
  },

  {
    to: "/admin/promocoes",
    label: "Promoções",
    icon: Percent,
    group: "marketing",
    permission: "marketing",
  },
  {
    to: "/admin/cupons",
    label: "Cupons",
    icon: Ticket,
    group: "marketing",
    permission: "marketing",
  },
  {
    to: "/admin/banners",
    label: "Banners",
    icon: ImageIcon,
    group: "marketing",
    permission: "marketing",
  },

  {
    to: "/admin/ecossistema",
    label: "Ecossistema",
    icon: Network,
    group: "integracoes",
    permission: "integrations",
    adminOnly: true,
  },
  {
    to: "/admin/ecossistema/bling",
    label: "Bling",
    icon: RefreshCcw,
    group: "integracoes",
    permission: "integrations",
    adminOnly: true,
  },
  {
    to: "/admin/ia-aes-business",
    label: "IA A&S Business",
    icon: Bot,
    group: "integracoes",
    permission: "ai",
    adminOnly: true,
  },

  {
    to: "/admin/saneamento",
    label: "Saneamento",
    icon: ShieldAlert,
    group: "sistema",
    permission: "audit",
    adminOnly: true,
  },
  {
    to: "/admin/saneamento/aliases",
    label: "Aliases",
    icon: Tag,
    group: "sistema",
    permission: "audit",
    adminOnly: true,
  },
  {
    to: "/admin/auditoria",
    label: "Auditoria",
    icon: ClipboardCheck,
    group: "sistema",
    permission: "audit",
    adminOnly: true,
  },
  {
    to: "/admin/homologacao",
    label: "Homologação",
    icon: ClipboardCheck,
    group: "sistema",
    permission: "fiscal",
    adminOnly: true,
  },
  {
    to: "/admin/configuracoes",
    label: "Configurações",
    icon: Settings,
    group: "sistema",
    permission: "settings",
    adminOnly: true,
  },
  {
    to: "/admin/usuarios",
    label: "Usuários e permissões",
    icon: UserCog,
    group: "sistema",
    permission: "users",
    adminOnly: true,
  },
];

const groupLabels: Record<Item["group"], string> = {
  operacao: "Comercial",
  catalogo: "Catálogo",
  estoque: "Estoque",
  marketing: "Marketing",
  integracoes: "Integrações",
  sistema: "Sistema",
};

function AdminSidebar() {
  const { isAdmin, isStaff, permissions } = useSession();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isStaff) return null;

  const visible = items.filter(
    (i) => (!i.adminOnly || isAdmin) && canViewModule(permissions, i.permission),
  );
  const groups = [
    "operacao",
    "catalogo",
    "estoque",
    "marketing",
    "integracoes",
    "sistema",
  ] as const;

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map((g) => {
          const gItems = visible.filter((i) => i.group === g);
          if (gItems.length === 0) return null;
          return (
            <SidebarGroup key={g}>
              <SidebarGroupLabel>{groupLabels[g]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {gItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive(item.to)}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

function AdminLayout() {
  const { isStaff, loading, permissions } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return null;
  if (!isStaff) {
    return (
      <div className="container-x py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-2">Acesso restrito.</p>
      </div>
    );
  }

  const currentItem =
    items
      .filter(
        (item) =>
          item.to !== "/admin" && (pathname === item.to || pathname.startsWith(`${item.to}/`)),
      )
      .sort((a, b) => b.to.length - a.to.length)[0] ??
    (pathname === "/admin" ? items[0] : undefined);
  if (currentItem && !canViewModule(permissions, currentItem.permission)) {
    return (
      <div className="container-x py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 font-display text-2xl font-bold uppercase">Acesso não liberado</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Seu usuário não possui permissão para visualizar este módulo. Solicite a liberação ao
          administrador.
        </p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-card px-3">
            <SidebarTrigger />
            <span className="font-display text-sm font-bold uppercase">Painel Administrativo</span>
            <Link
              to="/"
              className="ml-auto text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
            >
              ← Voltar à loja
            </Link>
          </header>
          <main className="p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
