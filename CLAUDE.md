# GymTracker — Dev Notes

## Deploying changes to Vercel (the live site)

```bash
# Build check first (catches TS errors)
npm run build

# Deploy to production
npx vercel --prod
```

Live URL: **https://gymtracker-inky.vercel.app**

---

## Applying Supabase schema changes

Schema changes (new tables, columns, policies, indexes) go through the Supabase MCP tool:

```
mcp__claude_ai_Supabase__apply_migration
  project_id: ruqwmwxsoizviijmtpey
  name: descriptive_snake_case_name
  query: <SQL>
```

For one-off data fixes or SELECT queries, use:
```
mcp__claude_ai_Supabase__execute_sql
  project_id: ruqwmwxsoizviijmtpey
  query: <SQL>
```

**Never use `execute_sql` for DDL** (CREATE TABLE, ALTER, etc.) — use `apply_migration` so changes are tracked.

---

## Vercel environment variables

Already set in the Vercel project (no need to re-add):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

To add/change them via CLI:
```bash
echo "value" | npx vercel env add VAR_NAME production
npx vercel --prod   # redeploy to bake them into the build
```

`NEXT_PUBLIC_*` vars are baked in at **build time** — a redeploy is required after changing them.

---

## Supabase project

- **Project ID**: `ruqwmwxsoizviijmtpey`
- **URL**: `https://ruqwmwxsoizviijmtpey.supabase.co`
- **Org**: OnezSadim's Org (`butrfpqbefwnulgqnfgf`)
- **Region**: eu-west-1

Full schema is documented at the top of `src/lib/supabase.ts`.

---

## Common gotchas

- **Profiles table**: new users get a profile row via the `handle_new_user` trigger. If it doesn't fire (e.g. existing users before trigger was added), call `ensureProfile(userId, email)` before any write that references `profiles`.
- **RLS**: every table has Row Level Security enabled. If a query silently returns nothing or 403s, check that the right policy exists.
- **`.single()` vs `.maybeSingle()`**: use `.maybeSingle()` when 0 rows is a valid result — `.single()` throws a 406.
