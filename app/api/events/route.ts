import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sseData(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function getSnapshot() {
  const [agents, tickets, activities] = await Promise.all([
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
        cacheHits: true,
        toolName: true,
        duration: true,
      },
    }),
  ])

  // Enrich agents with online status and refined status tracking
  const enrichedAgents = agents.map((agent: any) => {
    const now = Date.now()
    const lastHeartbeatTime = new Date(agent.lastHeartbeat).getTime()
    const timeSinceHeartbeat = now - lastHeartbeatTime
    const sixtySecondsMs = 60000
    const isOnline = timeSinceHeartbeat <= sixtySecondsMs

    // Calculate time in current status
    const currentStatusSince = new Date(agent.currentStatusSince || agent.lastHeartbeat).getTime()
    const timeInCurrentStatus = now - currentStatusSince

    // Determine effective status
    let effectiveStatus = agent.status
    if (!isOnline) {
      effectiveStatus = 'OFFLINE'
    } else if (agent.status === 'OFFLINE') {
      effectiveStatus = 'IDLE'
    }

    // Parse status history
    const statusHistory = Array.isArray(agent.statusHistory) ? agent.statusHistory : []

    // Calculate recent token stats from activities
    const agentActivities = activities.filter((a: any) => a.agentId === agent.id)
    const totalInput = agentActivities.reduce((acc: number, a: any) => acc + (a.inputTokens || 0), 0)
    const totalOutput = agentActivities.reduce((acc: number, a: any) => acc + (a.outputTokens || 0), 0)
    const totalCacheHits = agentActivities.reduce((acc: number, a: any) => acc + (a.cacheHits || 0), 0)

    return {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: effectiveStatus,
      isOnline,
      tokensUsed: agent.tokensUsed,
      tokensAvailable: agent.tokensAvailable,
      lastHeartbeat: agent.lastHeartbeat.toISOString?.() || agent.lastHeartbeat,
      timeInCurrentStatus,
      statusHistory,
      tokenStats: {
        recent: totalInput + totalOutput,
        total: agent.tokensUsed,
        input: totalInput,
        output: totalOutput,
        cacheHits: totalCacheHits,
      },
      config: agent.config,
      metadata: agent.metadata,
    }
  })

  // Convert activities to feed format with enhanced token data
  const activityFeed = activities.map((a) => ({
    id: a.id,
    agentId: a.agentId,
    type: a.activityType,
    description: a.description,
    message: `${a.description}`,
    timestamp: a.timestamp.toISOString?.() || a.timestamp,
    tokens: a.inputTokens + a.outputTokens,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    cacheHits: a.cacheHits,
    toolName: a.toolName,
    duration: a.duration,
  }))

  // Summary stats with status breakdown
  const totalTokens = agents.reduce((acc: number, a: any) => acc + (a.tokensUsed || 0), 0)
  const onlineCount = enrichedAgents.filter((a: any) => a.isOnline).length

  const statusBreakdown = enrichedAgents.reduce((acc: Record<string, number>, a: any) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  return {
    agents: enrichedAgents,
    tickets,
    activities: activityFeed,
    summary: {
      totalAgents: enrichedAgents.length,
      onlineAgents: onlineCount,
      offlineAgents: enrichedAgents.length - onlineCount,
      totalTokensUsed: totalTokens,
      systemHealth: onlineCount / (enrichedAgents.length || 1) > 0.7 ? 'Healthy' : 'Degraded',
      statusBreakdown,
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
