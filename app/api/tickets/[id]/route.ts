import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Valid ticket statuses in Kanban workflow
const VALID_STATUSES = ['Backlog', 'Assigned', 'InProgress', 'Review', 'Done'];

// Auto-transition logic - determine next valid states from current state
function getValidNextStates(currentStatus: string): string[] {
  return VALID_STATUSES.filter((status) => status !== currentStatus);
}

// PUT /api/tickets/:id - Update ticket status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;
    const body = await request.json();
    
    const { status, priority, assigneeId, dueDate, tags } = body;
    
    // Fetch current ticket
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    
    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    // Validate status transition if status is being changed
    if (status && status !== currentTicket.status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      
      const validNextStates = getValidNextStates(currentTicket.status);
      if (!validNextStates.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${currentTicket.status} to ${status}. Valid transitions: ${validNextStates.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }
    
    // Auto-transition logic: when status reaches certain points
    let finalStatus = status || currentTicket.status;
    
    // If transitioning to 'Assigned', ensure assignee is set
    if (finalStatus === 'Assigned' && !assigneeId && !currentTicket.assigneeId) {
      return NextResponse.json(
        { error: 'Cannot assign ticket without an assigneeId' },
        { status: 400 }
      );
    }
    
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assigneeId && { assigneeId }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(tags && { tags }),
      },
    });
    
    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// GET /api/tickets/:id - Get single ticket
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;
    
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// DELETE /api/tickets/:id - Delete ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticketId = params.id;

    await prisma.ticket.delete({ where: { id: ticketId } });

    return NextResponse.json({ success: true, id: ticketId });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
