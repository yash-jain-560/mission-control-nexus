import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sseData(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function getSnapshot() {
  const [agents, tickets, history] = await Promise.all([
    prisma.agent.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        metadata: true,
        lastHeartbeat: true,
      },
    }),
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
      },
    }),
    prisma.agentHistory.findMany({
      orderBy: { timestamp: 'desc' },
      take: 40,
      select: {
        id: true,
        agentId: true,
        changeType: true,
        timestamp: true,
      },
    }),
  ])

  const activities = history.map((h) => ({
    id: h.id,
    type: h.changeType === 'ERROR' ? 'system' : 'agent',
    message: `${h.agentId} ${h.changeType.toLowerCase().replace('_', ' ')}`,
    timestamp: h.timestamp,
  }))

  return { agents, tickets, activities }
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
        } catch {
          push({ type: 'activity', activity: { id: crypto.randomUUID(), type: 'system', message: 'SSE refresh failed', timestamp: new Date().toISOString() } })
        }
      }, 4000)

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
