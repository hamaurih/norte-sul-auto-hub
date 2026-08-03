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
4. Use the project's package manager for the current shadcn CLI:
   - npm: `npx shadcn@latest ...`;
   - pnpm: `pnpm dlx shadcn@latest ...`;
   - Bun: `bunx --bun shadcn@latest ...`.
5. With that runner, always inspect `info`; search with `search @shadcn -q "<need>"`; load documentation with `docs <component>`; and preview source with `view @shadcn/<component>` before implementing.
6. Prefer composing existing primitives and blocks over creating parallel bespoke components. Create custom UI only when the registries do not provide an adequate base.

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

## Agent delivery standard

Apply this workflow to every non-trivial feature, integration, migration, or bug fix.

### 1. Orient and define success

- Read repository instructions and the relevant architecture before editing.
- Identify the real user outcome, current behavior, constraints, affected systems, and risks.
- Define observable acceptance criteria, including unhappy paths and regression boundaries.
- Load any applicable specialized guidance before planning, such as shadcn, Supabase, security, payments, or framework-specific instructions.

### 2. Plan before broad changes

- Produce a short implementation plan covering files or layers, data flow, dependencies, validation, and rollback risk.
- Ask the user only for decisions that materially change the solution; otherwise proceed with the safest reversible assumption.
- For large or high-risk changes, inspect and present the expected diff or affected surface before applying it.
- Do not mix unrelated refactors with the requested feature or fix.

### 3. Build incrementally

- Implement the smallest coherent vertical slice first.
- Keep each patch focused and preserve existing functionality.
- Validate after each logical slice instead of waiting until the end.
- When a validation command fails, diagnose the actual error, fix it, and rerun the narrowest relevant check.
- Do not hide failures with disabled tests, suppressed errors, fake success states, or silent fallbacks.

### 4. Use real integration states

- Once real data or an external integration is requested, do not silently substitute sample data, hardcoded success, fake accounts, or placeholder records.
- Keep one clear source of truth for remote state.
- Provide explicit loading, empty, error, unauthorized, and retry states.
- Keep secrets on trusted server-side paths. Never expose service-role, admin, payment, or provider secrets in frontend code, logs, screenshots, fixtures, or chat.

### 5. Verify the full story

Before declaring completion:

- run the relevant lint, typecheck, unit/integration tests, and production build available in the repository;
- exercise the critical user flow from entry to result;
- verify desktop and mobile behavior for interface changes;
- inspect the rendered preview, not only compilation;
- confirm errors and empty states are understandable;
- report concrete verification evidence, changed files, remaining risks, and anything that still needs external configuration.

### External reference boundary: 10x

The repository https://github.com/10x-app-builder/10x may be consulted only for high-level, non-code workflow ideas because it is licensed under PolyForm Noncommercial 1.0.0.

- Do not copy, adapt, translate, vendor, or derive code, prompts, assets, skills, schemas, or implementation details from it into commercial projects.
- Do not add it as a dependency, submodule, template, registry, or code-generation source.
- Independently implement any generally useful process idea using this project's own stack, requirements, and licensed dependencies.
