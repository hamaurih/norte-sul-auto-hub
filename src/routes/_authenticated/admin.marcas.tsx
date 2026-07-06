import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/admin/ComingSoon";
export const Route = createFileRoute("/_authenticated/admin/marcas")({
  head: () => ({ meta: [{ title: "Marcas · Admin" }] }),
  component: () => <ComingSoon title="Marcas" phase="Fase 2">CRUD de marcas com upload de logo e destaque.</ComingSoon>,
});
