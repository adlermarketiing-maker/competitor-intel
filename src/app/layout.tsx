import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/shared/AppShell'

export const metadata: Metadata = {
  title: 'Competitor Intelligence',
  description: 'Analiza a tu competencia: anuncios, landings y funnels',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
