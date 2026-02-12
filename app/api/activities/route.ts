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
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (activityType) where.activityType = activityType;
    if (ticketId) where.ticketId = ticketId;
    
    let activities: any[];
    const total = await prisma.activity.count({ where });

    if (detailed) {
      activities = await prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
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
    } else {
      activities = await prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      });
    }
    
    const enrichedActivities = activities.map((a: any) => ({
      id: a.id,
      agentId: a.agentId,
      type: a.activityType,
      description: a.description,
      timestamp: a.timestamp.toISOString?.() || a.timestamp,
      tokens: a.inputTokens + a.outputTokens,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      duration: a.duration,
      toolName: a.toolName,
      ...(detailed && {
        inputPrompt: a.inputPrompt,
        output: a.output,
        toolInput: a.toolInput,
        toolOutput: a.toolOutput,
        ticket: a.ticket,
      }),
    }));
    
    return NextResponse.json({
      activities: enrichedActivities,
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
    
    const activity = await prisma.activity.create({
      data: {
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
        duration: (body.duration as number) || 0,
        ticketId: body.ticketId as string | undefined,
        metadata: body.metadata as any,
      },
    });
    
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
