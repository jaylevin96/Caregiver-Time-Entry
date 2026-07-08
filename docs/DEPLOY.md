# Deploy to Vercel

## Prerequisites

- Supabase migrations applied (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))
- GitHub repo (optional but recommended)

## Vercel project setup

1. Push this project to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

## Environment variables

Add these in Vercel → Project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

Apply to **Production**, **Preview**, and **Development**.

## Deploy

Vercel deploys automatically on push to your main branch.

Local preview of production build:

```bash
npm run build
npm run preview
```

## After deploy

1. Share the Vercel URL with caregivers and your dad
2. Confirm sign-up and login work on a phone
3. Optional: add a custom domain in Vercel project settings

## Notes

- `vercel.json` rewrites all routes to `index.html` for React Router
- Never add the Supabase **service_role** key to Vercel — only the anon key
- RLS protects all data; the anon key is safe in the frontend
