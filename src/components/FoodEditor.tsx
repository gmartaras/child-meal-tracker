import { useMemo, useState } from 'react'
import { rawValue } from '../domain/calc'
import { getFood, originalFood, overrideDocId } from '../domain/foods'
import { measuresFor } from '../domain/measures'
import { GROUP_ORDER, NUTRIENTS, fmt } from '../domain/nutrients'
import type { CustomFood, Food, FoodKind, Measure } from '../domain/types'
import { useStore } from '../store/store'
import { Banner, Button, Field, IconButton, Input, Modal, Segmented, Select, Textarea } from './ui'

export type EditorTarget =
  | { type: 'new'; initial?: Partial<CustomFood> }
  | { type: 'edit'; food: CustomFood }
  /** change the values of a CoFID food itself; can be reverted */
  | { type: 'original'; foodId: string }
  /** a new entry that starts from an existing one, e.g. "half a banana" */
  | { type: 'version'; sourceId: string }

const KINDS: { id: FoodKind; label: string }[] = [
  { id: 'food', label: 'Food / drink' },
  { id: 'formula', label: 'Formula / milk' },
  { id: 'supplement', label: 'Supplement' },
]
type Basis = 'g' | 'ml' | 'portion'

/** Stored nutrient ids: everything shown on the form except salt (kept as sodium). */
const FORM_IDS = NUTRIENTS.map((n) => n.id)

function valuesOf(food: Food): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of FORM_IDS) {
    if (id === 'salt') continue
    const { v } = rawValue(food, id)
    if (v != null) out[id] = String(Math.round(v * 10000) / 10000)
  }
  return out
}

const parse = (s: string | undefined): number | null => {
  if (s == null || s.trim() === '') return null
  const x = parseFloat(s.replace(',', '.'))
  return isFinite(x) && x >= 0 ? x : null
}

/**
 * One editor for every kind of library entry. Blank nutrient boxes mean "not known", never zero.
 */
export function FoodEditor({ target, onClose, onSaved }: { target: EditorTarget; onClose: () => void; onSaved?: (f: CustomFood) => void }) {
  const saveFood = useStore((s) => s.saveFood)
  const deleteFood = useStore((s) => s.deleteFood)
  const panel = useStore((s) => s.settings.panel)
  const userMeasures = useStore((s) => s.settings.measures)

  const source = target.type === 'version' ? getFood(target.sourceId) : target.type === 'original' ? getFood(target.foodId) : undefined
  const original = target.type === 'original' ? originalFood(target.foodId) : undefined
  const existing = target.type === 'edit' ? target.food : target.type === 'new' ? target.initial : undefined

  const [name, setName] = useState(existing?.name ?? (target.type === 'original' ? (source?.name ?? '') : ''))
  const [brand, setBrand] = useState(existing?.brand ?? '')
  const [kind, setKind] = useState<FoodKind>(existing?.kind === 'recipe' ? 'food' : (existing?.kind ?? (source?.kind === 'supplement' || source?.kind === 'formula' ? source.kind : 'food')))
  const [basis, setBasis] = useState<Basis>(() => {
    const u = existing?.unit ?? source?.unit ?? 'g'
    if (existing?.per === 1 || (source && source.per === 1)) return 'portion'
    return u === 'ml' ? 'ml' : 'g'
  })
  const [unitName, setUnitName] = useState(() => {
    const u = existing?.unit ?? source?.unit
    return u && u !== 'g' && u !== 'ml' ? u : kind === 'supplement' ? 'dose' : 'portion'
  })
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (source) return valuesOf(source)
    return Object.fromEntries(Object.entries(existing?.values ?? {}).map(([k, v]) => [k, String(v)]))
  })
  const [measures, setMeasures] = useState<Measure[]>(existing?.measures ?? [])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [showAll, setShowAll] = useState(target.type === 'original')
  const [factor, setFactor] = useState('0.5')

  // --- "version" helper: turn the source into a named portion
  const srcMeasures = useMemo(() => (source && target.type === 'version' ? measuresFor(source, { userMeasures: userMeasures[source.id] }).filter((m) => !m.estimate) : []), [source, target.type, userMeasures])
  const [portionMeasure, setPortionMeasure] = useState('')
  const [portionQty, setPortionQty] = useState('0.5')
  const [portionGrams, setPortionGrams] = useState('')

  const isSupp = kind === 'supplement'
  const perOne = isSupp || basis === 'portion'
  const basisLabel = perOne ? `per ${unitName || (isSupp ? 'dose' : 'portion')}` : `per 100 ${basis}`
  const filled = new Set(Object.keys(values).filter((k) => values[k] !== ''))
  const visible = NUTRIENTS.filter((n) => showAll || panel.includes(n.id) || filled.has(n.id) || (!isSupp && n.id === 'sodium'))
  const isOriginal = target.type === 'original'

  const scaleAll = (f: number) => {
    if (!(f > 0)) return
    setValues(Object.fromEntries(Object.entries(values).map(([k, v]) => {
      const x = parse(v)
      return [k, x == null ? '' : String(Math.round(x * f * 10000) / 10000)]
    })))
  }

  const applyPortion = () => {
    if (!source) return
    const m = srcMeasures.find((x) => x.label === portionMeasure)
    const q = parse(portionQty) ?? 1
    const amount = m ? m.amount * q : (parse(portionGrams) ?? 0)
    if (!(amount > 0)) return
    const base = valuesOf(source)
    setValues(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, String(Math.round(((parseFloat(v) * amount) / source.per) * 10000) / 10000)])))
    setBasis('portion')
    setUnitName('portion')
    const qLabel = q === 0.5 ? 'Half a' : q === 0.25 ? 'Quarter of a' : q === 1 ? 'One' : `${fmt(q, q % 1 ? 2 : 0)} ×`
    if (!name.trim()) setName(m ? `${qLabel} ${m.label.replace(/\s*\(.*\)$/, '')} – ${source.name}` : `${fmt(amount, 0)} ${source.unit} – ${source.name}`)
    setNotes(`One portion = ${fmt(amount, amount < 10 ? 1 : 0)} ${source.unit} of “${source.name}”.`)
  }

  const save = () => {
    const vals: Record<string, number> = {}
    for (const id of FORM_IDS) {
      const x = parse(values[id])
      if (x != null) vals[id] = x
    }
    // salt and sodium describe the same thing: keep sodium as the single source of truth
    if (vals.salt != null && vals.sodium == null) vals.sodium = (vals.salt * 1000) / 2.5
    delete vals.salt

    if (isOriginal && original) {
      // store only what differs from CoFID, so "Revert" is simply removing this record
      const changed: Record<string, number> = {}
      for (const [id, v] of Object.entries(vals)) {
        const o = rawValue(original, id).v
        if (o == null || Math.abs(o - v) > 1e-9) changed[id] = v
      }
      const newName = name.trim() && name.trim() !== original.name ? name.trim() : ''
      const id = overrideDocId(original.id)
      if (!Object.keys(changed).length && !newName) deleteFood(id)
      else saveFood({ id, overrideOf: original.id, name: newName, kind: 'food', per: 100, unit: 'g', values: changed, notes: notes.trim() || undefined })
      onClose()
      return
    }
    const doc = saveFood({
      id: target.type === 'edit' ? target.food.id : undefined,
      name: name.trim(),
      brand: brand.trim() || undefined,
      kind,
      per: perOne ? 1 : 100,
      unit: perOne ? unitName.trim() || (isSupp ? 'dose' : 'portion') : basis,
      values: vals,
      measures: measures.filter((m) => m.label.trim() && m.amount > 0),
      notes: notes.trim() || undefined,
      basedOn: target.type === 'version' ? target.sourceId : existing?.basedOn,
    })
    onSaved?.(doc)
    onClose()
  }

  const title = isOriginal ? 'Edit CoFID food' : target.type === 'version' ? 'New version of a food' : target.type === 'edit' ? 'Edit food' : 'New food'

  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      {isOriginal && (
        <div className="mb-3">
          <Banner>You are editing the CoFID entry itself. Only the values you change are stored, the rest still come from CoFID, and “Revert to original” in the library undoes it at any time. Food histories already entered keep the values they were saved with.</Banner>
        </div>
      )}
      {target.type === 'version' && source && (
        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="text-[13px] font-medium">Start from “{source.name}”</div>
          <p className="mt-0.5 text-[12.5px] text-ink-2">All its values are copied in below. To make a ready-sized entry such as half a banana, pick the amount and the nutrients are worked out for you.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {srcMeasures.length > 1 && (
              <>
                <Field label="How much" className="w-24">
                  <Select value={portionQty} onChange={(e) => setPortionQty(e.target.value)}>
                    {[['0.25', '¼'], ['0.5', '½'], ['0.75', '¾'], ['1', '1'], ['1.5', '1½'], ['2', '2']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                <Field label="of" className="min-w-[11rem] flex-1">
                  <Select value={portionMeasure} onChange={(e) => setPortionMeasure(e.target.value)}>
                    <option value="">(type a weight instead)</option>
                    {srcMeasures.filter((m) => m.label !== source.unit).map((m) => <option key={m.label} value={m.label}>{m.label}{/\d\s*(g|ml)\)/.test(m.label) ? '' : ` (${fmt(m.amount, m.amount < 10 ? 1 : 0)} ${source.unit})`}</option>)}
                  </Select>
                </Field>
              </>
            )}
            {!portionMeasure && <Field label={`Weight (${source.unit})`} className="w-28"><Input inputMode="decimal" className="tnum" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} /></Field>}
            <Button onClick={applyPortion} disabled={!portionMeasure && !(parse(portionGrams) ?? 0)}>Work out this portion</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus={target.type !== 'version'} placeholder="e.g. Organic carrot puffs" /></Field>
        {!isOriginal && <Field label="Brand (optional)"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>}
      </div>
      {!isOriginal && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-2">Type</span>
            <Segmented
              value={kind}
              onChange={(k) => {
                setKind(k)
                if (k === 'supplement') setUnitName(unitName === 'portion' ? 'dose' : unitName)
                else if (k === 'formula' && basis === 'g') setBasis('ml')
              }}
              options={KINDS}
            />
          </div>
          {!isSupp && (
            <div>
              <span className="mb-1 block text-[12px] font-medium text-ink-2">Values are</span>
              <Segmented value={basis} onChange={setBasis} options={[{ id: 'g', label: 'per 100 g' }, { id: 'ml', label: 'per 100 ml' }, { id: 'portion', label: 'per portion' }]} />
            </div>
          )}
          {perOne && <Field label={isSupp ? 'One dose is called' : 'One portion is called'} className="w-40"><Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder={isSupp ? 'drop, ml, tablet…' : 'portion, pouch, bar…'} /></Field>}
        </div>
      )}
      {kind === 'formula' && <p className="mt-2 text-[12px] text-muted">Enter formula values per 100 ml as fed (made up), from the manufacturer’s data card.</p>}

      <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">Nutrients {isOriginal ? 'per 100 g' : basisLabel}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted">Multiply all by</span>
          <span className="inline-block w-16"><Input value={factor} onChange={(e) => setFactor(e.target.value)} inputMode="decimal" className="tnum h-8" aria-label="Multiply all values by" /></span>
          <Button size="sm" onClick={() => scaleAll(parse(factor) ?? 0)}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Fewer nutrients' : 'All nutrients'}</Button>
        </div>
      </div>
      <p className="mb-1 text-[12px] text-muted">{isOriginal ? 'An empty box keeps the CoFID value (or stays “no value” where CoFID has none).' : 'Leave a box empty when the value is not known. Empty means “no data” and is flagged in the analysis; type 0 only if the food truly contains none.'}</p>
      {GROUP_ORDER.map((g) => {
        const rows = visible.filter((n) => n.group === g && !(isOriginal && n.id === 'salt'))
        if (!rows.length) return null
        return (
          <div key={g} className="mt-3">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              {rows.map((n) => {
                const o = original ? rawValue(original, n.id).v : null
                const cur = parse(values[n.id])
                const changed = isOriginal && cur != null && (o == null || Math.abs(o - cur) > 1e-9)
                return (
                  <label key={n.id} className="block">
                    <span className="mb-0.5 block truncate text-[12px] text-ink-2">{n.short ?? n.label} <span className="text-muted">({n.unit})</span></span>
                    <Input inputMode="decimal" value={values[n.id] ?? ''} onChange={(e) => setValues({ ...values, [n.id]: e.target.value })} className={`tnum h-8 ${changed ? 'border-accent ring-1 ring-accent/30' : ''}`} aria-label={`${n.label} ${basisLabel}`} />
                    {changed && <span className="mt-0.5 block text-[11px] text-muted">CoFID: {o == null ? 'no value' : fmt(o, Math.max(n.dp, 1))}</span>}
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      {!isSupp && !isOriginal && <p className="mt-2 text-[12px] text-muted">Enter either salt or sodium; the other is calculated.</p>}

      {!isOriginal && !perOne && (
        <>
          <h3 className="mt-5 mb-2 text-[13px] font-semibold">Portion sizes (optional)</h3>
          <div className="space-y-2">
            {measures.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={m.label} placeholder="e.g. pouch, scoop, bar" onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input className="tnum w-24" inputMode="decimal" value={m.amount || ''} placeholder={basis} onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} />
                <span className="w-8 text-[12px] text-muted">{basis}</span>
                <IconButton icon="trash" label="Remove portion" onClick={() => setMeasures(measures.filter((_, j) => j !== i))} />
              </div>
            ))}
            <Button size="sm" icon="plus" onClick={() => setMeasures([...measures, { label: '', amount: 0 }])}>Add a portion size</Button>
          </div>
        </>
      )}
      <Field label="Notes (optional)" className="mt-4"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Source of the values, date checked…" /></Field>
    </Modal>
  )
}
