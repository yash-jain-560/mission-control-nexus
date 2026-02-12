# Quick Start - Mission Control Nexus

## Development (Local)

### Prerequisites
- Node.js 18+
- npm or yarn

### Install & Run
```bash
cd mission-control-nexus
npm install
npm run dev
```

Visit: http://localhost:3000

## Production (Vercel)

### 1. Create Database
```bash
# Go to https://neon.tech
# Create free PostgreSQL database
# Copy connection string
```

### 2. Deploy
```bash
npm install -g vercel
vercel
```

### 3. Configure Environment
In Vercel dashboard, add:
```
DATABASE_URL=postgresql://...
```

### 4. Run Migrations
```bash
npx prisma migrate deploy
```

## API Endpoints

All endpoints available at your Vercel URL (e.g., `https://app.vercel.app`)

### Health Check
```bash
curl https://app.vercel.app/
```

### Create Agent
```bash
curl -X POST https://app.vercel.app/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"MyAgent","status":"idle"}'
```

### Create Ticket
```bash
curl -X POST https://app.vercel.app/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"My Task","priority":"high"}'
```

### List Tickets
```bash
curl 'https://app.vercel.app/api/tickets?status=backlog'
```

### Send Agent Heartbeat
```bash
curl -X POST https://app.vercel.app/api/agents/agent123/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"working","tokenUsage":1000}'
```

### Get System Status
```bash
curl https://app.vercel.app/api/monitor/status
```

## Documentation

- **Full API Docs:** See README.md
- **Deployment Guide:** See DEPLOYMENT.md
- **Database Schema:** See prisma/schema.prisma

## Troubleshooting

### Build Fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Error
- Check DATABASE_URL in Vercel env vars
- Ensure PostgreSQL is accessible from Vercel
- Verify connection string format

### API Returns 404
- Check route files in `app/api/`
- Verify build was successful: `ls .next`
- Check Vercel logs: `vercel logs`

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio UI
npm run lint         # Lint code
```

## Next Features

- WebSocket for real-time updates
- React dashboard UI
- Authentication (JWT/API keys)
- Batch operations
- Agent SDK package

---

**Ready to deploy?** Run `vercel` now! 🚀
