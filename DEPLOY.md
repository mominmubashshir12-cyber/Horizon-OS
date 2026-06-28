# Horizon OS Go-Live Checklist

This checklist covers the steps to deploy Horizon OS to a production Ubuntu 22.04 VPS.

## Prerequisites
- [ ] VPS provisioned (Ubuntu 22.04)
- [ ] PostgreSQL installed and DB created

## Deployment Steps
- [ ] `.env` files configured on server (never commit `.env` to git)
- [ ] `npm install` run in backend and desktop

## Database Migration (Run on VPS)
- [ ] `npx prisma migrate dev --name sqlite-to-postgres`
- [ ] `npx prisma generate`

## Start Application
- [ ] PM2 started with `ecosystem.config.js` in both backend and desktop
- [ ] Nginx configs copied to `/etc/nginx/sites-available/` and symlinked to `/etc/nginx/sites-enabled/`
- [ ] Certbot SSL installed for both domains (`api.yourdomain.com` and `app.yourdomain.com`)

## Verification
- [ ] Test login from mobile app hitting `https://api.yourdomain.com`
- [ ] Verify cron jobs firing: `pm2 logs horizon-backend`
- [ ] Create first real employee account and delete any test data
