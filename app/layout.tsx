import Link from 'next/link'
import './globals.css'

export const metadata = {
  title: 'Mission Control Nexus',
  description: 'Real-time dashboard and kanban control platform for agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <nav className="sticky top-0 z-40 border-b border-slate-800 bg-[#070b14]/90 backdrop-blur px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between">
            <span className="font-semibold text-slate-100">Mission Control Nexus</span>
            <div className="flex items-center gap-4 text-sm">
              <Link className="text-slate-300 hover:text-white transition-colors" href="/">Dashboard</Link>
              <Link className="text-slate-300 hover:text-white transition-colors" href="/tickets">Tickets</Link>
              <Link className="text-slate-300 hover:text-white transition-colors" href="/knowledge">Knowledge</Link>
              <Link className="text-slate-300 hover:text-white transition-colors" href="/docs">Docs</Link>
              <Link className="text-slate-300 hover:text-white transition-colors" href="/config">Config</Link>
            </div>
          </div>
        </nav>
        <div className="mx-auto max-w-[1500px]">{children}</div>
      </body>
    </html>
  )
}
