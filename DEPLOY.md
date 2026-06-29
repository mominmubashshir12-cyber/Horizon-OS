# Horizon OS Go-Live Checklist

Deployment target: **Railway** (backend + PostgreSQL) and **Vercel** (desktop).
Mobile is built separately with EAS.

```
Mobile App (APK on phones) ─┐
                            ├─→ Railway Backend (API + PostgreSQL)
Desktop App (Vercel URL) ───┘
```

Both clients talk to the same Railway backend and the same database, so changes
made on mobile appear on desktop and vice versa.

---

## 1. Database — PostgreSQL on Railway

The schema now uses `provider = "postgresql"`. The old SQLite migration history
has been removed; a fresh PostgreSQL baseline is generated on first migrate.

- [ ] In Railway, create a project and add the **PostgreSQL** plugin.
      Railway auto-injects `DATABASE_URL` into the backend service.
- [ ] Locally (or in a one-off Railway shell) generate the initial migration
      against PostgreSQL:
      - `npx prisma migrate dev --name init-postgres`
      - `npx prisma generate`
- [ ] Commit the new `prisma/migrations/` folder so production can replay it.

> JSON fields: `Quotation.items` and `SyncLog.payload` are now native `Json`.

---

## 2. Backend — Railway

Files already in the repo:
- `backend/Procfile` → `web: node dist/index.js`
- `backend/railway.json` → builds with Nixpacks and runs
  `npm run build && npx prisma migrate deploy && node dist/index.js` on deploy.
  `migrate deploy` applies committed migrations without creating new ones.

Set these env vars on the **Railway dashboard** (never commit them):

| Variable             | Value                                                        |
|----------------------|--------------------------------------------------------------|
| `DATABASE_URL`       | provided automatically by the Railway PostgreSQL plugin      |
| `JWT_SECRET`         | strong random string (server throws on startup if missing)   |
| `JWT_REFRESH_SECRET` | a different strong random string (also required)             |
| `NODE_ENV`           | `production`                                                 |
| `CORS_ORIGINS`       | your Vercel desktop URL, e.g. `https://horizon-os.vercel.app`|

> Do **not** set `PORT` — Railway injects it and the server already reads
> `process.env.PORT`.
> `CORS_ORIGINS` is required: without it the desktop app's browser requests are
> blocked by CORS (it defaults to `http://localhost:3000`).

- [ ] Deploy from GitHub → select the `backend` folder as the service root.
- [ ] Confirm first deploy log shows `prisma migrate deploy` applied successfully.
- [ ] Note the public backend URL (e.g. `https://horizon-backend.up.railway.app`).

---

## 3. Desktop — Vercel

- [ ] New Project → import repo → set root directory to `desktop`.
- [ ] Set env var `NEXT_PUBLIC_API_URL` to the Railway backend URL **including the
      `/api` suffix**, e.g. `https://horizon-backend.up.railway.app/api`.
      (`desktop/.env.production` documents this; the Vercel dashboard value wins.)
- [ ] Deploy and note the Vercel URL (e.g. `https://horizon-os.vercel.app`).
- [ ] Go back to Railway and make sure `CORS_ORIGINS` matches this Vercel URL.

---

## 4. Mobile — Expo / EAS

- [ ] Update `mobile/constants/api.ts` → set `BASE_URL` to the Railway HTTPS URL
      (with `/api` suffix).
- [ ] Build the APK: `eas build -p android --profile production`.
- [ ] Distribute the APK to technicians.

> Mobile cannot auto-update like the web apps. For JS/UI-only changes, consider
> Expo Updates (OTA): add `expo-updates`, configure `app.json`, then
> `eas update --branch production` — technicians get the update on next launch
> without reinstalling the APK.

---

## 5. Auto-deploy & branch strategy

- **`main`** → every push auto-deploys backend (Railway) and desktop (Vercel).
- **`dev`**  → test changes here first. Vercel creates a preview URL per branch.
- Workflow: change on `dev` → test on preview → merge to `main` → auto-deploys live.
- Mobile is the only manual step (EAS build, unless OTA is configured).

---

## 6. Verification

- [ ] Log in from the mobile app hitting the Railway backend.
- [ ] Confirm desktop loads and authenticates against the same backend.
- [ ] Verify cron jobs fire (check Railway deploy logs).
- [ ] Create the first real employee account and delete any test/seed data.
