import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('requires a passphrase and downloads an encrypted workspace backup', async ({ page }) => {
  await page.goto('/?demo=1#/settings')
  const download = page.getByRole('button', {name:'Download encrypted backup'})
  await expect(download).toBeDisabled()
  await page.getByLabel('Password for the backup file').fill('short')
  await expect(download).toBeDisabled()
  await page.getByLabel('Password for the backup file').fill('synthetic secure example')
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
  const backup = JSON.parse(await readFile(await file.path(), 'utf8'))
  expect(backup.encrypted).toBe(true)
  expect(backup.data).toBeTruthy()
  expect(backup.clients).toBeUndefined()
})

test('opens the privacy guide from the menu on a phone and records a completed step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?demo=1')
  await page.getByRole('button', {name:'Open menu'}).click()
  await page.getByRole('link', {name:'Privacy & security'}).click()
  await expect(page.getByRole('heading', {name:'Privacy & security'})).toBeVisible()
  await expect(page.getByRole('heading', {name:'Who could see your clients’ records'})).toBeVisible()
  await expect(page.getByText(/Firebase<\/?\w*>? is a Google service|is a Google service that apps use/)).toBeVisible()
  await page.getByLabel(/Turn on 2-step verification/).check()
  await expect(page.getByText('1 of 10 done')).toBeVisible()
  await page.reload()
  await expect(page.getByText('1 of 10 done')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

// Synthetic records only. Runs against the dev-only trial mode (?demo=1), never against cloud data.
test('food entry, completed days, finalising, amendment and family privacy', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([
      { id: 'a', firstName: 'Synthetic Alice', code: 'TEST-A', dob: '2024-01-01', sex: 'F', feeding: 'na', context: 'PRIVATE CONTEXT', createdAt: 1, updatedAt: 1 },
      { id: 'b', firstName: 'Synthetic Bob', code: 'TEST-B', dob: '2024-01-02', sex: 'M', feeding: 'na', context: '', createdAt: 1, updatedAt: 1 },
    ]))
  })
  await page.goto('/?demo=1#/c/a')
  await page.reload()

  // key context is read-only until Edit, and saves through the client-scoped write
  await expect(page.getByText('PRIVATE CONTEXT')).toBeVisible()
  await expect(page.getByPlaceholder(/Allergies, diagnoses/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await page.getByPlaceholder(/Allergies, diagnoses/).fill('PRIVATE CONTEXT updated')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('PRIVATE CONTEXT updated')).toBeVisible()

  // quick successive edits to the same client must all survive
  await page.getByLabel('3-day food history received').check()
  await page.getByLabel('Sensory questionnaire received').check()
  await page.getByRole('tab', { name: /Accepted foods/ }).click()
  await page.getByRole('combobox', {name:'Add to Fruits and vegetables'}).fill('bananas flesh')
  await page.getByRole('option',{name:/Bananas, flesh only/}).first().click()
  await expect(page.getByText(/saved and linked to the library/)).toBeVisible()
  await page.getByText('Nutrients per 100 g',{exact:true}).click()
  await expect(page.getByRole('link',{name:'Open in food library'})).toHaveAttribute('href', /food=c%3A/)
  await expect(page.getByText('81 kcal',{exact:true})).toBeVisible()
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByLabel('3-day food history received')).toBeChecked()
  await expect(page.getByLabel('Sensory questionnaire received')).toBeChecked()
  await expect(page.getByText('PRIVATE CONTEXT updated')).toBeVisible()

  // food history: one screen
  await page.getByRole('button', { name: 'New food history' }).first().click()
  await page.waitForURL(/\/a\//)
  const search = page.getByRole('combobox', { name: 'Add to breakfast…' })
  await search.click()
  await search.fill('12-596')
  await expect(page.getByRole('option', { name: /Milk, whole, pasteurised, average/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('2')
  await page.keyboard.press('Enter')
  await page.getByPlaceholder(/Who reported it/).fill('Private session observations')

  await expect(page.getByRole('button', {name:'Finalise', exact:true})).toBeDisabled()
  // the analysis appears as soon as a food has an amount, flagged while the day is unconfirmed
  await expect(page.getByText('Energy per day')).toBeVisible()
  await expect(page.getByText(/includes unconfirmed days/)).toBeVisible()
  await expect(page.getByText('0 confirmed days', {exact:false})).toBeVisible()
  await page.getByRole('button', {name:'Day 1 only'}).click()
  await expect(page.getByText(/not yet confirmed/)).toBeVisible()
  await page.getByRole('button', {name:'Whole history'}).click()
  await page.getByRole('button', {name:'Confirm day'}).click()
  await expect(page.getByText('Confirmed', {exact:true})).toBeVisible()
  await expect(page.getByText('1 confirmed day', {exact:false})).toBeVisible()
  await expect(page.getByText('Energy per day')).toBeVisible()
  await expect(page.getByRole('button', {name:'Finalise', exact:true})).toBeDisabled()
  await expect(page.getByText(/Confirm or exclude Day 2, Day 3/)).toBeVisible()
  for (const label of ['Day 2', 'Day 3']) {
    await page.getByRole('navigation', {name:'Diary days'}).getByRole('button',{name:new RegExp('^'+label)}).click()
    await page.getByRole('button', {name:'Exclude', exact:true}).click()
    await expect(page.getByText('Excluded',{exact:true})).toBeVisible()
  }
  await page.getByRole('navigation', {name:'Diary days'}).getByRole('button',{name:/^Day 1/}).click()
  // every meal is on screen at once
  await expect(page.getByRole('combobox',{name:'Add to lunch…'})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'Add to breakfast…'})).toBeVisible()
  await page.getByLabel(/Quantity of Milk/).fill('1')
  await expect(page.getByText('Not confirmed',{exact:true})).toBeVisible()
  await page.getByRole('button', {name:'Confirm day'}).click()
  await page.getByLabel('Agreed actions and follow-up (shared with parents)').fill('Agreed synthetic action')
  await expect(page.getByText('Draft saved', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalise', exact:true })).toBeEnabled()
  await page.getByRole('button', { name: 'Preview parent summary' }).click()
  await expect(page.getByText('Draft preview', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PDF for Drive' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to assessment' }).click()

  // finalise: read only, reports unlocked, amendment is a new draft
  await page.getByRole('button', { name: 'Finalise', exact:true }).click()
  await expect(page.getByText('Finalised: read only')).toBeVisible()
  await expect(page.getByLabel(/Quantity of Milk/)).toBeDisabled()
  const finalUrl = page.url()
  await page.getByRole('button', { name: 'Parent summary' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF for Drive' }).click()])
  expect(download.suggestedFilename()).toMatch(/^TEST-A-\d{4}-\d{2}-\d{2}-parent-.+\.pdf$/)
  await page.goto(finalUrl)
  await page.getByRole('button', { name: 'Create amendment' }).click()
  await expect(page.getByText('Amendment draft')).toBeVisible()
  await expect(page.getByLabel(/Quantity of Milk/)).toBeEnabled()

  // family view shows only the agreed actions
  const id = finalUrl.split('/').pop()
  await page.goto(`/?demo=1#/c/a/family/${id}`)
  await expect(page.getByRole('heading', { name: 'Synthetic Alice’s feeding plan' })).toBeVisible()
  await expect(page.getByText('Agreed synthetic action')).toBeVisible()
  await expect(page.getByText('PRIVATE CONTEXT')).toHaveCount(0)
  await expect(page.getByText('Synthetic Bob')).toHaveCount(0)
  await expect(page.getByText('Private session observations')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('food library: edit and revert a CoFID food, make a version, build a recipe', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.goto('/?demo=1#/foods')
  await page.getByLabel('Search the food library').fill('bananas flesh')
  await page.getByRole('button', { name: /^Bananas, flesh only/ }).first().click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Iron per 100 g').fill('0.9')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Edited by you')).toBeVisible()
  await page.getByRole('button', { name: 'Revert to original' }).click()
  await expect(page.getByText('Edited by you')).toHaveCount(0)

  await page.getByRole('button', { name: 'Make a version' }).click()
  await page.locator('[role=dialog] select').nth(1).selectOption({ label: 'medium banana (100 g)' })
  await page.getByRole('button', { name: 'Work out this portion' }).click()
  await expect(page.getByLabel(/^Energy per/)).toHaveValue('40.5')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Half a medium banana/ })).toBeVisible()

  await page.getByRole('button', { name: 'New recipe' }).click()
  await page.getByLabel('Recipe name').fill('Synthetic milk pudding')
  const add = page.getByPlaceholder('Add an ingredient…')
  await add.click()
  await add.fill('12-596')
  await page.keyboard.press('Enter')
  await page.keyboard.type('200')
  await page.getByLabel('Number of portions').fill('2')
  await expect(page.locator('[role=dialog] table')).toContainText('63') // kcal per 100 g and per 100 g portion
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic milk pudding' })).toBeVisible()
  expect(errors).toEqual([])
})

test('retains client handouts, prior actions, diary dates and reusable meals', async ({ page }) => {
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{
      id: 'a', firstName: 'Synthetic Alice', code: 'TEST-A', dob: '2024-01-01',
      sex: 'F', feeding: 'na', context: '', createdAt: 1, updatedAt: 1,
      goals: [{ id: 'goal1', text: 'Discuss snacks at follow-up', due: '', done: false, outcome: '' }],
      resources: [{ id: 's1', title: 'Synthetic handout', category: 'Other handout',
        url: 'https://docs.google.com/document/d/synthetic-handout/edit', text: 'Sample imported handout text.' }],
    }]))
    localStorage.setItem('mealtrace:meta', JSON.stringify([{
      id: 'settings', savedMeals: [{ id: 'meal1', name: 'Test breakfast', items: [{
        id: 'milk', foodId: 'c:12-596', name: 'Whole milk', unit: 'g',
        amount: 100, qty: 100, measure: 'g', measureAmount: 1,
      }] }],
    }]))
  })
  await page.goto('/?demo=1#/c/a')
  await page.reload()
  await page.getByText(/^Files and handouts/).click()
  await page.getByText('Read in Mealtrace', { exact: true }).click()
  await expect(page.getByText('Sample imported handout text.')).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Synthetic food diary')
  await page.getByLabel('Google Drive link').fill('https://drive.google.com/file/d/synthetic-example/view')
  await page.getByRole('button', {name: 'Add link'}).click()
  await expect(page.getByRole('link', {name: 'Synthetic food diary'})).toBeVisible()
  await page.getByRole('button', {name: 'New food history', exact: true}).first().click()
  await page.getByLabel('Diary date').fill('2026-11-14')
  await page.getByLabel('Insert a reusable meal into Breakfast').selectOption('meal1')
  await expect(page.getByLabel(/Quantity of Whole milk/)).toBeVisible()
  await expect(page.getByText('Draft saved', {exact: true})).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Diary date')).toHaveValue('2026-11-14')
  await expect(page.getByLabel(/Quantity of Whole milk/)).toBeVisible()
})

test('links a legacy accepted food and logs it from the horizontal meal navigator on a phone', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{
      id:'a', firstName:'Synthetic Alice', code:'TEST-A', dob:'2024-01-01', sex:'F', feeding:'na',
      context:'', createdAt:1, updatedAt:1,
      acceptedFoods:[{id:'old', name:'Banana pieces', group:1, addedOn:'2026-11-14'}],
    }]))
  })
  await page.goto('/?demo=1#/c/a?tab=accepted')
  await page.reload()
  await page.getByRole('button',{name:'Link to library'}).click()
  await page.getByRole('combobox',{name:'Find a library match for Banana pieces…'}).fill('bananas flesh')
  await page.getByRole('option',{name:/Bananas, flesh only/}).first().click()
  await expect(page.getByText('Banana pieces',{exact:true})).toBeVisible()
  await expect(page.getByText('1 accepted · 1 linked')).toBeVisible()

  await page.getByRole('button',{name:'New food history',exact:true}).first().click()
  await page.getByLabel('Add an accepted food to Lunch').selectOption({label:'Banana pieces'})
  await expect(page.getByLabel(/Quantity of Bananas, flesh only/)).toBeVisible()
  await page.getByRole('button',{name:'Confirm day'}).click()
  await expect(page.getByText('Confirmed',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByText('Confirmed',{exact:true})).toBeVisible()
  await page.getByRole('tab',{name:'Nutrition'}).click()
  await expect(page.getByText('Energy per day')).toBeVisible()
  await expect(page.getByText(/Confirm or exclude Day 2, Day 3/)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('uses a branded label portion in a diary and retains the consulted source', async ({ page }) => {
  await page.goto('/?demo=1#/foods')
  await page.getByRole('button',{name:/UK branded foods/}).click()
  await page.getByLabel('Search the food library').fill('weetabix original')
  await page.getByRole('button',{name:/Weetabix Original/}).first().click()
  await expect(page.getByRole('link',{name:'View manufacturer label'})).toHaveAttribute('href',/weetabix\.co\.uk/)
  await expect(page.getByText('Folic acid (label)')).toBeVisible()
  await expect(page.getByText('one biscuit',{exact:true})).toBeVisible()
  await page.getByLabel('Search the food library').fill('mccain potato smiles')
  await page.getByRole('button',{name:/McCain Potato Smiles/}).click()
  await expect(page.getByText(/UK label · oven baked/)).toBeVisible()
  await expect(page.getByText('three pieces',{exact:true})).toBeVisible()
  await page.getByLabel('Search the food library').fill('alpro original oat drink')
  await page.getByRole('button',{name:/Alpro Original Oat Drink/}).click()
  await expect(page.getByText('Nutrients per 100 ml',{exact:true})).toBeVisible()

  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{id:'a', firstName:'Synthetic Alice', code:'BRAND-TEST',
      dob:'2024-01-01', sex:'F', feeding:'na', context:'', createdAt:1, updatedAt:1}]))
  })
  await page.goto('/?demo=1#/c/a')
  await page.reload()
  await page.getByRole('button',{name:'New food history',exact:true}).first().click()
  await page.getByRole('combobox',{name:'Add to breakfast…'}).fill('weetabix original')
  await page.getByRole('option',{name:/Weetabix Original/}).click()
  await expect(page.getByLabel('Quantity of Weetabix Original')).toHaveValue('1')
  await page.getByRole('button',{name:'Confirm day'}).click()
  await expect(page.getByText('Confirmed',{exact:true})).toBeVisible()
  const foods = await page.evaluate(() => JSON.parse(localStorage.getItem('mealtrace:assessments')!)[0].days[0].meals[0].items)
  expect(foods[0].amount).toBe(18.75)
  expect(foods[0].snap.labelSource.version).toBe('uk-branded-2026-11-15.1')
  expect(foods[0].snap.values.energy).toBe(362)
})

test('keeps an incomplete client profile usable for a draft and blocks finalising', async ({ page }) => {
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{id:'pending', firstName:'Synthetic draft',
      code:'PENDING', dob:'', sex:'', feeding:'na', context:'', createdAt:1, updatedAt:1}]))
  })
  await page.goto('/?demo=1#/c/pending')
  await page.reload()
  await expect(page.getByText('Age unknown', {exact:false}).first()).toBeVisible()
  await page.getByRole('button',{name:'New food history',exact:true}).first().click()
  await expect(page.getByRole('button',{name:'Finalise',exact:true})).toBeDisabled()
  await expect(page.getByText('Add the date of birth and sex in the client record before finalising.')).toBeVisible()
})

test('deletes a client and their finalised history after confirmation', async ({ page }) => {
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{id:'erase', firstName:'TEST-ID', code:'TEST-ID',
      dob:'', sex:'', feeding:'na', context:'', createdAt:1, updatedAt:1}]))
    localStorage.setItem('mealtrace:assessments', JSON.stringify([{id:'history', clientId:'erase', title:'Sample history',
      state:'finalised', type:'diary', date:'2026-11-15', days:[], updatedAt:1, createdAt:1}]))
    localStorage.setItem('mealtrace:sessions', JSON.stringify([{id:'session', clientId:'erase', date:'2026-11-15',
      note:'Synthetic note', updatedAt:1, createdAt:1}]))
  })
  await page.goto('/?demo=1#/c/erase')
  await page.reload()
  await page.getByRole('button',{name:'More actions'}).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByText('Delete client and all data',{exact:true}).click()
  await expect(page).toHaveURL(/#?\/$/)
  const counts = await page.evaluate(() => ['clients','assessments','sessions'].map(c =>
    JSON.parse(localStorage.getItem('mealtrace:'+c) ?? '[]').length))
  expect(counts).toEqual([0,0,0])
})

test('shows nutrition on the overview and plans foods in the nutrient explorer', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    const milk = { id: 'i1', foodId: 'c:12-596', name: 'Milk, whole, pasteurised, average', unit: 'ml', qty: 300, measure: 'ml', measureAmount: 1, amount: 300 }
    localStorage.setItem('mealtrace:clients', JSON.stringify([{ id: 'x', firstName: 'TEST-X', code: 'TEST-X', dob: '2022-01-01', sex: 'F', feeding: 'na', context: '', createdAt: 1, updatedAt: 1 }]))
    localStorage.setItem('mealtrace:assessments', JSON.stringify([{ id: 'h', clientId: 'x', title: 'Synthetic history', type: 'diary', date: '2026-11-01', createdAt: 1, updatedAt: 1,
      days: [{ id: 'd', label: 'Day 1', meals: [{ id: 'm', name: 'Breakfast', items: [milk] }] }] }]))
  })
  await page.goto('/?demo=1#/c/x')
  await page.reload()
  // overview: charts from the latest history, provisional because no day is confirmed
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible()
  await expect(page.getByText(/includes unconfirmed days/).first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Intake as a share of the daily target' })).toBeVisible()
  // selecting a nutrient opens the explorer focused on it
  await page.getByRole('list', { name: 'Intake as a share of the daily target' }).getByRole('button', { name: /^Iron/ }).click()
  await expect(page.getByRole('heading', { name: 'Boost Iron' })).toBeVisible()
  await expect(page.getByLabel('Start from')).toHaveValue('h')
  await page.getByRole('button', { name: 'Try', exact: true }).first().click()
  await expect(page.getByText('Added by foods you are trying')).toBeVisible()
  await expect(page.getByText(/→/).first()).toBeVisible()
  // the explorer remembers the plan
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Try adding' })).toBeVisible()
  await expect(page.getByLabel(/^Amount of /)).toHaveCount(1)
  // home lists the gaps per client
  await page.goto('/?demo=1#/')
  await expect(page.getByText(/^Iron .*%$/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('removes notes and names from all clients, keeping analysis data', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{ id: 'n', firstName: 'Synthetic Name', code: 'TEST-N', dob: '2022-01-01', sex: 'M', feeding: 'na', context: 'SYNTHETIC CONTEXT', folderUrl: 'https://drive.google.com/drive/folders/synthetic', createdAt: 1, updatedAt: 1 }]))
    localStorage.setItem('mealtrace:sessions', JSON.stringify([{ id: 's', clientId: 'n', date: '2026-11-01', note: 'SYNTHETIC NOTE', sections: { concerns: 'SYNTHETIC CONCERN' }, weightKg: 14, createdAt: 1, updatedAt: 1 }]))
  })
  await page.goto('/?demo=1#/privacy')
  await page.reload()
  await page.getByRole('button', { name: 'Remove notes and names from all clients' }).click()
  await expect(page.getByText(/Done: 1 client record, 1 session note/)).toBeVisible()
  const [clients, sessions] = await page.evaluate(() => ['clients', 'sessions'].map((c) => JSON.parse(localStorage.getItem('mealtrace:' + c)!)))
  expect(clients[0]).toMatchObject({ firstName: 'TEST-N', context: '', dob: '2022-01-01' })
  expect(clients[0].folderUrl).toBeUndefined()
  expect(sessions[0]).toMatchObject({ note: '', sections: {}, weightKg: 14 })
})

test('in a food diary, switching between household measures keeps the count the family reported', async ({ page }) => {
  await page.goto('/?demo=1')
  await page.evaluate(() => {
    localStorage.setItem('mealtrace:clients', JSON.stringify([{ id: 'm', firstName: 'TEST-M', code: 'TEST-M', dob: '2022-01-01', sex: 'F', feeding: 'na', context: '', createdAt: 1, updatedAt: 1 }]))
  })
  await page.goto('/?demo=1#/c/m')
  await page.reload()
  await page.getByRole('button', { name: 'New food history', exact: true }).first().click()
  await page.getByRole('combobox', { name: 'Add to breakfast…' }).fill('bread white average')
  await page.getByRole('option', { name: /^Bread, white, average/ }).first().click()
  const qty = page.getByLabel('Quantity of Bread, white, average')
  await expect(qty).toHaveValue('1')
  const measure = page.getByRole('combobox', { name: 'Measure' }).first()
  await measure.selectOption({ label: 'thick slice (44 g)' })
  await expect(qty).toHaveValue('1')
  await expect(page.getByText(/44 g · /).first()).toBeVisible()
  // to grams, the weight is kept
  await measure.selectOption('g')
  await expect(qty).toHaveValue('44')
})

test('collapses the sidebar to an icon rail and remembers it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?demo=1#/explorer')
  const aside = page.locator('aside').first()
  expect((await aside.boundingBox())!.width).toBeGreaterThan(200)
  await page.getByRole('button', { name: 'Full width' }).click()
  expect((await aside.boundingBox())!.width).toBeLessThan(70)
  await expect(page.getByRole('link', { name: 'Nutrient Explorer', exact: true })).toBeVisible()
  await page.reload()
  expect((await aside.boundingBox())!.width).toBeLessThan(70)
  // rail links still navigate, and the shortcut expands it again
  await page.getByRole('link', { name: 'Food library', exact: true }).click()
  await expect(page).toHaveURL(/#\/foods/)
  await page.keyboard.press('Control+\\')
  expect((await aside.boundingBox())!.width).toBeGreaterThan(200)
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  expect((await aside.boundingBox())!.width).toBeLessThan(70)
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  expect((await aside.boundingBox())!.width).toBeGreaterThan(200)
})
