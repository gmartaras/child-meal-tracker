import { useState } from 'react'
import { GROUP_ORDER, NUTRIENTS } from '../domain/nutrients'
import type { CustomFood, FoodKind, Measure } from '../domain/types'
import { useStore } from '../store/store'
import { Banner, Button, Field, IconButton, Input, Modal, Segmented, Textarea } from './ui'

const KINDS: { id: FoodKind; label: string }[] = [
  { id: 'food', label: 'Food / drink' },
  { id: 'formula', label: 'Formula / milk' },
  { id: 'supplement', label: 'Supplement' },
]

/** Add or edit a food from its label. Blank nutrient boxes mean "not known", never zero. */
export function CustomFoodForm({ initial, onClose, onSaved }: { initial?: Partial<CustomFood>; onClose: () => void; onSaved?: (f: CustomFood) => void }) {
  const saveFood = useStore((s) => s.saveFood)
  const panel = useStore((s) => s.settings.panel)
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [kind, setKind] = useState<FoodKind>(initial?.kind ?? 'food')
  const [unit, setUnit] = useState(initial?.unit ?? 'g')
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial?.values ?? {}).map(([k, v]) => [k, String(v)])))
  const [measures, setMeasures] = useState<Measure[]>(initial?.measures ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [showAll, setShowAll] = useState(false)

  const isSupp = kind === 'supplement'
  const setKindAndUnit = (k: FoodKind) => {
    setKind(k)
    if (k === 'supplement') setUnit(unit === 'g' || unit === 'ml' ? 'dose' : unit)
    else if (k === 'formula') setUnit('ml')
    else setUnit(unit === 'ml' ? 'ml' : 'g')
  }
  const basis = isSupp ? `per ${unit || 'dose'}` : `per 100 ${unit}`
  const filled = new Set(Object.keys(values).filter((k) => values[k] !== ''))
  const visible = NUTRIENTS.filter((n) => showAll || panel.includes(n.id) || filled.has(n.id) || (isSupp ? false : n.id === 'sodium'))

  const save = () => {
    const vals: Record<string, number> = {}
    for (const [k, v] of Object.entries(values)) {
      const x = parseFloat(v.replace(',', '.'))
      if (v.trim() !== '' && isFinite(x) && x >= 0) vals[k] = x
    }
    // salt and sodium describe the same thing: keep one source of truth
    if (vals.salt != null && vals.sodium == null) vals.sodium = (vals.salt * 1000) / 2.5
    delete vals.salt
    const doc = saveFood({
      id: initial?.id,
      name: name.trim(),
      brand: brand.trim() || undefined,
      kind,
      per: isSupp ? 1 : 100,
      unit: isSupp ? unit.trim() || 'dose' : unit,
      values: vals,
      measures: measures.filter((m) => m.label.trim() && m.amount > 0),
      notes: notes.trim() || undefined,
    })
    onSaved?.(doc)
    onClose()
  }

  return (
    <Modal
      wide
      title={initial?.id ? 'Edit food' : 'New food'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>Save food</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Organic carrot puffs" /></Field>
        <Field label="Brand (optional)"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink-2">Type</span>
          <Segmented value={kind} onChange={setKindAndUnit} options={KINDS} />
        </div>
        {isSupp ? (
          <Field label="One dose is called" className="w-44"><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="drop, ml, tablet…" /></Field>
        ) : (
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-2">Label values are</span>
            <Segmented value={unit === 'ml' ? 'ml' : 'g'} onChange={(u) => setUnit(u)} options={[{ id: 'g', label: 'per 100 g' }, { id: 'ml', label: 'per 100 ml' }]} />
          </div>
        )}
      </div>
      {kind === 'formula' && <p className="mt-2 text-[12px] text-muted">Enter formula values per 100 ml as fed (made up), from the manufacturer’s data card.</p>}

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Nutrients {basis}</h3>
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : 'Show all nutrients'}</Button>
      </div>
      <Banner>Leave a box empty when the label does not give a value. Empty means “not known” and is flagged in the analysis; type 0 only if the food truly contains none.</Banner>
      {GROUP_ORDER.map((g) => {
        const rows = visible.filter((n) => n.group === g)
        if (!rows.length) return null
        return (
          <div key={g} className="mt-3">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              {rows.map((n) => (
                <label key={n.id} className="block">
                  <span className="mb-0.5 block truncate text-[12px] text-ink-2">{n.short ?? n.label} <span className="text-muted">({n.unit})</span></span>
                  <Input inputMode="decimal" value={values[n.id] ?? ''} onChange={(e) => setValues({ ...values, [n.id]: e.target.value })} className="tnum h-8" aria-label={`${n.label} ${basis}`} />
                </label>
              ))}
            </div>
          </div>
        )
      })}
      {!isSupp && <p className="mt-2 text-[12px] text-muted">Enter either salt or sodium; the other is calculated.</p>}

      <h3 className="mt-5 mb-2 text-[13px] font-semibold">Portion sizes (optional)</h3>
      <div className="space-y-2">
        {measures.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={m.label} placeholder="e.g. pouch, scoop, bar" onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input className="tnum w-24" inputMode="decimal" value={m.amount || ''} placeholder={isSupp ? 'doses' : unit} onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} />
            <span className="w-10 text-[12px] text-muted">{isSupp ? unit : unit}</span>
            <IconButton icon="trash" label="Remove portion" onClick={() => setMeasures(measures.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button size="sm" icon="plus" onClick={() => setMeasures([...measures, { label: '', amount: 0 }])}>Add a portion size</Button>
      </div>
      <Field label="Notes (optional)" className="mt-4"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Source of the values, date checked…" /></Field>
    </Modal>
  )
}
