import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tdb } from "@/integrations/supabase/tenant-db";
import {
  canViewModule,
  defaultPermissionsForRole,
  permissionMapFromRows,
  type ModulePermission,
  type PermissionMap,
  type PermissionModuleKey,
  type SystemRole,
} from "@/lib/permissions";
import type { Session, User } from "@supabase/supabase-js";

export type CustomerGroup = "b2c" | "b2b_pendente" | "revendedor" | "oficina" | "distribuidor";
export type B2BStatus = "none" | "pending" | "approved" | "rejected";
export type AppRole = "admin" | "gerente" | "vendedor" | "cliente";

export interface SessionState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isSalesRep: boolean;
  isB2BApproved: boolean;
  isB2BPending: boolean;
  roles: AppRole[];
  customerGroup: CustomerGroup;
  b2bStatus: B2BStatus;
  tenantId: string | null;
  tenantRole: string | null;
  permissions: PermissionMap;
  canViewModule: (module: PermissionModuleKey) => boolean;
}

const empty: SessionState = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  isSalesRep: false,
  isB2BApproved: false,
  isB2BPending: false,
  roles: [],
  customerGroup: "b2c",
  b2bStatus: "none",
  tenantId: null,
  tenantRole: null,
  permissions: defaultPermissionsForRole("consulta"),
  canViewModule: () => false,
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(empty);

  useEffect(() => {
    let cancelled = false;

    async function hydrate(session: Session | null) {
      if (!session?.user) {
        if (!cancelled) setState({ ...empty, loading: false });
        return;
      }
      const [{ data: rolesData }, { data: profile }, { data: accessContext }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase
          .from("profiles")
          .select("customer_group, b2b_status")
          .eq("id", session.user.id)
          .maybeSingle(),
        tdb(supabase).rpc("my_access_context"),
      ]);
      const roles = (rolesData ?? []).map((r) => r.role) as AppRole[];
      const customerGroup = (profile?.customer_group ?? "b2c") as CustomerGroup;
      const b2bStatus = (profile?.b2b_status ?? "none") as B2BStatus;
      const access = (accessContext ?? {}) as {
        tenants?: Array<{ id: string; slug: string; role: string; status: string }>;
      };
      const tenant = (access.tenants ?? []).find(
        (item) =>
          item.slug ===
            (typeof window !== "undefined"
              ? window.localStorage.getItem("auto-deal-active-tenant")
              : null) ||
          item.slug === (import.meta.env.VITE_PUBLIC_TENANT_SLUG || "norte-sul-real"),
      );
      const tenantRole = tenant?.role ?? null;
      const hasTenantMembership = Boolean(tenant);
      const tenantAccessActive = tenant?.status === "active";
      const tenantStaff = ["owner", "admin", "manager", "sales", "viewer"].includes(
        tenantRole ?? "",
      );
      const legacyStaff = roles.some((r) => r === "admin" || r === "gerente");
      const legacyAdmin = roles.some((r) => r === "admin");
      const legacySalesRep = roles.some((r) => r === "vendedor");
      const isStaff = hasTenantMembership ? tenantAccessActive && tenantStaff : legacyStaff;
      const isAdmin = hasTenantMembership
        ? tenantAccessActive && ["owner", "admin"].includes(tenantRole ?? "")
        : legacyAdmin;
      const isSalesRep = hasTenantMembership
        ? tenantAccessActive && tenantRole === "sales"
        : legacySalesRep;
      const systemRole: SystemRole = hasTenantMembership
        ? isAdmin
          ? "admin"
          : tenantRole === "manager"
            ? "gerente"
            : tenantRole === "sales"
              ? "vendedor"
              : "consulta"
        : roles.includes("admin")
          ? "admin"
          : roles.includes("gerente")
            ? "gerente"
            : roles.includes("vendedor")
              ? "vendedor"
              : "consulta";
      let permissions = defaultPermissionsForRole(systemRole);
      if (tenant?.id) {
        const { data: permissionRows } = await tdb(supabase)
          .from("tenant_user_permissions")
          .select("module_key, can_view, can_create, can_update, can_delete")
          .eq("tenant_id", tenant.id)
          .eq("user_id", session.user.id);
        permissions = permissionMapFromRows(
          systemRole,
          (permissionRows ?? []) as ModulePermission[],
        );
      }
      const b2bGroup = ["revendedor", "oficina", "distribuidor"].includes(customerGroup);
      if (!cancelled)
        setState({
          user: session.user,
          session,
          loading: false,
          isAdmin,
          isStaff,
          isSalesRep,
          isB2BApproved: isStaff || (b2bGroup && b2bStatus === "approved"),
          isB2BPending: customerGroup === "b2b_pendente" || b2bStatus === "pending",
          roles,
          customerGroup,
          b2bStatus,
          tenantId: tenant?.id ?? null,
          tenantRole,
          permissions,
          canViewModule: (module) => canViewModule(permissions, module),
        });
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        void hydrate(data.session);
      })
      .catch(() => {
        if (!cancelled) setState({ ...empty, loading: false });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Do not return/await a Promise inside this callback. The auth client can
      // hold its internal lock while dispatching auth events, and running table
      // queries here directly can block every catalog query on authenticated
      // page loads, leaving the home stuck in skeleton state.
      window.setTimeout(() => {
        void hydrate(session);
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
