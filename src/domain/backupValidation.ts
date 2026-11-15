import { z } from 'zod'
const id = z.string().min(1).max(200).refine(s => !s.includes('/'))
const finite = z.number().finite().nonnegative()
const base = z.object({id, updatedAt: finite}).passthrough()
const item = z.object({id, foodId: z.string(), name: z.string(), amount: finite, qty: finite, unit: z.string(), measure: z.string(), measureAmount: finite}).passthrough()
const day = z.object({id, label: z.string(), complete: z.boolean().optional(), meals: z.array(z.object({id, name:z.string(),items:z.array(item)}).passthrough())}).passthrough()
const client = base.extend({firstName:z.string().min(1),dob:z.union([z.iso.date(),z.literal('')]),sex:z.enum(['M','F','']),feeding:z.enum(['breast','formula','mixed','na']),context:z.string(),code:z.string()})
const assessment = base.extend({clientId:id,date:z.iso.date(),title:z.string(),type:z.enum(['diary','usual','typical','ffq']),days:z.array(day).min(1),state:z.enum(['draft','reviewed','finalised']).optional()}).refine(a=>a.state!=='finalised'||!!a.snapshot,'Finalised assessment missing snapshot')
const schema = z.object({app:z.literal('mealtrace'),version:z.literal(1),clients:z.array(client),sessions:z.array(base.extend({clientId:id,date:z.iso.date(),note:z.string()})),assessments:z.array(assessment),foods:z.array(base.extend({name:z.string(),kind:z.enum(['food','formula','supplement','recipe']),per:z.number().positive(),unit:z.string(),values:z.record(z.string(),z.union([finite,z.literal("T"),z.literal("N"),z.null()]))})),settings:base.extend({id:z.literal('settings'),panel:z.array(z.string()),bm:z.object({perFeedYounger:finite,perFeedOlder:finite,olderFromMonths:finite,exclusiveDay:finite,mainMilkDay:finite,density:z.number().positive()}).passthrough(),measures:z.record(z.string(),z.array(z.object({label:z.string(),amount:finite}).passthrough())),favourites:z.array(z.string()),recents:z.array(z.string()),nextClientNo:finite}).passthrough()}).passthrough()
export function validateBackup(input: unknown) {
  const result=schema.parse(input)
  const clients=new Set(result.clients.map(c=>c.id))
  for(const records of [result.clients,result.sessions,result.assessments,result.foods]) if(new Set(records.map(r=>r.id)).size!==records.length) throw new Error('Duplicate record IDs')
  for(const row of [...result.assessments,...result.sessions]) if(!clients.has(row.clientId)) throw new Error('Record references a missing client')
  return result
}
