'use client'

import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { priorityTone } from '@/lib/utils'

const statuses = ['Backlog', 'Assigned', 'InProgress', 'Review', 'Done'] as const

type Status = (typeof statuses)[number]
type Ticket = { id: string; title: string; description?: string; status: Status; priority: string; assigneeId?: string | null }
type Agent = { id: string; agentId: string; name: string }

const ticketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId: z.string().optional(),
})

type TicketForm = z.infer<typeof ticketSchema>

function TicketCard({ ticket, onEdit, onDelete }: { ticket: Ticket; onEdit: (t: Ticket) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ticket.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 cursor-grab active:cursor-grabbing transition hover:border-blue-500/50">
      <div className="flex justify-between gap-2">
        <h4 className="text-sm font-medium">{ticket.title}</h4>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityTone(ticket.priority)}`}>{ticket.priority}</span>
      </div>
      {ticket.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ticket.description}</p>}
      <div className="mt-3 flex gap-2">
        <button className="text-xs text-blue-300 hover:text-blue-200" onClick={() => onEdit(ticket)}>Edit</button>
        <button className="text-xs text-red-300 hover:text-red-200" onClick={() => onDelete(ticket.id)}>Delete</button>
      </div>
    </div>
  )
}

export function Kanban() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { priority: 'MEDIUM' },
  })

  const load = async () => {
    const [tRes, aRes] = await Promise.all([fetch('/api/tickets'), fetch('/api/agents')])
    const [tJson, aJson] = await Promise.all([tRes.json(), aRes.json()])
    setTickets(tJson.tickets || [])
    setAgents(aJson.agents || [])
  }

  useEffect(() => {
    load().catch(() => undefined)
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

  const grouped = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s, tickets.filter((t) => t.status === s)])) as Record<Status, Ticket[]>,
    [tickets],
  )

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return
    const ticketId = String(e.active.id)
    const targetStatus = String(e.over.id) as Status
    const current = tickets.find((t) => t.id === ticketId)
    if (!current || current.status === targetStatus) return

    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: targetStatus } : t)))
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    })
  }

  const onSubmit = async (data: TicketForm) => {
    const method = editing ? 'PUT' : 'POST'
    const url = editing ? `/api/tickets/${editing.id}` : '/api/tickets'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    setOpen(false)
    setEditing(null)
    reset({ title: '', description: '', priority: 'MEDIUM', assigneeId: '' })
    await load()
  }

  const onDelete = async (id: string) => {
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
    setTickets((prev) => prev.filter((t) => t.id !== id))
  }

  const onEdit = (t: Ticket) => {
    setEditing(t)
    reset({ title: t.title, description: t.description, priority: (['LOW', 'MEDIUM', 'HIGH'].includes(t.priority) ? t.priority : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH', assigneeId: t.assigneeId || '' })
    setOpen(true)
  }

  return (
    <main className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tickets Kanban Board</h1>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500" onClick={() => { setEditing(null); reset({ title: '', description: '', priority: 'MEDIUM', assigneeId: '' }); setOpen(true) }}>
          + Create Ticket
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-3 lg:grid-cols-5">
          {statuses.map((status) => (
            <div key={status} className="card p-3 min-h-[500px]">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{status.replace('InProgress', 'In Progress')}</h3>
                <span className="text-xs text-slate-400">{grouped[status].length}</span>
              </div>
              <SortableContext items={grouped[status].map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div id={status} className="space-y-2 min-h-[430px]">
                  {grouped[status].map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="mx-auto mt-16 max-w-lg card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Ticket' : 'Create Ticket'}</h3>
            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <input {...register('title')} placeholder="Title" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
                {errors.title && <p className="text-xs text-red-300 mt-1">Title is required</p>}
              </div>
              <textarea {...register('description')} placeholder="Description" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" rows={4} />
              <select {...register('priority')} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <select {...register('assigneeId')} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {agents.map((a) => (<option key={a.id} value={a.agentId}>{a.name}</option>))}
              </select>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="rounded-md border border-slate-700 px-3 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500">{editing ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
