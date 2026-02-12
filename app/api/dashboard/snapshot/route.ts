import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { getDashboardTokenStats } from '@/lib/token-aggregator';
import { getSystemHealth } from '@/lib/heartbeat-service';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/snapshot - Complete dashboard state
async function getDashboardSnapshot(request: NextRequest) {
  try {
    const [agents, tickets, activities, agentHistory, tokenStats, systemHealth] = await Promise.all([
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
        select: {
          id: true,
          agentId: true,
          activityType: true,
          description: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          cacheHits: true,
          timestamp: true,
          duration: true,
          costTotal: true,
          apiEndpoint: true,
          apiMethod: true,
          apiStatusCode: true,
          toolName: true,
          ticketId: true,
        },
      }),
      prisma.agentHistory.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
      getDashboardTokenStats(), // Use the token aggregator for accurate counts
      getSystemHealth(), // Get real system health metrics
    ]);

    // Enrich agents with status
    const enrichedAgents = agents.map(agent => {
      const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      const isOnline = timeSinceHeartbeat <= 30000;
      
      // Calculate time in current status
      const timeInCurrentStatus = Date.now() - agent.currentStatusSince.getTime();
      
      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        isOnline,
        tokensUsed: agent.tokensUsed,
        tokensAvailable: agent.tokensAvailable,
        lastHeartbeat: agent.lastHeartbeat.toISOString(),
        currentStatusSince: agent.currentStatusSince.toISOString(),
        timeInCurrentStatus,
        metadata: agent.metadata,
        config: agent.config,
        health: agent.health,
      };
    });

    // Enrich activities with enhanced data
    const enrichedActivities = activities.map(a => ({
      id: a.id,
      agentId: a.agentId,
      type: a.activityType,
      message: a.description,
      description: a.description,
      timestamp: a.timestamp.toISOString(),
      tokens: a.totalTokens || (a.inputTokens + a.outputTokens),
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      cacheHits: a.cacheHits,
      duration: a.duration,
      cost: a.costTotal,
      apiEndpoint: a.apiEndpoint,
      apiMethod: a.apiMethod,
      apiStatusCode: a.apiStatusCode,
      toolName: a.toolName,
      ticketId: a.ticketId,
    }));

    // Calculate summary stats using ACTUAL token aggregation
    const totalTokens = tokenStats.totalTokens; // Use aggregated value, not just recent 100
    const totalCost = tokenStats.totalCost;
    const onlineCount = enrichedAgents.filter(a => a.isOnline).length;
    
    // Calculate status breakdown
    const statusBreakdown = enrichedAgents.reduce((acc, a) => {
      const effectiveStatus = !a.isOnline ? 'OFFLINE' : a.status;
      acc[effectiveStatus] = (acc[effectiveStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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

    // Activity stats
    const activityStats = {
      total: enrichedActivities.length,
      byType: enrichedActivities.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentTokens: tokenStats.todayTotal, // Today's tokens
      recentCost: tokenStats.todayCost,
    };

    // Calculate system health
    const healthScore = systemHealth.healthScore;
    const systemHealthStatus = healthScore > 80 ? 'Healthy' : healthScore > 50 ? 'Degraded' : 'Critical';

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
        totalCost,
        todayTokens: tokenStats.todayTotal,
        todayCost: tokenStats.todayCost,
        tickets: ticketStats,
        activities: activityStats,
        systemHealth: systemHealthStatus,
        healthScore,
        statusBreakdown,
      },
      tokenStats, // Include full token stats
      systemHealth, // Include system health metrics
    });
  } catch (error) {
    console.error('Error fetching dashboard snapshot:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard snapshot' }, { status: 500 });
  }
}

// Wrap with activity logging
export const GET = withActivityLogging(getDashboardSnapshot, { 
  activityType: 'api_call',
  agentId: 'system'
});