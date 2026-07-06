import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_authenticated/admin/ia-aes-business")({
  head: () => ({ meta: [{ title: "IA A&S Business · Admin" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/admin" });
  },
  component: () => (
    <ComingSoon title="IA A&S Business" phase="Fase 4">
      Tabela <code>ai_aes_config</code> criada. URL da API, chave segura, teste de conexão, escopos consultáveis e logs de conversa chegam na Fase 4.
    </ComingSoon>
  ),
});
