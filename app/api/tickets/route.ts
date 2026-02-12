import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withActivityLogging } from '@/middleware/activity-logging';
import { logTicketOperation } from '@/lib/activity-logger';

export const dynamic = 'force-dynamic';

// GET /api/tickets - List tickets with filtering and aggregations
async function getTickets(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const summary = searchParams.get('summary') === 'true';
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);
    
    let summaryData = null;
    if (summary) {
      const allTickets = await prisma.ticket.findMany();
      summaryData = {
        byStatus: {
          Backlog: allTickets.filter(t => t.status === 'Backlog').length,
          Assigned: allTickets.filter(t => t.status === 'Assigned').length,
          InProgress: allTickets.filter(t => t.status === 'InProgress').length,
          Review: allTickets.filter(t => t.status === 'Review').length,
          Done: allTickets.filter(t => t.status === 'Done').length,
        },
        byPriority: {
          CRITICAL: allTickets.filter(t => t.priority === 'CRITICAL').length,
          HIGH: allTickets.filter(t => t.priority === 'HIGH').length,
          MEDIUM: allTickets.filter(t => t.priority === 'MEDIUM').length,
          LOW: allTickets.filter(t => t.priority === 'LOW').length,
        },
        total: allTickets.length,
        completed: allTickets.filter(t => t.status === 'Done').length,
      };
    }
    
    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      ...(summary && { summary: summaryData }),
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST /api/tickets - Create a new ticket
async function createTicket(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { title, description, priority = 'MEDIUM', assigneeId, reporterId = 'system', dueDate, tags = [] } = body;
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        priority,
        status: 'Backlog',
        assigneeId,
        reporterId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        tags,
      },
    });
    
    // Log ticket creation
    const agentId = request.headers.get('x-agent-id') || reporterId || 'system';
    await logTicketOperation(agentId, 'create', ticket.id, {
      title,
      description,
      priority,
      assigneeId,
    });
    
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}

// Wrap handlers with activity logging
export const GET = withActivityLogging(getTickets, { 
  activityType: 'api_call',
  agentId: 'system'
});

export const POST = withActivityLogging(createTicket, { 
  activityType: 'create_ticket',
  agentId: 'system'
});