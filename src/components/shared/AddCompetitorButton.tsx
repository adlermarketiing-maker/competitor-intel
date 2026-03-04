'use client'

import { useState } from 'react'
import QuickAddModal from './QuickAddModal'

export default function AddCompetitorButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        + Añadir competidor
      </button>
      {open && <QuickAddModal onClose={() => setOpen(false)} />}
    </>
  )
}
