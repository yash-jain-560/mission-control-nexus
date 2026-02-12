import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = body.id as string;
    const name = body.name as string;
    const type = (body.type as string) || 'main';
    const status = ((body.status as string) || 'active').toLowerCase();
    const tokensAvailable = (body.tokensAvailable as number) || 1000000;

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing required fields: id, name' }, { status: 400 });
    }

    const agent = await prisma.agent.upsert({
      where: { id },
      update: {
        name,
        type,
        status,
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
      } as any,
      create: {
        id,
        name,
        type,
        status,
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
      } as any,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}

// GET /api/agents - List all agents with detailed stats
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const detailed = searchParams.get('detailed') === 'true';
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastHeartbeat: 'desc' },
        include: {
          heartbeats: {
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
          history: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);
    
    // Enrich agents with detailed stats and activities if requested
    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
        const thirtySecondsMs = 30000;
        const isOnline = timeSinceHeartbeat <= thirtySecondsMs;
        
        // Get token stats
        const recentActivities = detailed ? await prisma.activity.findMany({
          where: { agentId: agent.id },
          orderBy: { timestamp: 'desc' },
          take: 20,
          select: {
            id: true,
            activityType: true,
            description: true,
            inputTokens: true,
            outputTokens: true,
            timestamp: true,
            toolName: true,
            duration: true,
          },
        }) : [];
        
        const totalTokens = recentActivities.reduce(
          (acc, a) => acc + (a.inputTokens + a.outputTokens),
          0
        );
        
        // Get assigned tickets
        const assignedTickets = detailed ? await prisma.ticket.findMany({
          where: { assigneeId: agent.id },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        }) : [];
        
        return {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          tokensAvailable: agent.tokensAvailable,
          tokensUsed: agent.tokensUsed,
          isOnline,
          lastHeartbeat: agent.lastHeartbeat.toISOString(),
          lastHeartbeatAgo: `${Math.floor(timeSinceHeartbeat / 1000)}s`,
          metadata: agent.metadata,
          recentActivities: recentActivities.map(a => ({
            id: a.id,
            type: a.activityType,
            description: a.description,
            tokens: a.inputTokens + a.outputTokens,
            timestamp: a.timestamp.toISOString(),
            tool: a.toolName,
          })),
          tokenStats: {
            recent: totalTokens,
            total: agent.tokensUsed,
          },
          assignedTickets,
          statusHistory: agent.history.map(h => ({
            id: h.id,
            timestamp: h.timestamp.toISOString(),
            changeType: h.changeType,
            previousStatus: (h.fromValue as any)?.status,
            newStatus: (h.toValue as any)?.status,
          })),
        };
      })
    );
    
    // Calculate totals
    const totalTokensUsed = enrichedAgents.reduce((acc, a) => acc + a.tokensUsed, 0);
    const onlineCount = enrichedAgents.filter(a => a.isOnline).length;
    const offlineCount = enrichedAgents.filter(a => !a.isOnline).length;
    
    return NextResponse.json({
      agents: enrichedAgents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total,
        online: onlineCount,
        offline: offlineCount,
        totalTokensUsed,
        averageTokensPerAgent: Math.floor(totalTokensUsed / (enrichedAgents.length || 1)),
      },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
