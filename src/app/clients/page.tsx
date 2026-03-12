'use client'

import { useState, useEffect, useRef } from 'react'
import { useClient } from '@/contexts/ClientContext'
import { useToast } from '@/contexts/ToastContext'
import type { Client } from '@/types/client'

export default function ClientsPage() {
  const { refreshClients, selectClient } = useClient()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '',
    niche: '',
    description: '',
    avatarDesc: '',
    websiteUrl: '',
    driveFolder: '',
    notes: '',
  })

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setClients(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes')
    }
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  const resetForm = () => {
    setForm({ name: '', niche: '', description: '', avatarDesc: '', websiteUrl: '', driveFolder: '', notes: '' })
  }

  const startCreate = () => {
    resetForm()
    setEditing(null)
    setCreating(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  const startEdit = (client: Client) => {
    setForm({
      name: client.name,
      niche: client.niche || '',
      description: client.description || '',
      avatarDesc: client.avatarDesc || '',
      websiteUrl: client.websiteUrl || '',
      driveFolder: client.driveFolder || '',
      notes: client.notes || '',
    })
    setCreating(false)
    setEditing(client.id)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (creating) {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Error al crear')
        const newClient = await res.json()
        selectClient(newClient.id)
      } else if (editing) {
        const res = await fetch(`/api/clients/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Error al guardar')
      }
      setCreating(false)
      setEditing(null)
      resetForm()
      await refreshClients()
      await fetchClients()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente y TODOS sus datos? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      await refreshClients()
      await fetchClients()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar', 'error')
    }
  }

  const cancel = () => {
    setCreating(false)
    setEditing(null)
    resetForm()
  }

  const canAnalyze = form.websiteUrl.trim() || form.driveFolder.trim()

  const handleAnalyze = async () => {
    if (!canAnalyze) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/clients/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: form.websiteUrl.trim() || undefined,
          driveFolder: form.driveFolder.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm((f) => ({
        ...f,
        niche: data.niche || f.niche,
        description: data.description || f.description,
        avatarDesc: data.avatarDesc || f.avatarDesc,
      }))
      toast('Campos auto-rellenados', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al analizar', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="h-7 bg-slate-200 rounded-lg w-48 mb-2 animate-skeleton" />
          <div className="h-4 bg-slate-100 rounded w-24 animate-skeleton" />
        </div>
        <div className="space-y-3 animate-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <div className="h-4 bg-slate-200 rounded-full w-40" />
              <div className="h-3 bg-slate-100 rounded-full w-full" />
              <div className="h-3 bg-slate-100 rounded-full w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestionar Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={startCreate}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Nuevo Cliente
        </button>
      </div>

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            {creating ? 'Nuevo Cliente' : 'Editar Cliente'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Nombre *</label>
              <input
                ref={nameRef}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre del cliente"
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Nicho</label>
              <input
                value={form.niche}
                onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                placeholder="ej. Marketing Digital"
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Website</label>
              <input
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Carpeta Google Drive</label>
              <input
                value={form.driveFolder}
                onChange={(e) => setForm((f) => ({ ...f, driveFolder: e.target.value }))}
                placeholder="URL de la carpeta"
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            {/* Auto-rellenar button */}
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || !canAnalyze}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                title="Analizar web y/o Drive con IA para auto-rellenar nicho, descripcion y avatar"
              >
                {analyzing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Auto-rellenar con IA (desde web y/o Drive)
                  </>
                )}
              </button>
              <p className="text-xs text-slate-400 mt-1 text-center">
                Rellena automaticamente nicho, descripcion y avatar analizando la web y la info de Drive
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Descripcion del negocio</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Que hace este cliente, que vende..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Avatar / Cliente Ideal</label>
              <textarea
                value={form.avatarDesc}
                onChange={(e) => setForm((f) => ({ ...f, avatarDesc: e.target.value }))}
                placeholder="A quien se dirige, demografia, dolores..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Notas</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas internas"
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={cancel}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : creating ? 'Crear Cliente' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Client list */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin clientes</p>
          <p className="text-xs text-slate-400 mb-4">Crea tu primer cliente para empezar a organizar competidores</p>
          <button
            onClick={startCreate}
            className="text-sm text-violet-600 font-medium hover:underline"
          >
            + Crear primer cliente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-bold text-slate-900">{client.name}</h3>
                    {client.niche && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                        {client.niche}
                      </span>
                    )}
                  </div>
                  {client.description && (
                    <p className="text-sm text-slate-500 mb-2 line-clamp-2">{client.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {client._count?.competitors != null && (
                      <span>{client._count.competitors} competidores</span>
                    )}
                    {client.websiteUrl && (
                      <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">
                        {(() => { try { return new URL(client.websiteUrl).hostname } catch { return client.websiteUrl } })()}
                      </a>
                    )}
                    <span>
                      {new Date(client.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => startEdit(client)}
                    className="text-xs font-medium px-3 py-1.5 text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { selectClient(client.id); window.location.href = '/' }}
                    className="text-xs font-medium px-3 py-1.5 text-violet-600 hover:bg-violet-50 rounded-lg border border-violet-200 transition-colors"
                  >
                    Seleccionar
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="text-xs font-medium px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar cliente"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
