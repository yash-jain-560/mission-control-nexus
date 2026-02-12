'use client'

import { useEffect, useMemo, useState } from 'react'
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor, 
  useSensor, 
  useSensors,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core'
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { priorityTone } from '@/lib/utils'

const statuses = ['Backlog', 'Assigned', 'InProgress', 'Review', 'Done'] as const

type Status = (typeof statuses)[number]
type Ticket = { 
  id: string; 
  title: string; 
  description?: string; 
  status: Status; 
  priority: string; 
  assigneeId?: string | null 
}
type Agent = { id: string; agentId: string; name: string }

const ticketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId: z.string().optional(),
})

type TicketForm = z.infer<typeof ticketSchema>

// Sortable Ticket Card Component
function SortableTicketCard({ 
  ticket, 
  onEdit, 
  onDelete 
}: { 
  ticket: Ticket; 
  onEdit: (t: Ticket) => void; 
  onDelete: (id: string) => void 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: ticket.id,
    data: {
      type: 'Ticket',
      ticket,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 cursor-grab active:cursor-grabbing transition hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
    >
      <div className="flex justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-100">{ticket.title}</h4>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityTone(ticket.priority)}`}>
          {ticket.priority}
        </span>
      </div>
      {ticket.description && (
        <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ticket.description}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button 
          className="text-xs text-blue-300 hover:text-blue-200 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors" 
          onClick={(e) => { e.stopPropagation(); onEdit(ticket); }}
        >
          Edit
        </button>
        <button 
          className="text-xs text-red-300 hover:text-red-200 px-2 py-1 rounded hover:bg-red-500/10 transition-colors" 
          onClick={(e) => { e.stopPropagation(); onDelete(ticket.id); }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// Non-sortable ticket card for drag overlay
function TicketCardOverlay({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-lg border border-blue-500 bg-slate-900 p-3 shadow-xl shadow-blue-500/20 rotate-3 scale-105">
      <div className="flex justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-100">{ticket.title}</h4>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityTone(ticket.priority)}`}>
          {ticket.priority}
        </span>
      </div>
      {ticket.description && (
        <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ticket.description}</p>
      )}
    </div>
  )
}

// Droppable Column Component
function KanbanColumn({ 
  status, 
  tickets, 
  onEdit, 
  onDelete 
}: { 
  status: Status; 
  tickets: Ticket[]; 
  onEdit: (t: Ticket) => void; 
  onDelete: (id: string) => void 
}) {
  const { setNodeRef, isOver } = useSortable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  })

  return (
    <div 
      ref={setNodeRef}
      className={`card p-3 min-h-[500px] transition-colors ${
        isOver ? 'bg-blue-500/10 border-blue-500/50' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">{status.replace('InProgress', 'In Progress')}</h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{tickets.length}</span>
      </div>
      
      <SortableContext 
        items={tickets.map((t) => t.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[430px]">
          {tickets.map((ticket) => (
            <SortableTicketCard 
              key={ticket.id} 
              ticket={ticket} 
              onEdit={onEdit} 
              onDelete={onDelete} 
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export function Kanban() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Minimum drag distance to start
      },
    })
  )

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { priority: 'MEDIUM' },
  })

  const load = async () => {
    try {
      setIsLoading(true)
      const [tRes, aRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/agents')
      ])
      const [tJson, aJson] = await Promise.all([tRes.json(), aRes.json()])
      setTickets(tJson.tickets || [])
      setAgents(aJson.agents || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    const evt = new EventSource('/api/events')
    evt.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.type === 'snapshot') setTickets(payload.tickets || [])
      } catch {
        // noop
      }
    }
    return () => evt.close()
  }, [])

  const grouped = useMemo(() => {
    const result: Record<Status, Ticket[]> = {
      Backlog: [],
      Assigned: [],
      InProgress: [],
      Review: [],
      Done: [],
    }
    
    tickets.forEach((ticket) => {
      if (result[ticket.status]) {
        result[ticket.status].push(ticket)
      } else {
        // If status doesn't match expected values, default to Backlog
        result.Backlog.push(ticket)
      }
    })
    
    return result
  }, [tickets])

  const activeTicket = useMemo(() => 
    tickets.find((t) => t.id === activeId),
    [activeId, tickets]
  )

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const ticketId = active.id as string
    const targetStatus = over.id as Status

    // Check if dropping over a column
    if (statuses.includes(targetStatus)) {
      const ticket = tickets.find((t) => t.id === ticketId)
      if (!ticket || ticket.status === targetStatus) return

      // Optimistically update UI
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: targetStatus } : t
        )
      )

      // Persist to server
      try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        })

        if (!response.ok) {
          // Revert on error
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId ? { ...t, status: ticket.status } : t
            )
          )
          console.error('Failed to update ticket status')
        }
      } catch (error) {
        // Revert on error
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, status: ticket.status } : t
          )
        )
        console.error('Error updating ticket:', error)
      }
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  const onSubmit = async (data: TicketForm) => {
    try {
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `/api/tickets/${editing.id}` : '/api/tickets'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to save ticket')

      setOpen(false)
      setEditing(null)
      reset({ title: '', description: '', priority: 'MEDIUM', assigneeId: '' })
      await load()
    } catch (error) {
      console.error('Error saving ticket:', error)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) return
    
    try {
      const response = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Error deleting ticket:', error)
    }
  }

  const onEdit = (t: Ticket) => {
    setEditing(t)
    reset({ 
      title: t.title, 
      description: t.description || '', 
      priority: (['LOW', 'MEDIUM', 'HIGH'].includes(t.priority) ? t.priority : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH', 
      assigneeId: t.assigneeId || '' 
    })
    setOpen(true)
  }

  return (
    <main className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Tickets Kanban Board</h1>
        <button 
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50" 
          onClick={() => { 
            setEditing(null); 
            reset({ title: '', description: '', priority: 'MEDIUM', assigneeId: '' }); 
            setOpen(true) 
          }}
          disabled={isLoading}
        >
          + Create Ticket
        </button>
      </div>

      <DndContext 
        sensors={sensors} 
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-3 lg:grid-cols-5">
          {statuses.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tickets={grouped[status]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
        
        <DragOverlay dropAnimation={dropAnimation}>
          {activeTicket ? (
            <TicketCardOverlay ticket={activeTicket} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="mx-auto mt-16 max-w-lg card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100 mb-4">{editing ? 'Edit Ticket' : 'Create Ticket'}</h3>
            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <input 
                  {...register('title')} 
                  placeholder="Title" 
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none" 
                />
                {errors.title && <p className="text-xs text-red-300 mt-1">Title is required</p>}
              </div>
              <textarea 
                {...register('description')} 
                placeholder="Description" 
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none" 
                rows={4} 
              />
              <select 
                {...register('priority')} 
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <select 
                {...register('assigneeId')} 
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (<option key={a.id} value={a.agentId}>{a.name}</option>))}
              </select>
              <div className="flex justify-end gap-2 pt-1">
                <button 
                  type="button" 
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors" 
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 transition-colors text-white"
                >
                  {editing ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}