'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Client } from '@/types/client'

interface ClientContextValue {
  clients: Client[]
  selectedClient: Client | null
  selectedClientId: string | null
  selectClient: (id: string) => void
  refreshClients: () => Promise<Client[]>
  loading: boolean
}

const ClientContext = createContext<ClientContextValue>({
  clients: [],
  selectedClient: null,
  selectedClientId: null,
  selectClient: () => {},
  refreshClients: async () => [],
  loading: true,
})

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      if (res.ok) {
        const data = await res.json()
        setClients(data)
        return data as Client[]
      }
    } catch { /* ignore */ }
    return [] as Client[]
  }, [])

  useEffect(() => {
    refreshClients().then((fetched) => {
      // Restore from localStorage
      const stored = localStorage.getItem('selectedClientId')
      if (stored && fetched.some((c: Client) => c.id === stored)) {
        setSelectedClientId(stored)
      } else if (fetched.length > 0) {
        setSelectedClientId(fetched[0].id)
      }
      setLoading(false)
    })
  }, [refreshClients])

  const selectClient = (id: string) => {
    const effectiveId = id || null
    setSelectedClientId(effectiveId)
    if (effectiveId) {
      localStorage.setItem('selectedClientId', effectiveId)
    } else {
      localStorage.removeItem('selectedClientId')
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null

  return (
    <ClientContext.Provider value={{ clients, selectedClient, selectedClientId, selectClient, refreshClients, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
