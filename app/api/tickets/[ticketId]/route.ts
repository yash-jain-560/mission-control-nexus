import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_STATUSES = ['backlog', 'assigned', 'in_progress', 'review', 'done'];
const STATE_TRANSITIONS: { [key: string]: string[] } = {
  backlog: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'backlog'],
  in_progress: ['review', 'assigned'],
  review: ['done', 'in_progress'],
  done: []
};

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: {
        agent: true,
        activities: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('GET /api/tickets/:ticketId error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const body = await request.json();
    const { status, agentId, title, description, priority } = body;

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId }
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Validate status transition
    if (status && status !== ticket.status) {
      const allowedTransitions = STATE_TRANSITIONS[ticket.status] || [];
      if (!VALID_STATUSES.includes(status) || !allowedTransitions.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from ${ticket.status} to ${status}`,
            allowedTransitions
          },
          { status: 400 }
        );
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: status || ticket.status,
        agentId: agentId !== undefined ? agentId : ticket.agentId,
        title: title || ticket.title,
        description: description !== undefined ? description : ticket.description,
        priority: priority || ticket.priority
      },
      include: {
        agent: true
      }
    });

    // Log status change
    if (status && status !== ticket.status) {
      await prisma.activity.create({
        data: {
          type: 'status_changed',
          message: `Ticket status changed: ${ticket.status} → ${status}`,
          ticketId: params.ticketId,
          agentId: updatedTicket.agentId || undefined
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedTicket
    });
  } catch (error) {
    console.error('PATCH /api/tickets/:ticketId error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId }
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Delete related activities first
    await prisma.activity.deleteMany({
      where: { ticketId: params.ticketId }
    });

    // Delete ticket
    await prisma.ticket.delete({
      where: { id: params.ticketId }
    });

    return NextResponse.json({
      success: true,
      message: 'Ticket deleted'
    });
  } catch (error) {
    console.error('DELETE /api/tickets/:ticketId error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete ticket' },
      { status: 500 }
    );
  }
}
