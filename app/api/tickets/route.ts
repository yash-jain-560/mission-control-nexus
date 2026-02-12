import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/tickets - Create a new ticket
export async function POST(request: NextRequest) {
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
    
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}

// GET /api/tickets - List tickets with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
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
    
    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
