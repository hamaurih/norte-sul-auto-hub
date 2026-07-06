import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface SessionState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isStaff: boolean;
  isB2BApproved: boolean;
  roles: string[];
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    session: null,
    loading: true,
    isStaff: false,
    isB2BApproved: false,
    roles: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRoles(userId: string) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data ?? []).map((r) => r.role as string);
      return {
        roles,
        isStaff: roles.some((r) => r === "admin" || r === "gerente"),
        isB2BApproved: roles.some((r) =>
          ["revendedor", "oficina", "distribuidor", "admin", "gerente"].includes(r),
        ),
      };
    }

    async function hydrate(session: Session | null) {
      if (!session?.user) {
        if (!cancelled)
          setState({
            user: null,
            session: null,
            loading: false,
            isStaff: false,
            isB2BApproved: false,
            roles: [],
          });
        return;
      }
      const r = await loadRoles(session.user.id);
      if (!cancelled)
        setState({ user: session.user, session, loading: false, ...r });
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
