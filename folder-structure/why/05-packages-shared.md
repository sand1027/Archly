# Why: packages/ Shared Code

## The problem without shared packages
Without shared packages, the frontend would either:
1. Have to manually keep TypeScript types in sync with Go structs — error-prone
2. Use `any` everywhere — loses all type safety

## The solution: codegen pipeline

```
Go handler annotations (swaggo)
         ↓
openapi.yaml (generated)
         ↓
openapi-typescript (codegen)
         ↓
packages/types/generated/api.ts
         ↓
apps/web imports @paperdraw/types
(TypeScript knows every request body and response shape)
```

## packages/types

| Folder / File | Why it exists |
|---|---|
| `src/index.ts` | Re-exports everything from `generated/api.ts` — consumers import from `@paperdraw/types` |
| `generated/api.ts` | Auto-generated — NEVER edit this file, it is always overwritten by codegen |
| `package.json` | Package name `@paperdraw/types` — importable by `apps/web` as a workspace dependency |
| `tsconfig.json` | TypeScript config — extends root config, enables strict mode |

## packages/codegen

| File | Why it exists |
|---|---|
| `openapi-ts.config.ts` | Points `openapi-typescript` at the source YAML and the output file |
| `package.json` | Has a `generate` script that runs the codegen tool |

## Running codegen

```bash
# Full pipeline (run this after changing any Go handler)
./scripts/codegen.sh

# Which runs:
# 1. make swagger  (in apps/api)     → regenerates openapi.yaml
# 2. npm run generate (in packages/codegen) → regenerates api.ts
```

## Rule: never edit generated files
Files in `packages/types/generated/` are always overwritten.
Any manual edit will be lost on the next codegen run.
If the types are wrong, fix the Go handler annotations and re-run codegen.
