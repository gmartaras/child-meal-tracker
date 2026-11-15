import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FoodEditor, type EditorTarget } from '../components/FoodEditor'
import { RecipeEditor } from '../components/RecipeEditor'
import { Button, Field, Icon, IconButton, Input, Modal, confirmDialog, cx } from '../components/ui'
import { rawValue } from '../domain/calc'
import { allBranded, allCofid, cofidCount, cofidVersion, getFood, groupName, originalFood, overrideDocId, searchFoods } from '../domain/foods'
import { measuresFor } from '../domain/measures'
import { GROUP_ORDER, NUTRIENTS, fmt } from '../domain/nutrients'
import { normaliseRecipe } from '../domain/recipe'
import type { CustomFood, Food, Measure } from '../domain/types'
import { useStore } from '../store/store'

type Filter = 'all' | 'branded' | 'cofid' | 'mine' | 'recipe' | 'formula' | 'supplement' | 'edited'

function sourceLabel(f: Food): string {
  if (f.labelSource) return 'UK brand label'
  if (f.id.startsWith('c:')) return `CoFID ${f.id.slice(2)}`
  return f.kind === 'recipe' ? 'Recipe' : f.kind === 'formula' ? 'Formula / milk' : f.kind === 'supplement' ? 'Supplement' : 'My food'
}

function matches(f: Food, filter: Filter): boolean {
  const isCofid = f.id.startsWith('c:')
  switch (filter) {
    case 'cofid': return isCofid
    case 'branded': return Boolean(f.labelSource)
    case 'mine': return !isCofid && !f.labelSource && f.kind === 'food'
    case 'recipe': return f.kind === 'recipe'
    case 'formula': return f.kind === 'formula'
    case 'supplement': return f.kind === 'supplement'
    case 'edited': return Boolean(f.edited)
    default: return true
  }
}

function AddMeasureInline({ unit, onAdd }: { unit: string; onAdd: (m: Measure) => void }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const a = parseFloat(amount.replace(',', '.'))
  return (
    <div className="mt-2 flex items-end gap-2">
      <Field label="New portion size" className="flex-1"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. half a banana" className="h-8" /></Field>
      <Field label={unit} className="w-20"><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="tnum h-8" /></Field>
      <Button size="sm" disabled={!label.trim() || !(a > 0)} onClick={() => (onAdd({ label: label.trim(), amount: a }), setLabel(''), setAmount(''))}>Add</Button>
    </div>
  )
}

function Detail({ food, custom, onEdit, onClose }: { food: Food; custom?: CustomFood; onEdit: (t: EditorTarget | { type: 'recipe'; recipe: CustomFood }) => void; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const deleteFood = useStore((s) => s.deleteFood)
  const [all, setAll] = useState(false)
  const isCofid = food.id.startsWith('c:')
  const orig = isCofid ? originalFood(food.id) : undefined
  const isFav = settings.favourites.includes(food.id)
  const userMeasures = settings.measures[food.id] ?? []
  const measures = measuresFor(food, { userMeasures, customMeasures: custom?.measures }).filter((m) => !m.estimate && m.label !== food.unit && m.label !== 'ml')
  const shown = NUTRIENTS.filter((n) => all || settings.panel.includes(n.id))
  const base = custom?.basedOn ? getFood(custom.basedOn) : undefined
  const recipe = normaliseRecipe(custom?.recipe)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-snug font-semibold">{food.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5">{sourceLabel(food)}</span>
            {food.edited && <span className="rounded-full bg-accent-wash px-2 py-0.5 text-accent-ink">Edited by you</span>}
            {food.brand && <span>{food.brand}</span>}
            {isCofid && <span>{groupName(food)}</span>}
            {base && <span>based on {base.name}</span>}
          </div>
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} className="lg:hidden" />
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        {!food.labelSource && ((food.kind === 'recipe' || recipe) && custom ? (
          <Button size="sm" variant="primary" icon="edit" onClick={() => onEdit({ type: 'recipe', recipe: custom })}>Edit recipe</Button>
        ) : (
          <Button size="sm" variant="primary" icon="edit" onClick={() => onEdit(isCofid ? { type: 'original', foodId: food.id } : { type: 'edit', food: custom! })}>Edit</Button>
        ))}
        <Button size="sm" icon="copy" onClick={() => onEdit({ type: 'version', sourceId: food.id })}>Make a version</Button>
        {food.edited && <Button size="sm" onClick={() => confirmDialog(`Put “${orig?.name}” back to the original CoFID values?`) && deleteFood(overrideDocId(food.id))}>Revert to original</Button>}
        <Button size="sm" variant="ghost" onClick={() => update({ favourites: isFav ? settings.favourites.filter((x) => x !== food.id) : [...settings.favourites, food.id] })}><Icon name="star" size={14} filled={isFav} className={isFav ? 'text-warning' : ''} /> {isFav ? 'Favourite' : 'Add to favourites'}</Button>
        {!isCofid && custom && <Button size="sm" variant="ghost" icon="trash" className="ml-auto" onClick={() => confirmDialog(`Delete “${food.name}”? Food histories that already use it keep their saved values.`) && (deleteFood(custom.id), onClose())}>Delete</Button>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {food.labelSource && <div className="mb-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2">
          <p className="font-medium">UK label · as sold · checked {food.labelSource.checkedOn.split('-').reverse().join('/')}</p>
          <p className="mt-1">Declared values only. Undeclared nutrients remain unknown. Use a version to record a different pack or formulation.</p>
          <a href={food.labelSource.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-accent-ink underline">View {food.labelSource.publisher} label</a>
        </div>}
        {recipe && (
          <div className="mb-4">
            <div className="mb-1 text-[12px] font-medium text-muted">Ingredients · makes {recipe.portions} portion{recipe.portions === 1 ? '' : 's'}</div>
            <ul className="text-[13px]">
              {recipe.ingredients.map((i) => <li key={i.id} className="flex justify-between gap-3 py-0.5"><span className="truncate">{i.name}</span><span className="tnum shrink-0 text-ink-2">{fmt(i.amount, i.amount < 10 ? 1 : 0)} {i.unit}</span></li>)}
            </ul>
          </div>
        )}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted">Nutrients per {food.per === 1 ? food.unit : `100 ${food.unit}`}</span>
          <button type="button" className="text-[12px] text-accent-ink hover:underline" onClick={() => setAll(!all)}>{all ? 'My panel only' : 'All nutrients'}</button>
        </div>
        {GROUP_ORDER.map((g) => {
          const rows = shown.filter((n) => n.group === g)
          if (!rows.length) return null
          return (
            <div key={g} className="mb-2">
              {rows.map((n) => {
                const { v, lowEst } = rawValue(food, n.id)
                const bound = food.labelSource?.bounds?.[n.id]
                const o = orig && food.edited ? rawValue(orig, n.id).v : undefined
                const changed = o !== undefined && (o == null ? v != null : v == null || Math.abs(o - v) > 1e-9)
                const partial = food.partial?.includes(n.id === 'salt' ? 'sodium' : n.id)
                return (
                  <div key={n.id} className="flex items-baseline justify-between gap-3 border-b border-line py-1 text-[13px] last:border-0">
                    <span className="text-ink-2">{n.short ?? n.label}</span>
                    <span className="tnum text-right">
                      {v == null ? <span className="text-warning-ink">{bound ? `${bound} ${n.unit} (label limit)` : 'no value'}</span> : <><span className={changed ? 'font-semibold text-accent-ink' : 'font-medium'}>{partial ? '≥ ' : ''}{fmt(v, Math.max(n.dp, 1))}</span> <span className="text-muted">{n.unit}{lowEst ? ' (NSP)' : ''}</span></>}
                      {changed && <span className="ml-1.5 text-[11.5px] text-muted">CoFID {o == null ? 'none' : fmt(o, Math.max(n.dp, 1))}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {food.labelSource && (typeof food.values.folic_acid === 'number' || typeof food.values.niacin === 'number') && (
          <dl className="mt-3 space-y-1 rounded-lg border border-line p-2 text-xs">
            {typeof food.values.folic_acid === 'number' && <div className="flex justify-between"><dt>Folic acid (label)</dt><dd>{food.values.folic_acid} µg</dd></div>}
            {typeof food.values.niacin === 'number' && <div className="flex justify-between"><dt>Niacin (label)</dt><dd>{food.values.niacin} mg</dd></div>}
            <dd className="text-muted">Reported separately per 100 g. These entries do not establish total folate or niacin equivalents.</dd>
          </dl>
        )}
        {food.per !== 1 && (
          <div className="mt-4">
            <div className="mb-1 text-[12px] font-medium text-muted">Portion sizes offered when logging</div>
            {measures.length === 0 && <p className="text-[12.5px] text-ink-2">None yet: logged by weight.</p>}
            <ul className="text-[13px]">
              {measures.map((m) => {
                const mine = userMeasures.some((u) => u.label === m.label)
                return (
                  <li key={m.label} className="flex items-center justify-between gap-2 py-0.5">
                    <span>{m.label}{mine && <span className="ml-1.5 text-[11.5px] text-accent-ink">yours</span>}</span>
                    <span className="tnum flex items-center gap-1 text-ink-2">{fmt(m.amount, m.amount < 10 ? 1 : 0)} {food.unit}
                      {mine && <IconButton icon="x" label={`Remove ${m.label}`} className="h-6 w-6" onClick={() => update({ measures: { ...settings.measures, [food.id]: userMeasures.filter((u) => u.label !== m.label) } })} />}
                    </span>
                  </li>
                )
              })}
            </ul>
            <AddMeasureInline unit={food.unit} onAdd={(m) => update({ measures: { ...settings.measures, [food.id]: [...userMeasures.filter((u) => u.label !== m.label), m] } })} />
          </div>
        )}
        {custom?.notes && <p className="mt-4 text-[12.5px] whitespace-pre-wrap text-ink-2">{custom.notes}</p>}
      </div>
    </div>
  )
}

function useIsDesktop(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function LibraryPage() {
  const desktop = useIsDesktop()
  const [params] = useSearchParams()
  const foods = useStore((s) => s.foods)
  const favourites = useStore((s) => s.settings.favourites)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(60)
  const [selected, setSelected] = useState<string | null>(() => params.get("food"))
  const [editor, setEditor] = useState<EditorTarget | { type: 'recipe'; recipe?: CustomFood } | null>(null)

  const customById = useMemo(() => new Map(foods.filter((f) => !f.overrideOf).map((f) => ['u:' + f.id, f])), [foods])
  const mine = useMemo(() => foods.filter((f) => !f.overrideOf), [foods])
  const editedCount = foods.filter((f) => f.overrideOf).length

  const list = useMemo(() => {
    let base: Food[]
    if (q.trim()) base = searchFoods(q, { favourites, limit: 400 })
    else {
      const custom = mine.map((c) => getFood('u:' + c.id)!).filter(Boolean)
      if (filter === 'all') base = [...custom, ...allBranded(), ...allCofid()]
      else if (filter === 'branded') base = [...allBranded()]
      else if (filter === 'cofid' || filter === 'edited') base = allCofid()
      else base = custom
    }
    return base.filter((f) => matches(f, filter))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, foods, favourites, mine])

  const food = selected ? getFood(selected) : undefined
  const chips: { id: Filter; label: string; n?: number }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'cofid', label: 'UK CoFID', n: cofidCount() },
    { id: 'branded', label: 'UK branded foods', n: allBranded().length },
    { id: 'mine', label: 'My foods', n: mine.filter((f) => f.kind === 'food').length },
    { id: 'recipe', label: 'Recipes', n: mine.filter((f) => f.kind === 'recipe').length },
    { id: 'formula', label: 'Formula & milks', n: mine.filter((f) => f.kind === 'formula').length },
    { id: 'supplement', label: 'Supplements', n: mine.filter((f) => f.kind === 'supplement').length },
    { id: 'edited', label: 'Edited CoFID', n: editedCount },
  ]
  const detail = food && <Detail key={food.id} food={food} custom={customById.get(food.id)} onEdit={setEditor} onClose={() => setSelected(null)} />

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-lg font-semibold tracking-tight">Food library</h1>
          <div className="relative min-w-[14rem] flex-1">
            <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <Input autoFocus value={q} onChange={(e) => (setQ(e.target.value), setLimit(60))} placeholder={`Search ${cofidCount().toLocaleString('en-GB')} CoFID foods and your own…`} className="pl-8" aria-label="Search the food library" />
          </div>
          <Button icon="plus" onClick={() => setEditor({ type: 'new', initial: { kind: filter === 'formula' ? 'formula' : filter === 'supplement' ? 'supplement' : 'food', unit: filter === 'formula' ? 'ml' : 'g' } })}>New food</Button>
          <Button variant="primary" icon="plus" onClick={() => setEditor({ type: 'recipe' })}>New recipe</Button>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {chips.map((c) => (
            <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => (setFilter(c.id), setLimit(60))} className={cx('rounded-full border px-2.5 py-1 text-[12.5px] whitespace-nowrap transition-colors', filter === c.id ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink-2 hover:bg-surface-2')}>
              {c.label}{c.n != null && <span className={cx('ml-1.5', filter === c.id ? 'opacity-70' : 'text-muted')}>{c.n.toLocaleString('en-GB')}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="scroll-thin min-h-0 overflow-y-auto">
          {list.length === 0 ? (
            <div className="px-6 py-10 text-center text-[13.5px] text-ink-2">
              {q.trim() ? <>Nothing matches “{q}”.</> : filter === 'recipe' ? 'No recipes yet. Build one from library foods and its nutrients are calculated for you.' : filter === 'formula' ? 'CoFID has no infant formula or growing-up milks. Add the products your clients use from the manufacturer’s data card.' : filter === 'edited' ? 'You have not edited any CoFID foods.' : 'Nothing here yet.'}
              <div className="mt-3 flex justify-center gap-2">
                {filter === 'recipe' ? <Button icon="plus" onClick={() => setEditor({ type: 'recipe' })}>New recipe</Button> : filter !== 'edited' && filter !== 'cofid' && <Button icon="plus" onClick={() => setEditor({ type: 'new', initial: { name: q.trim(), kind: filter === 'formula' ? 'formula' : filter === 'supplement' ? 'supplement' : 'food' } })}>New food</Button>}
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {list.slice(0, limit).map((f) => {
                const kcal = rawValue(f, 'energy').v
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => setSelected(f.id)} className={cx('flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left sm:px-6', selected === f.id ? 'bg-accent-wash' : 'hover:bg-surface-2')}>
                      <span className="min-w-0">
                        <span className="text-[13.5px]">{favourites.includes(f.id) && <Icon name="star" size={12} filled className="mr-1 inline align-[-1px] text-warning" />}{f.name}</span>
                        {f.edited && <span className="ml-2 rounded-full bg-accent-wash px-1.5 py-0.5 text-[11px] text-accent-ink">edited</span>}
                        {f.brand && <span className="ml-1.5 text-[12px] text-muted">{f.brand}</span>}
                      </span>
                      <span className="tnum shrink-0 text-[12px] text-muted">{f.id.startsWith('c:') ? groupName(f) : sourceLabel(f)}{kcal != null ? ` · ${fmt(kcal, 0)} kcal/${f.per === 1 ? f.unit : '100 ' + f.unit}` : ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {list.length > limit && <div className="p-4 text-center"><Button size="sm" onClick={() => setLimit(limit + 200)}>Show more ({(list.length - limit).toLocaleString('en-GB')} more)</Button></div>}
          <p className="px-4 py-3 text-[12px] text-muted sm:px-6">{cofidVersion}: McCance and Widdowson’s Composition of Foods Integrated Dataset. “No value” means CoFID gives no reliable figure; the analysis flags these instead of counting them as zero.</p>
        </div>
        <aside className="hidden min-h-0 border-l border-line bg-surface lg:block">
          {(desktop && detail) || <div className="flex h-full items-center justify-center px-8 text-center text-[13.5px] text-ink-2">Select a food to see its nutrients, edit it, or make a version such as a half portion.</div>}
        </aside>
      </div>
      {food && !desktop && <Modal title="Food details" onClose={() => setSelected(null)}><div className="-mx-5 -my-4">{detail}</div></Modal>}
      {editor && (editor.type === 'recipe' ? <RecipeEditor recipe={editor.recipe} onClose={() => setEditor(null)} onSaved={(f) => setSelected('u:' + f.id)} /> : <FoodEditor target={editor} onClose={() => setEditor(null)} onSaved={(f) => setSelected('u:' + f.id)} />)}
    </div>
  )
}
