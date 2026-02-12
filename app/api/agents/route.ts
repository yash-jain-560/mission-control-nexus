import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
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
            take: 1,
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);
    
    // Enrich agents with online status
    const enrichedAgents = agents.map(agent => {
      const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      const thirtySecondsMs = 30000;
      const isOnline = timeSinceHeartbeat <= thirtySecondsMs;
      
      return {
        ...agent,
        isOnline,
        lastHeartbeatAgo: `${Math.floor(timeSinceHeartbeat / 1000)}s`,
      };
    });
    
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
        online: enrichedAgents.filter(a => a.isOnline).length,
        offline: enrichedAgents.filter(a => !a.isOnline).length,
      },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
