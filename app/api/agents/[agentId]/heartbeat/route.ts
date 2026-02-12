import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/agents/:agentId/heartbeat - Agent status update
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const body = (await request.json()) as Record<string, unknown>;
    
    const status = ((body.status as string) || 'active').toLowerCase();
    const tokensUsed = (body.tokensUsed as number) || 0;
    const tokensAvailable = (body.tokensAvailable as number) || 1000000;
    const metadata = body.metadata as Record<string, unknown> || {};
    
    // Update agent
    const agent = await prisma.agent.upsert({
      where: { id: agentId },
      update: {
        status,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        lastActive: new Date(),
        metadata,
      },
      create: {
        id: agentId,
        name: (body.name as string) || agentId,
        type: (body.type as string) || 'main',
        status,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        lastHeartbeat: new Date(),
        lastActive: new Date(),
        metadata,
      },
    });
    
    // Record heartbeat in history
    await prisma.heartbeat.create({
      data: {
        agentId,
        timestamp: new Date(),
        status,
        tokensUsed: Math.floor(tokensUsed),
        tokensAvailable: Math.floor(tokensAvailable),
        metadata,
      },
    });
    
    // Record status change in history
    await prisma.agentHistory.create({
      data: {
        agentId,
        changeType: 'HEARTBEAT',
        toValue: { status, tokensUsed, timestamp: new Date() },
        metadata,
      },
    });
    
    return NextResponse.json({
      message: 'Heartbeat received',
      agent,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return NextResponse.json({ error: 'Failed to process heartbeat' }, { status: 500 });
  }
}
