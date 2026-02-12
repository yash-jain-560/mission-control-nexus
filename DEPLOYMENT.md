# Deployment Guide - Mission Control Nexus

## Prerequisites
- GitHub account (repo already set up)
- Vercel account (free tier available)
- PostgreSQL database (Neon recommended)

## Step 1: Database Setup (Neon)

### Create Neon Database
1. Go to https://neon.tech
2. Sign up for free account
3. Create new project
4. Copy the connection string:
   ```
   postgresql://username:password@host.neon.tech/dbname?sslmode=require
   ```

### Test Connection Locally
```bash
# Add to .env.local
DATABASE_URL="postgresql://username:password@host.neon.tech/dbname?sslmode=require"

# Run migrations
npm run prisma:generate
npm run prisma:migrate
```

## Step 2: Deploy to Vercel

### Option A: Via Vercel CLI (Fastest)
```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy from repo directory
cd /home/ubuntu/.openclaw/workspace/mission-control-nexus
vercel

# Follow prompts:
# - Link to GitHub repo? Yes
# - Set project name? mission-control-nexus
# - Framework preset? Next.js
# - Build command? npm run prisma:generate && npm run build
# - Output directory? .next
# - Install command? npm install
```

### Option B: Via Vercel Web Dashboard
1. Go to https://vercel.com/import
2. Connect GitHub repository
3. Select `mission-control-nexus` repo
4. Configure build settings (should auto-detect Next.js)
5. Add environment variables (see Step 3)
6. Click Deploy

## Step 3: Set Environment Variables on Vercel

In Vercel project settings → Environment Variables:

```
DATABASE_URL = postgresql://username:password@host.neon.tech/dbname?sslmode=require
NODE_ENV = production
NEXT_PUBLIC_API_URL = https://your-app.vercel.app  (auto-filled after first deploy)
```

## Step 4: Run Database Migrations on Vercel

After initial deployment, run migrations:

```bash
# Option A: Via Vercel CLI
vercel env pull .env.production.local
npm run prisma:migrate

# Option B: Via GitHub Actions (automatic on deploy)
# Create .github/workflows/prisma-migrate.yml (included in repo)
```

Or manually:
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="your_neon_connection_string"
npm run prisma:migrate
```

## Step 5: Verify Deployment

### Check Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click on `mission-control-nexus` project
3. Check "Deployments" tab for latest build status
4. Look for green checkmark = successful deploy

### Test API Endpoints

Get your Vercel URL (format: `https://mission-control-nexus-xxxxx.vercel.app`)

```bash
# Test health/home page
curl https://mission-control-nexus-xxxxx.vercel.app/

# Test system status
curl https://mission-control-nexus-xxxxx.vercel.app/api/monitor/status

# Create a test agent
curl -X POST https://mission-control-nexus-xxxxx.vercel.app/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestAgent",
    "status": "idle",
    "model": "gpt-4"
  }'

# List agents
curl https://mission-control-nexus-xxxxx.vercel.app/api/agents
```

## Step 6: Continuous Integration (Optional)

### GitHub Actions for Auto-Migration
Create `.github/workflows/prisma-migrate.yml`:

```yaml
name: Prisma Migrate on Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run prisma:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Troubleshooting

### Build Fails: "Cannot find module 'next'"
```bash
# Local: Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Vercel: Click "Redeploy" in dashboard
```

### Database Connection Error
- Verify DATABASE_URL is correct in Vercel env vars
- Check Neon network access rules
- Ensure sslmode=require is in connection string

### Migrations Won't Run
```bash
# Check migration status
npx prisma migrate status

# Reset database (⚠️ CLEARS ALL DATA)
npx prisma migrate reset

# Deploy specific migration
npx prisma migrate resolve --rolled-back 001_init
```

### API Returns 404
- Check Vercel deployment logs
- Ensure `.next` folder is built (`npm run build`)
- Verify route files in `app/api/` directory

## Monitoring & Logs

### View Vercel Logs
```bash
vercel logs mission-control-nexus --follow
```

### View Database Logs
1. Go to Neon console
2. Project → Monitoring
3. Check query logs and connections

## Rollback

If deployment fails:
```bash
# Vercel automatically keeps previous deployments
# Go to Vercel dashboard → Deployments → Click previous build → "Redeploy"

# Or revert Git commit
git revert HEAD
git push origin main
```

## Next Steps After Deployment

1. ✅ API is live on Vercel
2. Create dashboard UI (React components)
3. Add WebSocket for real-time updates
4. Set up alerting for failed tickets
5. Create SDK/npm package for agents
6. Add authentication (JWT/API keys)

## Support

- Vercel docs: https://vercel.com/docs
- Prisma docs: https://www.prisma.io/docs
- Neon docs: https://neon.tech/docs

---

**Deployment Complete!** 🚀

Your API is now live. All endpoints are accessible at:
`https://mission-control-nexus-xxxxx.vercel.app`
