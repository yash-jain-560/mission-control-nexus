import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sseData(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function getSnapshot() {
  const [agents, tickets, activities, agentHistory] = await Promise.all([
    prisma.agent.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      take: 50,
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    }) as any,
    prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        assigneeId: true,
        createdAt: true,
        dueDate: true,
      },
    }),
    prisma.activity.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      select: {
        id: true,
        agentId: true,
        activityType: true,
        description: true,
        timestamp: true,
        inputTokens: true,
        outputTokens: true,
        toolName: true,
      },
    }),
    prisma.agentHistory.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        agentId: true,
        changeType: true,
        timestamp: true,
        fromValue: true,
        toValue: true,
      },
    }),
  ])

  // Enrich agents with online status
  const enrichedAgents = agents.map((agent: any) => {
    const timeSinceHeartbeat = Date.now() - new Date(agent.lastHeartbeat).getTime()
    const isOnline = timeSinceHeartbeat <= 30000

    return {
      ...agent,
      isOnline,
      lastHeartbeat: agent.lastHeartbeat.toISOString?.() || agent.lastHeartbeat,
    }
  })

  // Convert activities to feed format
  const activityFeed = activities.map((a) => ({
    id: a.id,
    agentId: a.agentId,
    type: a.activityType,
    description: a.description,
    message: `${a.description}`,
    timestamp: a.timestamp.toISOString?.() || a.timestamp,
    tokens: a.inputTokens + a.outputTokens,
  }))

  // Summary stats
  const totalTokens = agents.reduce((acc: number, a: any) => acc + (a.tokensUsed || 0), 0)
  const onlineCount = enrichedAgents.filter((a: any) => a.isOnline).length

  return { 
    agents: enrichedAgents, 
    tickets, 
    activities: activityFeed,
    statusHistory: agentHistory,
    summary: {
      totalAgents: enrichedAgents.length,
      onlineAgents: onlineCount,
      offlineAgents: enrichedAgents.length - onlineCount,
      totalTokensUsed: totalTokens,
      systemHealth: onlineCount / (enrichedAgents.length || 1) > 0.7 ? 'Healthy' : 'Degraded',
    },
  }
}

export async function GET(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const push = (payload: unknown) => controller.enqueue(encoder.encode(sseData(payload)))

      push({ type: 'connected', ts: new Date().toISOString() })

      const snapshot = await getSnapshot()
      push({ type: 'snapshot', ...snapshot })

      const interval = setInterval(async () => {
        try {
          const next = await getSnapshot()
          push({ type: 'snapshot', ...next })
        } catch (error) {
          console.error('SSE refresh error:', error)
          push({ type: 'activity', activity: { id: crypto.randomUUID(), agentId: 'system', type: 'system', message: 'SSE refresh failed', timestamp: new Date().toISOString() } })
        }
      }, 3000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // noop
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
