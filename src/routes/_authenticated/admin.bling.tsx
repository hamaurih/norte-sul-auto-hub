import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_authenticated/admin/bling")({
  head: () => ({ meta: [{ title: "Bling · Admin" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/admin" });
  },
  component: () => (
    <ComingSoon title="Integração Bling" phase="Fase 4">
      Configuração OAuth 2.0, botões de sincronização (produtos, estoque, preços, clientes, pedidos), logs filtráveis e rotina automática.
      <br />
      <br />
      Requer as credenciais <b>Client ID</b> e <b>Client Secret</b> do app Bling. Vou solicitar via formulário seguro quando iniciarmos a Fase 4.
    </ComingSoon>
  ),
});
