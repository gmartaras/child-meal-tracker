import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FoodSearch } from '../../components/FoodSearch'
import { Button, Card, IconButton, cx } from '../../components/ui'
import { formatDateShort, todayISO, uid } from '../../domain/age'
import { rawValue } from '../../domain/calc'
import { getFood } from '../../domain/foods'
import { fmtNutrient, NUTRIENTS } from '../../domain/nutrients'
import { FOOD_GROUPS, type AcceptedFood, type Client, type Food } from '../../domain/types'
import { useStore } from '../../store/store'

function FoodComposition({food, label}: {food:Food; label:string}) {
  const panel = useStore(s => s.settings.panel)
  return <details className="mt-1 text-sm">
    <summary className="cursor-pointer text-accent-ink">Nutrients per {food.per} {food.unit}</summary>
    {label !== food.name && <p className="mt-2 text-xs text-ink-2">Library match: {food.name}</p>}
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
      {NUTRIENTS.filter(n=>panel.includes(n.id)).map(n=>{
        const {v,lowEst} = rawValue(food,n.id)
        const lowerBound = lowEst || food.partial?.includes(n.id)
        return <div className="flex flex-wrap justify-between gap-x-1 text-xs" key={n.id}>
          <dt className="text-ink-2">{n.short ?? n.label}</dt>
          <dd className="tnum">{v == null ? 'Unknown' : `${lowerBound ? '≥ ' : ''}${fmtNutrient(n.id,v)} ${n.unit}`}</dd>
        </div>
      })}
    </dl>
    <Link className="mt-2 inline-block text-xs font-medium text-accent-ink underline" to={`/foods?food=${encodeURIComponent(food.id)}`}>Open in food library</Link>
  </details>
}

export function AcceptedFoods({ client }: { client: Client }) {
  const patchClient = useStore(s => s.patchClient)
  const list = client.acceptedFoods ?? []
  const [date, setDate] = useState(todayISO())
  const [linking, setLinking] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  const save = async (foods: AcceptedFood[], message: string) => {
    setPending(true)
    const ok = await patchClient(client.id, {acceptedFoods: foods})
    setPending(false)
    setStatus(ok ? message : 'The change could not be saved. Try again.')
    return ok
  }
  const add = (food: Food, group: number, existing?: AcceptedFood) => {
    if (pending) return
    if (list.some(item => item.group === group && item.foodId === food.id && item.id !== existing?.id)) {
      setStatus(`${food.name} is already listed in this group.`)
      return
    }
    const next = existing ? list.map(item => item.id === existing.id ? {...item, foodId:food.id} : item)
      : [...list, {id:uid(), name:food.name, group, foodId:food.id, addedOn:date}]
    void save(next, `${food.name} saved and linked to the library.`).then(ok => {if (ok) setLinking(null)})
  }
  const firstDate = list.length ? list.map(f => f.addedOn).sort()[0] : null

  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <p className="min-w-0 flex-1 text-sm text-ink-2">Choose foods from the library to see their nutrients and reuse them in a food history. This list tracks what the child accepts. Food histories track how much they eat.</p>
      <label className="flex items-center gap-1.5 text-xs text-ink-2">Adding as of <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && setDate(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]"/></label>
      {list.length > 0 && <Link className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium" to={`/c/${client.id}/print/accepted`}>Print for parents</Link>}
    </div>
    <div className="mb-3 flex flex-wrap gap-3 text-sm text-ink-2">
      <span>{list.length} accepted · {list.filter(item=>item.foodId && getFood(item.foodId)).length} linked</span>
      <span role="status">{pending ? 'Saving…' : status}</span>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {FOOD_GROUPS.map((group,index)=>{
        const foods = list.filter(food=>food.group===index)
        return <Card key={group} className={cx('p-4',index===4 && 'lg:col-span-2')}>
          <h3 className="mb-3 text-sm font-semibold">{group}</h3>
          {foods.length > 0 && <ul className="mb-3 divide-y divide-line border-y border-line">
            {foods.map(item=>{
              const food = item.foodId ? getFood(item.foodId) : undefined
              return <li className="py-2" key={item.id}>
                <div className="flex flex-wrap items-center gap-2" title={`Added ${formatDateShort(item.addedOn)}`}>
                  <span className="min-w-0 flex-1 text-sm font-medium">{item.name}</span>
                  {firstDate && item.addedOn > firstDate && <span className="rounded bg-good-wash px-1.5 text-xs text-good-ink">New</span>}
                  {!food && <Button size="sm" disabled={pending} onClick={()=>setLinking(linking===item.id ? null : item.id)}>{linking===item.id ? 'Cancel' : 'Link to library'}</Button>}
                  <IconButton icon="x" label={`Remove ${item.name}`} disabled={pending} onClick={()=>void save(list.filter(f=>f.id!==item.id),`${item.name} removed.`)}/>
                </div>
                {food ? <FoodComposition food={food} label={item.name}/> : <p className="text-xs text-muted">{item.foodId ? 'Library entry unavailable' : 'Existing text entry · no nutrient data linked'}</p>}
                {item.note && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-2">{item.note}</p>}
                {linking===item.id && !food && <fieldset className="mt-2" disabled={pending}><FoodSearch placeholder={`Find a library match for ${item.name}…`} onPick={choice=>add(choice,index,item)}/></fieldset>}
              </li>
            })}
          </ul>}
          <fieldset disabled={pending}><FoodSearch placeholder={`Add to ${group}`} onPick={food=>add(food,index)}/></fieldset>
        </Card>
      })}
    </div>
  </div>
}
