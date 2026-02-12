# Deployment Guide - Mission Control Nexus API

This document covers the deployment process for the Mission Control Nexus API on Vercel, Netlify, Railway, or self-hosted environments.

## Build Status

✅ **Build Successful**: The application successfully builds with Next.js 14.2.35
- All TypeScript files compile without errors
- All API routes are properly configured as dynamic routes
- Static pages are prerendered correctly

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- PostgreSQL database (Neon or Supabase recommended)
- GitHub account with repository access

## Environment Variables Required

Create a `.env.local` file with the following variables:

```env
# Database Connection (Required for runtime)
DATABASE_URL="postgresql://user:password@host:5432/nexus?schema=public"

# Optional
NODE_ENV="production"
```

### Database Options

#### Option 1: Neon (Recommended - Free Tier)
1. Go to https://console.neon.tech
2. Create a new account and project
3. Create a database
4. Copy the connection string
5. Add to `.env.local` as `DATABASE_URL`
6. Run `npm run prisma:push` to create tables

#### Option 2: Supabase
1. Go to https://supabase.com
2. Create a new project
3. Copy the PostgreSQL connection string
4. Add to `.env.local` as `DATABASE_URL`
5. Run `npm run prisma:push` to create tables

#### Option 3: Local PostgreSQL
```bash
# Install PostgreSQL
# Create database
createdb mission_control_nexus

# Set connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/mission_control_nexus?schema=public"
```

## Deployment Options

### 1. Vercel Deployment (Recommended)

#### Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository connected

#### Steps
1. Connect your GitHub repository to Vercel dashboard
2. Import the project
3. Add environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
4. Click "Deploy"
5. Vercel will automatically build and deploy

#### Command Line (if account is available)
```bash
npm install -g vercel
vercel --prod --yes
```

The deployment URL will be printed at the end.

### 2. Netlify Deployment

#### Prerequisites
- Netlify account (https://netlify.com)
- GitHub repository connected

#### Steps
1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Add environment variables in Netlify dashboard:
   - `DATABASE_URL`: Your PostgreSQL connection string
4. Deploy

### 3. Railway Deployment

#### Prerequisites
- Railway account (https://railway.app)
- GitHub repository

#### Steps
1. Go to Railway dashboard
2. Create new project
3. Connect GitHub repository
4. Add PostgreSQL plugin for database
5. Add environment variable `DATABASE_URL` from the PostgreSQL service
6. Deploy

#### Command Line
```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

### 4. Docker Deployment (Self-Hosted)

#### Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Build and Run
```bash
docker build -t mission-control-nexus .
docker run -e DATABASE_URL="..." -p 3000:3000 mission-control-nexus
```

### 5. Heroku Deployment

#### Prerequisites
- Heroku CLI installed
- Heroku account

#### Steps
```bash
heroku create mission-control-nexus
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set DATABASE_URL=$(heroku config:get DATABASE_URL)
git push heroku main
```

## Post-Deployment Setup

### 1. Create Database Tables
```bash
npm run prisma:push
```

### 2. Verify API Endpoints
```bash
# Health check
curl https://your-deployment-url/api/health

# Get agents
curl https://your-deployment-url/api/agents

# Get tickets
curl https://your-deployment-url/api/tickets

# Get system status
curl https://your-deployment-url/api/monitor/status
```

### 3. Test Create Ticket
```bash
curl -X POST https://your-deployment-url/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Ticket",
    "description": "Testing the API",
    "priority": "HIGH"
  }'
```

### 4. Test Agent Heartbeat
```bash
curl -X POST https://your-deployment-url/api/agents/test-agent-1/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "status": "ONLINE",
    "health": {
      "status": "healthy",
      "metrics": {
        "uptime": 3600,
        "memoryUsage": 256,
        "cpuUsage": 15
      }
    }
  }'
```

## Monitoring & Logs

### Vercel
- Dashboard: https://vercel.com/dashboard
- Real-time logs in deployment details
- Function analytics

### Railway
- Railway Dashboard: https://railway.app
- Real-time logs
- Deploy history

### Custom/Self-Hosted
```bash
# Check logs
npm run start

# Use PM2 for process management
npm install -g pm2
pm2 start "npm run start" --name "nexus-api"
pm2 logs nexus-api
```

## Continuous Deployment

### GitHub Actions (Automated Testing & Deployment)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Troubleshooting

### Build Failures
1. Check Node.js version: `node --version` (should be 18+)
2. Clear npm cache: `npm cache clean --force`
3. Delete node_modules: `rm -rf node_modules && npm install`
4. Check build logs in deployment platform

### Database Connection Issues
1. Verify DATABASE_URL format
2. Test connection: `psql $DATABASE_URL`
3. Check firewall rules (if self-hosted)
4. Ensure database is running and accessible

### TypeScript Errors
1. Run `npm run typecheck` locally
2. Check for any uncommitted changes
3. Ensure all imports are correct

### API Errors
1. Check `/api/health` endpoint
2. Monitor `/api/monitor/status` for system health
3. Review logs in deployment platform
4. Check database migration status

## Performance Optimization

### Database
- Enable query result caching
- Use indexes (already configured in Prisma schema)
- Consider read replicas for high load

### API
- Enable compression in Next.js config
- Use CDN for static assets
- Implement rate limiting

### Monitoring
- Set up error tracking (Sentry, DataDog)
- Monitor API response times
- Track database performance

## Scaling

### Horizontal Scaling
- Deploy to multiple regions (Vercel edge functions)
- Use load balancer (Railway, AWS ELB)
- Database connection pooling

### Database Scaling
- Read replicas for scaling reads
- Caching layer (Redis)
- Database sharding for very large datasets

## Security Checklist

- [ ] DATABASE_URL is protected (not in version control)
- [ ] HTTPS enabled on all endpoints
- [ ] API authentication implemented if needed
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation in place
- [ ] SQL injection protection via Prisma ORM
- [ ] Regular security updates

## Support

For issues or questions:
1. Check GitHub Issues
2. Review deployment platform documentation
3. Check API logs and status endpoint
4. Verify database connectivity

## Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
