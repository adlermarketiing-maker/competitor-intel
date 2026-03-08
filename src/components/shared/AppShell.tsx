'use client'

import Sidebar from './Sidebar'
import { ClientProvider } from '@/contexts/ClientContext'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ClientProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </ClientProvider>
  )
}
