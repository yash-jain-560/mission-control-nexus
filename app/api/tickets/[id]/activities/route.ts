import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { getTicketTokenStats } from '@/lib/token-aggregator';
import { calculateCost } from '@/lib/cost-calculator';

export const dynamic = 'force-dynamic';

// GET /api/tickets/[id]/activities - Get all activities for a specific ticket
async function getTicketActivities(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const detailed = searchParams.get('detailed') === 'true';
    const includeStats = searchParams.get('includeStats') !== 'false'; // Default true

    const skip = (page - 1) * limit;

    // First, verify the ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get activities for this ticket
    const where = { ticketId: id };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          agentId: true,
          activityType: true,
          description: true,
          inputPrompt: detailed,
          output: detailed,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          cacheHits: true,
          duration: true,
          timestamp: true,
          toolName: true,
          modelName: true,
          costInput: true,
          costOutput: true,
          costTotal: true,
          apiEndpoint: true,
          apiMethod: true,
          apiStatusCode: true,
          metadata: detailed,
        },
      }),
      prisma.activity.count({ where }),
    ]);

    // Get agent details for each activity
    const agentIds = [...new Set(activities.map(a => a.agentId).filter(Boolean))];
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    const agentMap = new Map(agents.map(a => [a.id, a]));

    // Format activities
    const formattedActivities = activities.map(activity => {
      const agent = agentMap.get(activity.agentId || '');
      const inputTokens = activity.inputTokens || 0;
      const outputTokens = activity.outputTokens || 0;
      const totalTokens = activity.totalTokens || (inputTokens + outputTokens);

      return {
        id: activity.id,
        agentId: activity.agentId,
        agentName: agent?.name || activity.agentId,
        agentType: agent?.type,
        type: activity.activityType,
        activityType: activity.activityType,
        description: activity.description,
        timestamp: activity.timestamp.toISOString(),
        tokens: totalTokens,
        inputTokens,
        outputTokens,
        totalTokens,
        cacheHits: activity.cacheHits || 0,
        duration: activity.duration || 0,
        toolName: activity.toolName,
        modelName: activity.modelName,
        costTotal: activity.costTotal || 0,
        costInput: activity.costInput || 0,
        costOutput: activity.costOutput || 0,
        apiEndpoint: activity.apiEndpoint,
        apiMethod: activity.apiMethod,
        apiStatusCode: activity.apiStatusCode,
        ...(detailed && {
          inputPrompt: activity.inputPrompt,
          output: activity.output,
          metadata: activity.metadata,
        }),
      };
    });

    // Calculate aggregate stats
    const tokenStats = includeStats ? await getTicketTokenStats(id) : null;

    // Get activity type breakdown
    const activityTypes = activities.reduce((acc, activity) => {
      const type = activity.activityType || 'unknown';
      if (!acc[type]) {
        acc[type] = { count: 0, tokens: 0 };
      }
      acc[type].count++;
      acc[type].tokens += (activity.totalTokens || activity.inputTokens + activity.outputTokens);
      return acc;
    }, {} as Record<string, { count: number; tokens: number }>);

    // Get agent breakdown
    const agentStats = activities.reduce((acc, activity) => {
      const agentId = activity.agentId || 'unknown';
      if (!acc[agentId]) {
        acc[agentId] = { 
          count: 0, 
          tokens: 0,
          name: agentMap.get(agentId)?.name || agentId,
        };
      }
      acc[agentId].count++;
      acc[agentId].tokens += (activity.totalTokens || activity.inputTokens + activity.outputTokens);
      return acc;
    }, {} as Record<string, { count: number; tokens: number; name: string }>);

    const response: any = {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
      },
      activities: formattedActivities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalActivities: total,
        activityTypes,
        agentStats,
      },
    };

    if (tokenStats) {
      response.tokenStats = tokenStats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching ticket activities:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket activities' }, { status: 500 });
  }
}

// POST /api/tickets/[id]/activities - Create an activity linked to this ticket
async function createTicketActivity(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Create the activity
    const inputTokens = body.inputTokens || 0;
    const outputTokens = body.outputTokens || 0;
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost if model provided
    let costInput: number | undefined;
    let costOutput: number | undefined;
    let costTotal: number | undefined;

    if (body.modelName && (inputTokens > 0 || outputTokens > 0)) {
      const cost = calculateCost(inputTokens, outputTokens, body.modelName);
      costInput = cost.inputCost;
      costOutput = cost.outputCost;
      costTotal = cost.totalCost;
    }

    const activity = await prisma.activity.create({
      data: {
        agentId: body.agentId,
        activityType: body.activityType || 'ticket_activity',
        description: body.description,
        inputPrompt: body.inputPrompt,
        output: body.output,
        toolName: body.toolName,
        toolInput: body.toolInput,
        toolOutput: body.toolOutput,
        inputTokens,
        outputTokens,
        totalTokens,
        cacheHits: body.cacheHits || 0,
        duration: body.duration || 0,
        ticketId: id,
        parentActivityId: body.parentActivityId,
        traceId: body.traceId,
        sessionId: body.sessionId,
        requestId: body.requestId,
        apiEndpoint: body.apiEndpoint,
        apiMethod: body.apiMethod,
        apiStatusCode: body.apiStatusCode,
        modelName: body.modelName,
        costInput,
        costOutput,
        costTotal,
        metadata: body.metadata || {},
      },
    });

    // Update ticket token totals
    await prisma.ticket.update({
      where: { id },
      data: {
        totalInputTokens: { increment: inputTokens },
        totalOutputTokens: { increment: outputTokens },
      },
    });

    return NextResponse.json({
      id: activity.id,
      agentId: activity.agentId,
      type: activity.activityType,
      description: activity.description,
      timestamp: activity.timestamp.toISOString(),
      tokens: totalTokens,
      inputTokens,
      outputTokens,
      costTotal,
      ticketId: id,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}

// Wrap handlers with activity logging
export const GET = withActivityLogging(getTicketActivities, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const POST = withActivityLogging(createTicketActivity, { 
  activityType: 'api_call',
  agentId: 'system'
});