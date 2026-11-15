import { useState } from 'react'
import { todayISO } from '../domain/age'
import type { Client, Feeding, Sex } from '../domain/types'
import { useStore } from '../store/store'
import { Button, Field, Input, Modal, Segmented, Select } from './ui'

export const FEEDING_LABEL: Record<Feeding, string> = {
  breast: 'Breastfed',
  formula: 'Formula-fed',
  mixed: 'Mixed feeding',
  na: 'Not applicable / weaned',
}

export function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (c: Client) => void }) {
  const saveClient = useStore((s) => s.saveClient)
  const [firstName, setFirstName] = useState(client?.firstName ?? '')
  const [dob, setDob] = useState(client?.dob ?? '')
  const [sex, setSex] = useState<Sex>(client?.sex ?? 'F')
  const [feeding, setFeeding] = useState<Feeding>(client?.feeding ?? 'na')
  const [code, setCode] = useState(client?.code ?? '')
  const valid = firstName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dob) && dob <= todayISO()
  return (
    <Modal
      title={client ? 'Edit client' : 'New client'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const c = saveClient({ id: client?.id, firstName: firstName.trim(), dob, sex, feeding, ...(code.trim() ? { code: code.trim() } : {}) })
              onSaved?.(c)
              onClose()
            }}
          >
            {client ? 'Save' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" hint="First name only: no surname or contact details are stored."><Input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" /></Field>
        <Field label="Date of birth" hint="Used to pick age-appropriate reference values."><Input type="date" max={todayISO()} value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
        <div>
          <span className="mb-1 block text-[12px] font-medium text-ink-2">Sex</span>
          <Segmented value={sex} onChange={setSex} options={[{ id: 'F', label: 'Girl' }, { id: 'M', label: 'Boy' }]} />
        </div>
        <Field label="Milk feeding" hint="Sets the energy requirement used under 12 months.">
          <Select value={feeding} onChange={(e) => setFeeding(e.target.value as Feeding)}>
            {(Object.keys(FEEDING_LABEL) as Feeding[]).map((f) => (
              <option key={f} value={f}>{FEEDING_LABEL[f]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Client code" hint={client ? undefined : 'Leave blank to assign the next code automatically.'}><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. C-014" /></Field>
      </div>
    </Modal>
  )
}
