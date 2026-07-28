import { useEffect, useState } from "react";
import {
  activeTenantSlug,
  setActiveTenantSlug,
} from "@/integrations/supabase/client";

const environments = [
  { slug: "norte-sul-real", label: "Conta real" },
  { slug: "norte-sul-demo", label: "Conta de teste" },
] as const;

export function TenantEnvironmentSwitcher() {
  const [value, setValue] = useState("norte-sul-real");

  useEffect(() => {
    setValue(activeTenantSlug());
  }, []);

  return (
    <div className="border-b border-border bg-card px-4 py-2">
      <label className="mx-auto flex max-w-7xl items-center justify-end gap-2 text-xs font-semibold">
        <span className="uppercase text-muted-foreground">Ambiente</span>
        <select
          value={value}
          onChange={(event) => {
            const slug = event.target.value;
            setValue(slug);
            setActiveTenantSlug(slug);
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
        >
          {environments.map((environment) => (
            <option key={environment.slug} value={environment.slug}>
              {environment.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
