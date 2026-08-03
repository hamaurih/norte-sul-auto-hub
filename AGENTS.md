<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project instructions

## UI standard: shadcn/ui

These rules apply to every frontend or interface change in this repository.

### Required discovery before implementation

1. Read `components.json`, `package.json`, the global CSS file, and the existing `components/ui` directory.
2. Detect the project's package manager, framework, Tailwind version, shadcn style/base, icon library, aliases, and installed components. Do not assume defaults.
3. Before creating custom UI, search in this order:
   - existing local components;
   - the official shadcn/ui registry;
   - configured registries in `components.json`.
4. For shadcn-compatible projects, use the project's package runner with the current CLI:
   - inspect: `npx shadcn@latest info`;
   - search: `npx shadcn@latest search @shadcn -q "<need>"`;
   - documentation: `npx shadcn@latest docs <component>`;
   - preview source: `npx shadcn@latest view @shadcn/<component>`.
5. Prefer composing existing primitives and blocks over creating parallel bespoke components. Create custom UI only when the registries do not provide an adequate base.

### Safe adoption and updates

- Do not clone, vendor, or add the entire `shadcn-ui/ui` repository as a dependency or submodule.
- Add only the components required by the feature.
- Never overwrite an installed component blindly. First use `--dry-run` and `--diff`, then merge upstream changes while preserving local behavior and design.
- Do not use `--overwrite` unless the user explicitly authorizes it.
- Preserve the current framework, Tailwind version, shadcn base/style, aliases, icon library, CSS variables, routes, and Lovable-compatible structure unless a migration is explicitly requested.
- A UI task does not authorize changes to business logic, authentication, RLS, tenant isolation, database schema, API contracts, payments, secrets, or deployment configuration.
- Keep patches incremental and keep the connected branch buildable. Never rewrite published Git history.

### Composition and quality

- Use semantic theme tokens instead of arbitrary foundational colors.
- Reuse shadcn primitives for buttons, fields, cards, tables, dialogs, sheets, alerts, badges, skeletons, empty states, and destructive confirmations.
- Preserve accessibility requirements: labels, keyboard operation, focus states, titles for dialogs/sheets, and ARIA validation states.
- Design loading, empty, error, success, disabled, and mobile states—not only the happy path.
- Match the product's own brand. shadcn is the component foundation, not a reason to make different products visually identical.
- After changes, run the relevant lint, typecheck, tests, and build scripts available in `package.json`.
- Report which registry items were reused, which files changed, and any remaining migration risk.

Official references:
- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/components
- https://ui.shadcn.com/docs/cli
- https://ui.shadcn.com/docs/registry
- https://github.com/shadcn-ui/ui
