import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/activities - List all activities with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const activityType = searchParams.get('type');
    const ticketId = searchParams.get('ticketId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const detailed = searchParams.get('detailed') === 'true';
    const includeContentParts = searchParams.get('includeContentParts') === 'true';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (activityType) where.activityType = activityType;
    if (ticketId) where.ticketId = ticketId;

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
      cacheHits: true,
      duration: true,
      timestamp: true,
      ticketId: true,
    };

    if (detailed) {
      selectFields.inputPrompt = true;
      selectFields.output = true;
      selectFields.toolInput = true;
      selectFields.toolOutput = true;
      selectFields.metadata = true;
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

    // Enrich with ticket info if detailed
    let enrichedActivities = activities;
    if (detailed) {
      const ticketIds = activities.filter((a: any) => a.ticketId).map((a: any) => a.ticketId);
      const tickets = ticketIds.length > 0
        ? await prisma.ticket.findMany({
            where: { id: { in: ticketIds } },
            select: { id: true, title: true, status: true, priority: true },
          })
        : [];

      const ticketMap = new Map(tickets.map((t: any) => [t.id, t]));

      enrichedActivities = activities.map((a: any) => ({
        ...a,
        ticket: a.ticketId ? ticketMap.get(a.ticketId) : undefined,
      }));
    }

    // Format response
    const formattedActivities = enrichedActivities.map((a: any) => ({
      id: a.id,
      agentId: a.agentId,
      type: a.activityType,
      description: a.description,
      timestamp: a.timestamp.toISOString?.() || a.timestamp,
      tokens: a.inputTokens + a.outputTokens,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      cacheHits: a.cacheHits,
      duration: a.duration,
      toolName: a.toolName,
      ...(detailed && {
        inputPrompt: a.inputPrompt,
        output: a.output,
        toolInput: a.toolInput,
        toolOutput: a.toolOutput,
        metadata: a.metadata,
        ticket: a.ticket,
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
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Validate required fields
    if (!body.agentId) {
      return NextResponse.json({ error: 'Missing required field: agentId' }, { status: 400 });
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
      inputTokens: (body.inputTokens as number) || 0,
      outputTokens: (body.outputTokens as number) || 0,
      cacheHits: (body.cacheHits as number) || 0,
      duration: (body.duration as number) || 0,
      ticketId: body.ticketId as string | undefined,
      metadata: body.metadata as any,
    };

    // Handle contentParts - structured input/output content
    if (body.contentParts) {
      activityData.contentParts = body.contentParts;
    }

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
    let reason: string = '';

    // Determine new status based on activity type
    if (activityType === 'reasoning' || activityType === 'agent_turn') {
      newStatus = 'THINKING';
      reason = `Started ${activityType}`;
    } else if (activityType === 'tool_call') {
      newStatus = 'WORKING';
      reason = 'Executing tool';
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
        reason: 'Status transition',
      },
    ].slice(-50); // Keep last 50 transitions

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
