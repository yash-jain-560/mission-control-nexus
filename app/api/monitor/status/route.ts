import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/monitor/status - Overall system health
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Fetch all data in parallel
    const [agents, tickets, heartbeatCount, recentErrors] = await Promise.all([
      prisma.agent.findMany({
        select: { id: true, status: true, lastHeartbeat: true },
      }),
      prisma.ticket.findMany({
        select: { id: true, status: true },
      }),
      prisma.heartbeat.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          },
        },
      }),
      prisma.agentHistory.findMany({
        where: {
          changeType: 'ERROR',
          timestamp: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
      }),
    ]);
    
    const queryTime = Date.now() - startTime;
    
    // Calculate online/offline agents
    const thirtySecondsMs = 30000;
    const onlineAgents = agents.filter(
      a => Date.now() - a.lastHeartbeat.getTime() <= thirtySecondsMs
    ).length;
    const offlineAgents = agents.length - onlineAgents;
    
    // Count tickets by status
    const ticketsByStatus = {
      Backlog: tickets.filter(t => t.status === 'Backlog').length,
      Assigned: tickets.filter(t => t.status === 'Assigned').length,
      InProgress: tickets.filter(t => t.status === 'InProgress').length,
      Review: tickets.filter(t => t.status === 'Review').length,
      Done: tickets.filter(t => t.status === 'Done').length,
    };
    
    // Determine overall system health
    let overallHealth = 'healthy';
    if (offlineAgents > agents.length * 0.5) {
      overallHealth = 'degraded';
    }
    if (recentErrors.length > 5 || offlineAgents === agents.length) {
      overallHealth = 'unhealthy';
    }
    
    return NextResponse.json({
      timestamp: new Date(),
      status: overallHealth,
      system: {
        healthy: overallHealth === 'healthy',
        degraded: overallHealth === 'degraded',
        unhealthy: overallHealth === 'unhealthy',
      },
      agents: {
        total: agents.length,
        online: onlineAgents,
        offline: offlineAgents,
        onlinePercentage: agents.length > 0 ? Math.round((onlineAgents / agents.length) * 100) : 0,
      },
      tickets: {
        total: tickets.length,
        byStatus: ticketsByStatus,
        inProgress: ticketsByStatus.InProgress + ticketsByStatus.Assigned,
        completed: ticketsByStatus.Done,
      },
      metrics: {
        heartbeatsLast5Min: heartbeatCount,
        recentErrors: recentErrors.length,
        apiResponseTime: `${queryTime}ms`,
      },
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    return NextResponse.json(
      {
        timestamp: new Date(),
        status: 'unhealthy',
        error: 'Failed to fetch system status',
      },
      { status: 500 }
    );
  }
}
