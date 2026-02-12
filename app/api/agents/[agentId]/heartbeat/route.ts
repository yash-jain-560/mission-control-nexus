import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/agents/:agentId/heartbeat - Agent status update
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const body = await request.json();
    
    const { status, health, metadata } = body;
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }
    
    // Find or create agent
    let agent = await prisma.agent.findUnique({
      where: { agentId },
    });
    
    if (!agent) {
      // Create new agent if not exists
      agent = await prisma.agent.create({
        data: {
          agentId,
          name: body.name || agentId,
          type: body.type || 'worker',
          status,
          health: health || { status: 'unknown', lastCheck: new Date(), metrics: {} },
          lastHeartbeat: new Date(),
          lastActive: new Date(),
          metadata: metadata || {},
        },
      });
    } else {
      // Update existing agent
      agent = await prisma.agent.update({
        where: { agentId },
        data: {
          status,
          ...(health && { health }),
          lastHeartbeat: new Date(),
          lastActive: new Date(),
          ...(metadata && { metadata }),
        },
      });
    }
    
    // Record heartbeat in history
    await prisma.heartbeat.create({
      data: {
        agentId,
        timestamp: new Date(),
        status,
        health: health || {},
        metadata: metadata || {},
      },
    });
    
    // Record status change in history if status changed
    if (agent) {
      await prisma.agentHistory.create({
        data: {
          agentId,
          changeType: 'HEARTBEAT',
          toValue: { status, health, timestamp: new Date() },
          metadata: metadata || {},
        },
      });
    }
    
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
