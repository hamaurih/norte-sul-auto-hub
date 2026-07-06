/**
 * Sales rep management server functions.
 * Admin/gerente can create sales reps; invitation goes out via Supabase Auth.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteSalesRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name: string; email: string; phone?: string; commission_pct?: number; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Staff guard
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "gerente");
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Send invite email (creates auth user if new)
    const redirectTo = process.env.SITE_URL ? `${process.env.SITE_URL}/auth` : undefined;
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name, role: "vendedor" },
      redirectTo,
    });
    if (invErr && !/already/i.test(invErr.message)) throw new Error(invErr.message);

    // Find or reuse user id
    let newUserId = invited?.user?.id ?? null;
    if (!newUserId) {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      newUserId = existing?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase())?.id ?? null;
    }
    if (!newUserId) throw new Error("Não foi possível criar o usuário");

    // Grant vendedor role
    await supabaseAdmin.from("user_roles").upsert({ user_id: newUserId, role: "vendedor" }, { onConflict: "user_id,role" });

    // Insert sales_reps row
    const { data: rep, error: repErr } = await supabaseAdmin
      .from("sales_reps")
      .upsert(
        {
          user_id: newUserId,
          full_name: data.full_name,
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
          commission_pct: data.commission_pct ?? 0,
          notes: data.notes ?? null,
          invited_by: userId,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (repErr) throw new Error(repErr.message);

    return { ok: true, rep };
  });
