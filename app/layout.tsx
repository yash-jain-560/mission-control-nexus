import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mission Control Nexus API',
  description: 'Agent monitoring and ticket management API',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
