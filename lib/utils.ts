import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(dateInput: string | Date) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const diffMs = Date.now() - date.getTime()
  const sec = Math.max(1, Math.floor(diffMs / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (['online', 'active', 'busy', 'working', 'inprogress'].includes(normalized)) return 'text-success'
  if (['idle', 'assigned', 'review'].includes(normalized)) return 'text-warning'
  return 'text-danger'
}

export function priorityTone(priority: string) {
  const p = priority.toLowerCase()
  if (p === 'high' || p === 'critical' || p === 'urgent') return 'bg-red-500/20 text-red-300 border-red-500/35'
  if (p === 'medium') return 'bg-amber-500/20 text-amber-300 border-amber-500/35'
  return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
}
