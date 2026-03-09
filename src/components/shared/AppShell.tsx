'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import { ClientProvider } from '@/contexts/ClientContext'
import { ToastProvider } from '@/contexts/ToastContext'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ClientProvider>
      <ToastProvider>
        <div className="flex h-screen bg-slate-50 overflow-hidden">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>

          {/* Main */}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile top bar */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            {children}
          </div>
        </div>
      </ToastProvider>
    </ClientProvider>
  )
}
