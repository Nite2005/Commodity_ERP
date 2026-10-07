import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type { Party } from '../types'

interface PartyMultiSelectProps {
  parties: Party[]
  selectedPartyIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

export function PartyMultiSelect({
  parties,
  selectedPartyIds,
  onChange,
  placeholder = 'Select Counterparty…',
}: PartyMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredParties = parties.filter((p) => {
    const term = searchTerm.toLowerCase()
    return (
      p.name.toLowerCase().includes(term) ||
      (p.short_name && p.short_name.toLowerCase().includes(term)) ||
      (p.party_code && p.party_code.toLowerCase().includes(term))
    )
  })

  const toggleParty = (id: string) => {
    if (selectedPartyIds.includes(id)) {
      onChange(selectedPartyIds.filter((pId) => pId !== id))
    } else {
      onChange([...selectedPartyIds, id])
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const selectAllFiltered = () => {
    const idsToAdd = filteredParties.map((p) => p.id)
    const combined = Array.from(new Set([...selectedPartyIds, ...idsToAdd]))
    onChange(combined)
  }

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-[200px] max-w-[300px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <span className="truncate">
          {selectedPartyIds.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : selectedPartyIds.length === 1 ? (
            parties.find((p) => p.id === selectedPartyIds[0])?.name || '1 Party selected'
          ) : (
            <span className="font-medium text-brand-700">
              {selectedPartyIds.length} Counterparties selected
            </span>
          )}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          {selectedPartyIds.length > 0 && (
            <span
              onClick={clearAll}
              className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"
              title="Clear selection"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in-50">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Search party by name or code…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] text-slate-500">
            <span>
              {selectedPartyIds.length} of {parties.length} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-brand-600 hover:underline"
              >
                Select all
              </button>
              {selectedPartyIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-red-500 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredParties.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No parties found</div>
            ) : (
              filteredParties.map((party) => {
                const isSelected = selectedPartyIds.includes(party.id)
                return (
                  <div
                    key={party.id}
                    onClick={() => toggleParty(party.id)}
                    className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs transition ${
                      isSelected
                        ? 'bg-brand-50 text-brand-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{party.name}</span>
                    </div>
                    <span className="ml-2 font-mono text-[10px] text-slate-400">
                      {party.party_code}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
