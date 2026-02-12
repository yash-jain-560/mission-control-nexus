import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/activities/[id] - Get detailed activity information
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Get agent details
    const agent = await prisma.agent.findUnique({
      where: { id: activity.agentId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
      },
    });

    // Calculate token efficiency metrics
    const totalTokens = activity.inputTokens + activity.outputTokens;
    const cacheHitRate = totalTokens > 0 ? (activity.cacheHits / totalTokens) * 100 : 0;
    const tokensPerSecond = activity.duration > 0 ? (totalTokens / activity.duration) * 1000 : 0;

    // Format response with full payload details
    const response = {
      id: activity.id,
      agentId: activity.agentId,
      agent: agent || undefined,
      activityType: activity.activityType,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      duration: activity.duration,

      // Content Parts (full payload)
      contentParts: activity.contentParts || {
        input: activity.inputPrompt ? [{ type: 'text', content: activity.inputPrompt }] : [],
        output: activity.output ? [{ type: 'text', content: activity.output }] : [],
      },

      // Token tracking
      tokens: {
        input: activity.inputTokens,
        output: activity.outputTokens,
        total: totalTokens,
        cacheHits: activity.cacheHits,
        efficiency: {
          cacheHitRate: Math.round(cacheHitRate * 100) / 100,
          tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
        },
      },

      // Tool usage
      tool: activity.toolName ? {
        name: activity.toolName,
        input: activity.toolInput,
        output: activity.toolOutput,
      } : undefined,

      // Full request/response details
      request: {
        inputPrompt: activity.inputPrompt,
        metadata: activity.metadata,
      },
      response: {
        output: activity.output,
      },

      // Ticket relation
      ticket: activity.ticket,
      ticketId: activity.ticketId,

      // Raw metadata
      metadata: activity.metadata,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
