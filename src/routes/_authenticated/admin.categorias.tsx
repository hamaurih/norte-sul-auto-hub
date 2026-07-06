import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_authenticated/admin/categorias")({
  head: () => ({ meta: [{ title: "Categorias · Admin" }] }),
  component: () => <ComingSoon title="Categorias" phase="Fase 2">Árvore de categorias com subcategorias, ícones e ordenação.</ComingSoon>,
});
