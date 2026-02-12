import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/agents/:agentId/status - Get agent details and current status
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    
    const agent = await prisma.agent.findUnique({
      where: { agentId },
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        history: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });
    
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    
    // Determine health status based on heartbeat recency
    const lastHeartbeatTime = agent.lastHeartbeat;
    const timeSinceHeartbeat = Date.now() - lastHeartbeatTime.getTime();
    const thirtySecondsMs = 30000;
    
    const healthStatus = timeSinceHeartbeat > thirtySecondsMs ? 'offline' : agent.status.toLowerCase();
    
    return NextResponse.json({
      agent: {
        id: agent.id,
        agentId: agent.agentId,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        health: agent.health,
        lastHeartbeat: agent.lastHeartbeat,
        lastActive: agent.lastActive,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
      healthStatus,
      recentHeartbeats: agent.heartbeats,
      recentHistory: agent.history,
      isOnline: healthStatus === 'online',
      lastHeartbeatAgo: `${Math.floor(timeSinceHeartbeat / 1000)}s`,
    });
  } catch (error) {
    console.error('Error fetching agent status:', error);
    return NextResponse.json({ error: 'Failed to fetch agent status' }, { status: 500 });
  }
}
