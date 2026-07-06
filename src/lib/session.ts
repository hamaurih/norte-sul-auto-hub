import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      const [{ data: rolesData }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("profiles").select("customer_group, b2b_status").eq("id", session.user.id).maybeSingle(),
      ]);
      const roles = ((rolesData ?? []).map((r) => r.role) as AppRole[]);
      const customerGroup = (profile?.customer_group ?? "b2c") as CustomerGroup;
      const b2bStatus = (profile?.b2b_status ?? "none") as B2BStatus;
      const isStaff = roles.some((r) => r === "admin" || r === "gerente");
      const isAdmin = roles.some((r) => r === "admin");
      const isSalesRep = roles.some((r) => r === "vendedor");
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
        });
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => hydrate(session));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
