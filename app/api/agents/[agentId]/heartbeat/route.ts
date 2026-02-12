import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/agents/:agentId/heartbeat - Agent heartbeat update
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const body = (await request.json()) as Record<string, unknown>;

    const status = (body.status as string)?.toUpperCase() || 'IDLE';
    const tokensUsed = (body.tokensUsed as number) || 0;
    const tokensAvailable = (body.tokensAvailable as number) || 1000000;
    const metadata = (body.metadata as any) || {};

    // Validate status
    const validStatuses = ['IDLE', 'WORKING', 'THINKING', 'OFFLINE'];
    const finalStatus = validStatuses.includes(status) ? status : 'IDLE';

    // Get current agent to check for status change
    const existingAgent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true, currentStatusSince: true, statusHistory: true },
    });

    let statusHistory = existingAgent?.statusHistory as any[] || [];
    let currentStatusSince = existingAgent?.currentStatusSince || new Date();

    // If status changed, record the transition
    if (existingAgent && existingAgent.status !== finalStatus) {
      const now = new Date();
      const durationMs = now.getTime() - new Date(existingAgent.currentStatusSince).getTime();

      statusHistory = [
        ...statusHistory,
        {
          status: existingAgent.status,
          timestamp: existingAgent.currentStatusSince.toISOString(),
          durationMs,
          reason: 'Status transition via heartbeat',
        },
      ].slice(-50); // Keep last 50 transitions

      currentStatusSince = now;

      // Record in agent history table
      await prisma.agentHistory.create({
        data: {
          agentId,
          changeType: 'STATUS_CHANGE',
          fromValue: { status: existingAgent.status },
          toValue: { status: finalStatus },
          metadata: { source: 'heartbeat' },
        },
      });
    }

    // Update agent
    const agent = await prisma.agent.upsert({
      where: { id: agentId },
      update: {
        status: finalStatus,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        lastActive: new Date(),
        statusHistory,
        currentStatusSince,
      } as any,
      create: {
        id: agentId,
        name: (body.name as string) || agentId,
        type: (body.type as string) || 'main',
        status: finalStatus,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        lastActive: new Date(),
        statusHistory: [],
        currentStatusSince: new Date(),
      } as any,
    });

    // Record heartbeat in history
    await prisma.heartbeat.create({
      data: {
        agentId,
        timestamp: new Date(),
        status: finalStatus,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        metadata,
      },
    });

    return NextResponse.json({
      message: 'Heartbeat received',
      agent: {
        id: agent.id,
        status: agent.status,
        tokensUsed: agent.tokensUsed,
        tokensAvailable: agent.tokensAvailable,
        lastHeartbeat: agent.lastHeartbeat.toISOString(),
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return NextResponse.json({ error: 'Failed to process heartbeat' }, { status: 500 });
  }
}
