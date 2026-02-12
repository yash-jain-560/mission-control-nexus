import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { logActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';

export const dynamic = 'force-dynamic';

// POST /api/agents - Register a new agent
async function registerAgent(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = body.id as string;
    const name = body.name as string;
    const type = (body.type as string) || 'main';
    const status = ((body.status as string) || 'IDLE').toUpperCase();
    const tokensAvailable = (body.tokensAvailable as number) || 1000000;
    const config = (body.config as Record<string, any>) || {};

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing required fields: id, name' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['IDLE', 'WORKING', 'THINKING', 'OFFLINE'];
    const finalStatus = validStatuses.includes(status) ? status : 'IDLE';

    const agent = await prisma.agent.upsert({
      where: { id },
      update: {
        name,
        type,
        status: finalStatus,
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        config,
      },
      create: {
        id,
        name,
        type,
        status: finalStatus,
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        config,
      },
    });

    // Log agent registration
    await logActivity({
      agentId: id,
      activityType: ACTIVITY_TYPES.SYSTEM_EVENT,
      description: `Agent ${agent ? 'updated' : 'registered'}: ${name}`,
      metadata: { type, status: finalStatus, config },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}

// GET /api/agents - List all agents with detailed stats
async function listAgents(request: NextRequest) {
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
        const now = Date.now();
        const lastHeartbeatTime = agent.lastHeartbeat.getTime();

        // Calculate online status based on heartbeat
        const sixtySecondsMs = 60000;
        const isOnline = (now - lastHeartbeatTime) <= sixtySecondsMs;

        // Determine effective status
        let effectiveStatus = agent.status;
        if (!isOnline) {
          effectiveStatus = 'OFFLINE';
        } else if (agent.status === 'OFFLINE') {
          effectiveStatus = 'IDLE';
        }

        // Calculate time in current status
        const currentStatusSince = agent.currentStatusSince.getTime();
        const timeInCurrentStatus = now - currentStatusSince;

        // Parse status history for stats
        const statusHistory = Array.isArray(agent.statusHistory) ? agent.statusHistory : [];
        const statusDurations: Record<string, number[]> = {};

        statusHistory.forEach((transition: any) => {
          if (transition.status && transition.durationMs) {
            if (!statusDurations[transition.status]) {
              statusDurations[transition.status] = [];
            }
            statusDurations[transition.status].push(transition.durationMs);
          }
        });

        // Calculate average time per status
        const averageStatusTimes: Record<string, number> = {};
        Object.entries(statusDurations).forEach(([status, durations]) => {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
          averageStatusTimes[status] = Math.round(avg);
        });

        // Get recent activities with full token breakdown
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
            cacheHits: true,
            timestamp: true,
            toolName: true,
            duration: true,
            ticketId: true,
            costTotal: true,
          },
        }) : [];

        // Calculate token stats
        const totalInputTokens = recentActivities.reduce((acc, a) => acc + a.inputTokens, 0);
        const totalOutputTokens = recentActivities.reduce((acc, a) => acc + a.outputTokens, 0);
        const totalCacheHits = recentActivities.reduce((acc, a) => acc + (a.cacheHits || 0), 0);
        const totalCost = recentActivities.reduce((acc, a) => acc + (a.costTotal || 0), 0);
        const totalTokens = totalInputTokens + totalOutputTokens;

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
          status: effectiveStatus,
          tokensAvailable: agent.tokensAvailable,
          tokensUsed: agent.tokensUsed,
          isOnline,
          lastHeartbeat: agent.lastHeartbeat.toISOString(),
          lastHeartbeatAgo: `${Math.floor((now - lastHeartbeatTime) / 1000)}s`,
          lastActive: agent.lastActive.toISOString(),
          currentStatusSince: agent.currentStatusSince.toISOString(),
          timeInCurrentStatus,
          config: agent.config,
          health: agent.health,
          recentActivities: recentActivities.map(a => ({
            id: a.id,
            type: a.activityType,
            description: a.description,
            tokens: a.inputTokens + a.outputTokens,
            inputTokens: a.inputTokens,
            outputTokens: a.outputTokens,
            cost: a.costTotal,
            timestamp: a.timestamp.toISOString(),
            tool: a.toolName,
          })),
          tokenStats: {
            recent: totalTokens,
            total: agent.tokensUsed,
            input: totalInputTokens,
            output: totalOutputTokens,
            cacheHits: totalCacheHits,
            cost: totalCost,
          },
          assignedTickets,
          statusHistory: statusHistory.slice(-10),
          statusTransitions: {
            count: statusHistory.length,
            averageTimes: averageStatusTimes,
          },
        };
      })
    );

    // Calculate totals
    const totalTokensUsed = enrichedAgents.reduce((acc, a) => acc + a.tokensUsed, 0);
    const onlineCount = enrichedAgents.filter(a => a.isOnline).length;
    const offlineCount = enrichedAgents.filter(a => !a.isOnline).length;

    // Status breakdown
    const statusBreakdown = enrichedAgents.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// Wrap handlers with activity logging
export const GET = withActivityLogging(listAgents, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const POST = withActivityLogging(registerAgent, { 
  activityType: 'api_call',
  agentId: 'system'
});