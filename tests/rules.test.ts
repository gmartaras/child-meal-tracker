import { beforeAll, afterAll, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc,setDoc,getDoc,deleteDoc,writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { decodeClientPlan, encodeClientPlan } from '../src/store/clientPlanStorage'
let env: RulesTestEnvironment
const run = process.env.FIRESTORE_EMULATOR_HOST ? it : it.skip
beforeAll(async()=>{if(process.env.FIRESTORE_EMULATOR_HOST) env=await initializeTestEnvironment({projectId:'demo-mealtrace',firestore:{rules:readFileSync('firestore.rules','utf8')}})})
afterAll(async()=>{await env?.cleanup()})
run('restricts accounts, namespaces and finalised mutations',async()=>{
 const owner=env.authenticatedContext('dietitian',{email:'practitioner@example.invalid',email_verified:true}).firestore()
 const admin=env.authenticatedContext('developer',{email:'developer@example.invalid',email_verified:true}).firestore()
 const other=env.authenticatedContext('other',{email:'other@example.com',email_verified:true}).firestore()
 const unverified=env.authenticatedContext('dietitian',{email:'practitioner@example.invalid',email_verified:false}).firestore()
 const path='users/dietitian/assessments/a'
 await assertSucceeds(setDoc(doc(owner,path),{id:'a',state:'draft',updatedAt:1}))
 await assertFails(getDoc(doc(admin,path)))
 await assertFails(getDoc(doc(other,path)))
 await assertFails(getDoc(doc(unverified,path)))
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),path)))
 await assertSucceeds(setDoc(doc(owner,path),{id:'a',state:'finalised',updatedAt:2}))
 await assertFails(setDoc(doc(owner,path),{id:'a',state:'draft'}))
 await assertFails(deleteDoc(doc(owner,path)))
 await assertSucceeds(setDoc(doc(admin,'users/developer/clients/test'),{id:'test'}))
 await assertFails(setDoc(doc(owner,'users/dietitian/unknown/test'),{id:'test'}))
 await assertFails(setDoc(doc(owner,'users/dietitian/clients/test/subcollection/record'),{id:'record'}))
 await assertFails(setDoc(doc(owner,'users/dietitian/clients/test'),{id:'different'}))
})

run('permits finalised history deletion only with its own client in the same commit', async () => {
  const db = env.authenticatedContext('dietitian', {email:'practitioner@example.invalid', email_verified:true}).firestore()
  const client = doc(db, 'users/dietitian/clients/erase')
  const history = doc(db, 'users/dietitian/assessments/erase')
  const session = doc(db, 'users/dietitian/sessions/erase')
  const unrelated = doc(db, 'users/dietitian/clients/keep')
  await setDoc(client, {id:client.id})
  await setDoc(unrelated, {id:unrelated.id})
  await setDoc(history, {id:history.id,clientId:client.id,state:'finalised'})
  await setDoc(session, {id:session.id,clientId:client.id})
  await assertFails(deleteDoc(history))
  await assertFails(writeBatch(db).delete(unrelated).delete(history).commit())
  await assertSucceeds(writeBatch(db).delete(client).delete(history).delete(session).commit())
  for (const ref of [client, history, session]) expect((await getDoc(ref)).exists()).toBe(false)
  expect((await getDoc(unrelated)).exists()).toBe(true)
})

run('round-trips the sample meal plan through Firestore', async () => {
  const db = env.authenticatedContext('dietitian', {email:'practitioner@example.invalid', email_verified:true}).firestore()
  const client = doc(db, 'users/dietitian/clients/meal-plan')
  const plan = {
    intro: 'Example for the family',
    cells: [['Toast\n+ Berries', ''], ['', 'Fruit']],
    chains: [{ id:'chain', from:'Toast', to:'Crumpet' }],
    updatedAt: 1,
  }
  await assertSucceeds(setDoc(client, { id: client.id, plan: encodeClientPlan(plan) }))
  const saved = (await getDoc(client)).data()!
  expect(decodeClientPlan(saved.plan)).toEqual(plan)
  expect(decodeClientPlan(plan)).toEqual(plan)
  const assessment = doc(db, 'users/dietitian/assessments/meal-plan-snapshot')
  await assertSucceeds(setDoc(assessment, {
    id: assessment.id, state: 'finalised', snapshot: {client: {id: client.id, plan: saved.plan}},
  }))
  const frozen = (await getDoc(assessment)).data()!
  expect(decodeClientPlan(frozen.snapshot.client.plan)).toEqual(plan)
})
