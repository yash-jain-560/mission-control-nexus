import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';

export const dynamic = 'force-dynamic';

// GET /api/activities/[id] - Get detailed activity information
async function getActivity(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const includeChain = searchParams.get('includeChain') === 'true';

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
        parent: includeChain ? {
          select: {
            id: true,
            activityType: true,
            description: true,
            timestamp: true,
          },
        } : false,
        children: includeChain ? {
          select: {
            id: true,
            activityType: true,
            description: true,
            timestamp: true,
            agentId: true,
          },
          orderBy: { timestamp: 'asc' },
        } : false,
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

    // Get related activities by traceId if available
    let traceActivities: any[] = [];
    if (activity.traceId && includeChain) {
      traceActivities = await prisma.activity.findMany({
        where: { 
          traceId: activity.traceId,
          id: { not: id },
        },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          agentId: true,
          activityType: true,
          description: true,
          timestamp: true,
          inputTokens: true,
          outputTokens: true,
          duration: true,
        },
      });
    }

    // Get activities by ticketId if available
    let ticketActivities: any[] = [];
    if (activity.ticketId && includeChain) {
      ticketActivities = await prisma.activity.findMany({
        where: { 
          ticketId: activity.ticketId,
          id: { not: id },
          traceId: activity.traceId ? { not: activity.traceId } : undefined,
        },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          agentId: true,
          activityType: true,
          description: true,
          timestamp: true,
          inputTokens: true,
          outputTokens: true,
          duration: true,
        },
      });
    }

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
        request: activity.inputPrompt ? { prompt: activity.inputPrompt } : undefined,
        response: activity.output ? { output: activity.output } : undefined,
      },

      // Token tracking
      inputTokens: activity.inputTokens,
      outputTokens: activity.outputTokens,
      totalTokens: activity.totalTokens || totalTokens,
      cacheHits: activity.cacheHits,
      
      // Efficiency metrics
      efficiency: {
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
      },

      // Cost tracking
      costInput: activity.costInput,
      costOutput: activity.costOutput,
      costTotal: activity.costTotal,
      modelName: activity.modelName,

      // API details
      apiEndpoint: activity.apiEndpoint,
      apiMethod: activity.apiMethod,
      apiStatusCode: activity.apiStatusCode,

      // Tool usage
      toolName: activity.toolName,
      toolInput: activity.toolInput,
      toolOutput: activity.toolOutput,

      // Full request/response details
      inputPrompt: activity.inputPrompt,
      output: activity.output,

      // Context
      ticketId: activity.ticketId,
      ticket: activity.ticket,
      parentActivityId: activity.parentActivityId,
      parent: activity.parent,
      children: activity.children,
      traceId: activity.traceId,
      sessionId: activity.sessionId,
      requestId: activity.requestId,

      // Related activities
      traceActivities: includeChain ? traceActivities : undefined,
      ticketActivities: includeChain ? ticketActivities : undefined,

      // Raw metadata
      metadata: activity.metadata,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

// PUT /api/activities/[id] - Update activity (e.g., add output to a started activity)
async function updateActivity(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const activity = await prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const updates: any = {};

    // Update fields if provided
    if (body.output !== undefined) updates.output = body.output;
    if (body.outputTokens !== undefined) updates.outputTokens = body.outputTokens;
    if (body.duration !== undefined) updates.duration = body.duration;
    if (body.apiStatusCode !== undefined) updates.apiStatusCode = body.apiStatusCode;
    if (body.toolOutput !== undefined) updates.toolOutput = body.toolOutput;
    if (body.metadata !== undefined) {
      const currentMetadata = (activity.metadata as Record<string, any>) || {};
      updates.metadata = { ...currentMetadata, ...body.metadata };
    }

    // Recalculate total tokens
    if (updates.outputTokens !== undefined) {
      updates.totalTokens = activity.inputTokens + updates.outputTokens;
    }

    // Recalculate cost if model name exists
    if (activity.modelName && (updates.totalTokens || updates.outputTokens !== undefined)) {
      const { calculateCost } = await import('@/lib/cost-calculator');
      const totalTokens = updates.totalTokens || (activity.inputTokens + (updates.outputTokens || activity.outputTokens));
      const outputTokens = updates.outputTokens || activity.outputTokens;
      const cost = calculateCost(activity.inputTokens, outputTokens, activity.modelName);
      updates.costInput = cost.inputCost;
      updates.costOutput = cost.outputCost;
      updates.costTotal = cost.totalCost;
    }

    const updatedActivity = await prisma.activity.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

// DELETE /api/activities/[id] - Delete activity
async function deleteActivity(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.activity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}

// Wrap handlers with activity logging
export const GET = withActivityLogging(getActivity, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const PUT = withActivityLogging(updateActivity, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const DELETE = withActivityLogging(deleteActivity, { 
  activityType: 'api_call',
  agentId: 'system'
});