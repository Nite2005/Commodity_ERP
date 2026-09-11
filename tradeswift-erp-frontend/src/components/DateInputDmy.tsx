import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { dmyToIso, isoToDmy, maskDmyInput } from '../lib/dates'
import { inputClass } from './Modal'

interface DateInputDmyProps {
  value: string
  onChange: (iso: string) => void
  className?: string
  required?: boolean
  disabled?: boolean
  id?: string
}

/** DD/MM/YYYY text + clickable native calendar on the icon. Value = YYYY-MM-DD. */
export function DateInputDmy({
  value,
  onChange,
  className = '',
  required,
  disabled,
  id,
}: DateInputDmyProps) {
  const [text, setText] = useState(() => isoToDmy(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(isoToDmy(value))
  }, [value, focused])

  const display = focused ? text : isoToDmy(value)

  return (
    <div className={`relative min-w-[148px] ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        className={`${inputClass} w-full pr-10`}
        value={display}
        required={required}
        disabled={disabled}
        onFocus={() => {
          setFocused(true)
          setText(isoToDmy(value))
        }}
        onBlur={() => {
          setFocused(false)
          const iso = dmyToIso(text)
          if (iso) {
            onChange(iso)
            setText(isoToDmy(iso))
          } else if (!text.trim()) {
            onChange('')
            setText('')
          } else {
            setText(isoToDmy(value))
          }
        }}
        onChange={(e) => {
          const next = maskDmyInput(e.target.value)
          setText(next)
          const iso = dmyToIso(next)
          if (iso) onChange(iso)
          if (!next) onChange('')
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400">
        <Calendar size={16} />
      </div>
      {/* Transparent native date control over the calendar icon — opens real picker */}
      <input
        type="date"
        value={value || ''}
        disabled={disabled}
        title="Open calendar"
        aria-label="Open calendar"
        className="absolute inset-y-0 right-0 z-10 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => {
          const next = e.target.value
          onChange(next)
          setText(isoToDmy(next))
        }}
      />
    </div>
  )
}
