import { describe, it, expect, vi } from 'vitest'
import type { Client } from '../src/domain/types'

// Synthetic records only. A fake backend whose saves take a while to land and whose
// snapshot never refreshes the store, so each queued patch must build on the previous write.
const saved: Client[] = []
vi.mock('../src/store/backend', async (orig) => {
  const real = await orig<typeof import('../src/store/backend')>()
  return {
    ...real,
    createBackend: async () => ({
      mode: 'local',
      onAuth: () => () => {},
      signIn: async () => {},
      signOut: async () => {},
      watch: () => () => {},
      put: async (_coll: string, doc: Client) => { await new Promise((r) => setTimeout(r, 20)); saved.push(doc) },
      saveContext: async () => {},
      remove: async () => {},
    }),
  }
})

const { useStore } = await import('../src/store/store')

describe('patchClient', () => {
  it('keeps every rapid checklist tick when updates are built from the latest copy', async () => {
    const client = { id: 'zz-test', name: 'ZZ Test', updatedAt: 1, checklist: {} } as unknown as Client
    await useStore.getState().init()
    useStore.setState({ clients: [client] })
    const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const results = await Promise.all(labels.map((l) =>
      useStore.getState().patchClient(client.id, (latest) => ({ checklist: { ...(latest.checklist ?? {}), [l]: '2026-11-15' } })),
    ))
    expect(results.every(Boolean)).toBe(true)
    expect(Object.keys(saved.at(-1)!.checklist ?? {}).sort()).toEqual(labels)
    // each save is checked against the previous one, so updatedAt only moves forward
    expect(saved.map((d) => d.updatedAt)).toEqual([...saved.map((d) => d.updatedAt)].sort((x, y) => x - y))
  })
})
