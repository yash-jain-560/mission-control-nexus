import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/snapshot - Complete dashboard state
export async function GET(request: NextRequest) {
  try {
    const [agents, tickets, activities, agentHistory] = await Promise.all([
      prisma.agent.findMany({
        orderBy: { lastHeartbeat: 'desc' },
        include: {
          heartbeats: {
            orderBy: { timestamp: 'desc' },
            take: 3,
          },
        },
      }),
      prisma.ticket.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.findMany({
        orderBy: { timestamp: 'desc' },
        take: 100,
      }),
      prisma.agentHistory.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
    ]);

    // Enrich agents with status
    const enrichedAgents = agents.map(agent => {
      const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      const isOnline = timeSinceHeartbeat <= 30000;
      
      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        isOnline,
        tokensUsed: agent.tokensUsed,
        tokensAvailable: agent.tokensAvailable,
        lastHeartbeat: agent.lastHeartbeat.toISOString(),
        metadata: agent.metadata,
      };
    });

    // Enrich activities
    const enrichedActivities = activities.map(a => ({
      id: a.id,
      agentId: a.agentId,
      type: a.activityType,
      description: a.description,
      timestamp: a.timestamp.toISOString(),
      tokens: a.inputTokens + a.outputTokens,
    }));

    // Calculate summary stats
    const totalTokens = agents.reduce((acc, a) => acc + a.tokensUsed, 0);
    const onlineCount = enrichedAgents.filter(a => a.isOnline).length;
    const ticketStats = {
      total: tickets.length,
      byStatus: {
        Backlog: tickets.filter(t => t.status === 'Backlog').length,
        Assigned: tickets.filter(t => t.status === 'Assigned').length,
        InProgress: tickets.filter(t => t.status === 'InProgress').length,
        Review: tickets.filter(t => t.status === 'Review').length,
        Done: tickets.filter(t => t.status === 'Done').length,
      },
      byPriority: {
        CRITICAL: tickets.filter(t => t.priority === 'CRITICAL').length,
        HIGH: tickets.filter(t => t.priority === 'HIGH').length,
        MEDIUM: tickets.filter(t => t.priority === 'MEDIUM').length,
        LOW: tickets.filter(t => t.priority === 'LOW').length,
      },
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      agents: enrichedAgents,
      tickets,
      activities: enrichedActivities,
      statusHistory: agentHistory.map(h => ({
        id: h.id,
        agentId: h.agentId,
        changeType: h.changeType,
        timestamp: h.timestamp.toISOString(),
        previousValue: h.fromValue,
        newValue: h.toValue,
      })),
      summary: {
        totalAgents: enrichedAgents.length,
        onlineAgents: onlineCount,
        offlineAgents: enrichedAgents.length - onlineCount,
        totalTokensUsed: totalTokens,
        tickets: ticketStats,
        systemHealth: onlineCount / (enrichedAgents.length || 1) > 0.7 ? 'Healthy' : 'Degraded',
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard snapshot:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard snapshot' }, { status: 500 });
  }
}
