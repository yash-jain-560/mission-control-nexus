import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { calculateCost } from '@/lib/cost-calculator';
import { calculateTokens } from '@/lib/token-counter';

export const dynamic = 'force-dynamic';

// GET /api/activities - List all activities with filtering
async function listActivities(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const activityType = searchParams.get('type');
    const ticketId = searchParams.get('ticketId');
    const traceId = searchParams.get('traceId');
    const sessionId = searchParams.get('sessionId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const detailed = searchParams.get('detailed') === 'true';
    const includeContentParts = searchParams.get('includeContentParts') === 'true';
    const includeChain = searchParams.get('includeChain') === 'true';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (activityType) where.activityType = activityType;
    if (ticketId) where.ticketId = ticketId;
    if (traceId) where.traceId = traceId;
    if (sessionId) where.sessionId = sessionId;

    let activities: any[];
    const total = await prisma.activity.count({ where });

    const selectFields: any = {
      id: true,
      agentId: true,
      activityType: true,
      description: true,
      toolName: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      cacheHits: true,
      duration: true,
      timestamp: true,
      ticketId: true,
      parentActivityId: true,
      traceId: true,
      sessionId: true,
      requestId: true,
      apiEndpoint: true,
      apiMethod: true,
      apiStatusCode: true,
      modelName: true,
      costInput: true,
      costOutput: true,
      costTotal: true,
    };

    if (detailed) {
      selectFields.inputPrompt = true;
      selectFields.output = true;
      selectFields.toolInput = true;
      selectFields.toolOutput = true;
      selectFields.metadata = true;
      selectFields.contentParts = true;
    }

    if (includeContentParts) {
      selectFields.contentParts = true;
    }

    activities = await prisma.activity.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      select: selectFields,
    });

    // Enrich with related data if detailed
    let enrichedActivities = activities;
    if (detailed || includeChain) {
      const ticketIds = activities.filter((a: any) => a.ticketId).map((a: any) => a.ticketId);
      const parentIds = activities.filter((a: any) => a.parentActivityId).map((a: any) => a.parentActivityId);
      
      const [tickets, parents] = await Promise.all([
        ticketIds.length > 0
          ? prisma.ticket.findMany({
              where: { id: { in: ticketIds } },
              select: { id: true, title: true, status: true, priority: true },
            })
          : [],
        parentIds.length > 0 && includeChain
          ? prisma.activity.findMany({
              where: { id: { in: parentIds } },
              select: { id: true, activityType: true, description: true },
            })
          : [],
      ]);

      const ticketMap = new Map(tickets.map((t: any) => [t.id, t]));
      const parentMap = new Map(parents.map((p: any) => [p.id, p]));

      enrichedActivities = activities.map((a: any) => ({
        ...a,
        ticket: a.ticketId ? ticketMap.get(a.ticketId) : undefined,
        parent: a.parentActivityId && includeChain ? parentMap.get(a.parentActivityId) : undefined,
      }));
    }

    // Format response
    const formattedActivities = enrichedActivities.map((a: any) => ({
      id: a.id,
      agentId: a.agentId,
      type: a.activityType,
      activityType: a.activityType,
      description: a.description,
      timestamp: a.timestamp.toISOString?.() || a.timestamp,
      tokens: a.totalTokens || (a.inputTokens + a.outputTokens),
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      totalTokens: a.totalTokens || (a.inputTokens + a.outputTokens),
      cacheHits: a.cacheHits,
      duration: a.duration,
      toolName: a.toolName,
      ticketId: a.ticketId,
      parentActivityId: a.parentActivityId,
      traceId: a.traceId,
      sessionId: a.sessionId,
      requestId: a.requestId,
      apiEndpoint: a.apiEndpoint,
      apiMethod: a.apiMethod,
      apiStatusCode: a.apiStatusCode,
      modelName: a.modelName,
      costTotal: a.costTotal,
      ...(detailed && {
        inputPrompt: a.inputPrompt,
        output: a.output,
        toolInput: a.toolInput,
        toolOutput: a.toolOutput,
        metadata: a.metadata,
        ticket: a.ticket,
        parent: a.parent,
      }),
      ...(includeContentParts && {
        contentParts: a.contentParts,
      }),
    }));

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST /api/activities - Log a new activity
async function createActivity(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Validate required fields
    if (!body.agentId) {
      return NextResponse.json({ error: 'Missing required field: agentId' }, { status: 400 });
    }

    // Calculate total tokens
    const inputTokens = (body.inputTokens as number) || 0;
    const outputTokens = (body.outputTokens as number) || 0;
    const totalTokens = inputTokens + outputTokens;

    // Calculate costs if model name is provided
    let costInput: number | undefined;
    let costOutput: number | undefined;
    let costTotal: number | undefined;
    
    if (body.modelName && (inputTokens > 0 || outputTokens > 0)) {
      const cost = calculateCost(inputTokens, outputTokens, body.modelName as string);
      costInput = cost.inputCost;
      costOutput = cost.outputCost;
      costTotal = cost.totalCost;
    }

    const activityData: any = {
      agentId: body.agentId as string,
      activityType: (body.activityType as string) || 'agent_turn',
      description: body.description as string,
      inputPrompt: body.inputPrompt as string | undefined,
      output: body.output as string | undefined,
      toolName: body.toolName as string | undefined,
      toolInput: body.toolInput as any,
      toolOutput: body.toolOutput as any,
      contentParts: body.contentParts as any,
      inputTokens,
      outputTokens,
      totalTokens,
      cacheHits: (body.cacheHits as number) || 0,
      duration: (body.duration as number) || 0,
      ticketId: body.ticketId as string | undefined,
      parentActivityId: body.parentActivityId as string | undefined,
      traceId: body.traceId as string | undefined,
      sessionId: body.sessionId as string | undefined,
      requestId: body.requestId as string | undefined,
      apiEndpoint: body.apiEndpoint as string | undefined,
      apiMethod: body.apiMethod as string | undefined,
      apiStatusCode: body.apiStatusCode as number | undefined,
      modelName: body.modelName as string | undefined,
      costInput,
      costOutput,
      costTotal,
      metadata: body.metadata as any,
    };

    const activity = await prisma.activity.create({
      data: activityData,
    });

    // Update ticket token totals if ticketId is provided
    if (body.ticketId && (body.inputTokens || body.outputTokens)) {
      await prisma.ticket.update({
        where: { id: body.ticketId as string },
        data: {
          totalInputTokens: { increment: (body.inputTokens as number) || 0 },
          totalOutputTokens: { increment: (body.outputTokens as number) || 0 },
        },
      });
    }

    // Update agent status based on activity type
    await updateAgentStatusFromActivity(body.agentId as string, body.activityType as string);

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

// Helper function to update agent status based on activity type
async function updateAgentStatusFromActivity(agentId: string, activityType: string) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true, statusHistory: true, currentStatusSince: true },
    });

    if (!agent) return;

    let newStatus: string | null = null;

    // Determine new status based on activity type
    if (activityType === 'agent_turn' || activityType === 'reasoning') {
      newStatus = 'THINKING';
    } else if (activityType === 'tool_call') {
      newStatus = 'WORKING';
    } else if (activityType === 'completion' || activityType === 'agent_completed') {
      newStatus = 'IDLE';
    } else if (activityType === 'error' || activityType === 'agent_error') {
      newStatus = 'IDLE';
    }

    if (!newStatus || agent.status === newStatus) return;

    // Calculate duration in previous status
    const now = new Date();
    const statusSince = new Date(agent.currentStatusSince);
    const durationMs = now.getTime() - statusSince.getTime();

    // Build updated status history
    const statusHistory = Array.isArray(agent.statusHistory) ? agent.statusHistory : [];
    const updatedHistory = [
      ...statusHistory,
      {
        status: agent.status,
        timestamp: statusSince.toISOString(),
        durationMs,
        reason: `Activity: ${activityType}`,
      },
    ].slice(-50);

    // Update agent
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: newStatus,
        statusHistory: updatedHistory,
        currentStatusSince: now,
        lastActive: now,
      },
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
}

// Wrap handlers with activity logging
export const GET = withActivityLogging(listActivities, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const POST = withActivityLogging(createActivity, { 
  activityType: 'api_call',
  agentId: 'system'
});