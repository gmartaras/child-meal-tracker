import { describe,it,expect,beforeAll } from 'vitest'
import { loadCofid } from '../src/domain/foods'
import { computeAssessment } from '../src/domain/calc'
import { statusOf } from '../src/domain/drv'
import { analyse } from '../src/domain/analysis'
import { recipeValues } from '../src/domain/recipes'
import type { Assessment, Day, Item, Client, Settings } from '../src/domain/types'
import { buildInsights } from '../src/domain/insights'
beforeAll(loadCofid)
const food=(energy:number, extra:Partial<Item>={}):Item=>({id:'i',foodId:'u:test',name:'Test food',unit:'g',amount:100,qty:100,measure:'g',measureAmount:1,snap:{kind:'food',per:100,values:{energy}},...extra})
const day=(energy:number,complete=true):Day=>({id:String(energy),label:'Day',complete,meals:[{id:'m',name:'Meal',items:[food(energy)]}]})
describe('record and interpretation regressions',()=>{
 it('excludes partially entered and legacy days',()=>{const r=computeAssessment({days:[day(1000),day(100,false),{...day(200),complete:undefined}]});expect(r.nDays).toBe(1);expect(r.avg.energy.v).toBe(1000)})
 it('allows explicitly completed zero-intake days',()=>{const r=computeAssessment({days:[day(1000),{...day(0),meals:[]}]});expect(r.avg.energy.v).toBe(500)})
 it('does not classify missing iron as deficient',()=>{const r=computeAssessment({days:[day(100)]});expect(statusOf(r.avg.iron,{value:6.9,lrni:3.7,type:'RNI',source:'test'})).toBe('unknown');expect(buildInsights(r,{ageMonths:20,panel:['iron'],targets:{iron:{value:6.9,lrni:3.7,type:'RNI',source:'test'}}}).some(i=>i.severity==='critical')).toBe(false)})
 it('can flag a known subtotal over a maximum, but not confirm below it',()=>{const t={value:2,type:'Max' as const,source:'test'};expect(statusOf({v:3,missing:['unknown']},t)).toBe('above');expect(statusOf({v:1,missing:['unknown']},t)).toBe('unknown')})
 it('separates infant formula from other milk',()=>{const formula=food(60,{unit:'ml',snap:{infantFormula:true,kind:'formula',per:100,values:{energy:60,vitd:1}}}); const milk=food(63,{foodId:'c:12-596',name:'Milk',amount:500,snap:undefined});const r=computeAssessment({days:[{...day(0),meals:[{id:'m',name:'Milk',items:[formula,milk]}]}]});expect(r.formulaMl).toBe(100);expect(buildInsights(r,{ageMonths:8,panel:[],targets:{}}).some(i=>i.title==='No vitamin D supplement recorded')).toBe(true)})
 it('returns finalised results without recalculation using changed client data',()=>{const expected={ageMonths:20,targets:{},result:computeAssessment({days:[day(1000)]}),insights:[]}; const a={state:'finalised',snapshot:{analysis:expected}} as Assessment;expect(analyse(a,{} as Client,{} as Settings)).toBe(expected)})
 it('recipe uses cooked yield and omits unknown nutrients',()=>{const values=recipeValues([food(100)],200);expect(values.energy).toBe(50);expect(values.iron).toBeUndefined();expect(()=>recipeValues([food(100)],0)).toThrow()})
})
