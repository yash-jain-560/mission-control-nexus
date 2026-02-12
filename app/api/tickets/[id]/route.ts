import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/tickets/[id] - Get detailed ticket information
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        history: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
        comments: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get related activities
    const activities = await prisma.activity.findMany({
      where: { ticketId: id },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        agentId: true,
        activityType: true,
        description: true,
        inputTokens: true,
        outputTokens: true,
        cacheHits: true,
        timestamp: true,
        duration: true,
        metadata: true,
      },
    });

    // Get assignee info
    let assignee = null;
    if (ticket.assigneeId) {
      assignee = await prisma.agent.findUnique({
        where: { id: ticket.assigneeId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
        },
      });
    }

    // Calculate token usage from activities
    const tokenUsage = {
      totalInput: activities.reduce((acc, a) => acc + a.inputTokens, 0),
      totalOutput: activities.reduce((acc, a) => acc + a.outputTokens, 0),
      total: 0,
      byActivity: activities.map(a => ({
        id: a.id,
        agentId: a.agentId,
        activityType: a.activityType,
        description: a.description,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        totalTokens: a.inputTokens + a.outputTokens,
        timestamp: a.timestamp.toISOString(),
      })),
    };
    tokenUsage.total = tokenUsage.totalInput + tokenUsage.totalOutput;

    // Build status change timeline
    const statusTimeline = ticket.history
      .filter((h: any) => h.changeType === 'STATUS_CHANGE')
      .map((h: any) => ({
        id: h.id,
        timestamp: h.timestamp.toISOString(),
        fromStatus: h.fromValue?.status,
        toStatus: h.toValue?.status,
        changedBy: h.changedBy,
      }));

    // Build assignment history
    const assignmentHistory = ticket.history
      .filter((h: any) => h.changeType === 'ASSIGNMENT_CHANGE')
      .map((h: any) => ({
        id: h.id,
        timestamp: h.timestamp.toISOString(),
        fromAssignee: h.fromValue?.assigneeId,
        toAssignee: h.toValue?.assigneeId,
        changedBy: h.changedBy,
      }));

    const response = {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      assignee,
      reporterId: ticket.reporterId,
      totalInputTokens: ticket.totalInputTokens,
      totalOutputTokens: ticket.totalOutputTokens,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      dueDate: ticket.dueDate?.toISOString(),
      tags: ticket.tags,
      metadata: ticket.metadata,
      history: ticket.history.map((h: any) => ({
        id: h.id,
        changeType: h.changeType,
        fromValue: h.fromValue,
        toValue: h.toValue,
        changedBy: h.changedBy,
        timestamp: h.timestamp.toISOString(),
      })),
      comments: ticket.comments.map((c: any) => ({
        id: c.id,
        authorId: c.authorId,
        content: c.content,
        timestamp: c.timestamp.toISOString(),
      })),
      activities: activities.map(a => ({
        id: a.id,
        agentId: a.agentId,
        activityType: a.activityType,
        description: a.description,
        timestamp: a.timestamp.toISOString(),
      })),
      tokenUsage,
      statusTimeline,
      assignmentHistory,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// PUT /api/tickets/[id] - Update ticket
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const updates: any = {};
    const historyEntries: any[] = [];

    // Track status change
    if (body.status && body.status !== ticket.status) {
      updates.status = body.status;
      historyEntries.push({
        ticketId: id,
        changeType: 'STATUS_CHANGE',
        fromValue: { status: ticket.status },
        toValue: { status: body.status },
        changedBy: body.changedBy || 'system',
      });
    }

    // Track assignment change
    if (body.assigneeId !== undefined && body.assigneeId !== ticket.assigneeId) {
      updates.assigneeId = body.assigneeId;
      historyEntries.push({
        ticketId: id,
        changeType: 'ASSIGNMENT_CHANGE',
        fromValue: { assigneeId: ticket.assigneeId },
        toValue: { assigneeId: body.assigneeId },
        changedBy: body.changedBy || 'system',
      });
    }

    // Track priority change
    if (body.priority && body.priority !== ticket.priority) {
      updates.priority = body.priority;
      historyEntries.push({
        ticketId: id,
        changeType: 'PRIORITY_CHANGE',
        fromValue: { priority: ticket.priority },
        toValue: { priority: body.priority },
        changedBy: body.changedBy || 'system',
      });
    }

    // Simple updates without history tracking
    if (body.title) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.dueDate) updates.dueDate = new Date(body.dueDate);
    if (body.tags) updates.tags = body.tags;
    if (body.metadata) {
      const currentMetadata = (ticket.metadata as Record<string, any>) || {};
      updates.metadata = { ...currentMetadata, ...body.metadata };
    }

    // Create history entries
    if (historyEntries.length > 0) {
      await prisma.ticketHistory.createMany({
        data: historyEntries,
      });
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// DELETE /api/tickets/[id] - Delete ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.ticket.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
