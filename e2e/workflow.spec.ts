import { test, expect } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Food history' }).first().click()
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
  await page.getByRole('button', {name:'Analyse day'}).click()
  await expect(page.getByRole('heading', {name:'Recorded intake for Day 1'})).toBeVisible()
  await expect(page.getByText('0 confirmed days', {exact:false})).toBeVisible()
  await page.getByRole('button', {name:'Confirm and save day'}).click()
  await expect(page.getByText('Confirmed in client record')).toBeVisible()
  await expect(page.getByText('1 confirmed day', {exact:false})).toBeVisible()
  await expect(page.getByText('Energy per day')).toBeVisible()
  await expect(page.getByRole('button', {name:'Finalise', exact:true})).toBeDisabled()
  await expect(page.getByText(/Confirm or exclude Day 2, Day 3/)).toBeVisible()
  for (const label of ['Day 2', 'Day 3']) {
    await page.getByRole('navigation', {name:'Diary days'}).getByRole('button',{name:new RegExp('^'+label)}).click()
    await page.getByRole('button', {name:'Exclude day'}).click()
    await expect(page.getByText('Excluded from analysis',{exact:true})).toBeVisible()
  }
  await page.getByRole('navigation', {name:'Diary days'}).getByRole('button',{name:/^Day 1/}).click()
  await page.getByRole('navigation',{name:'Meals in order'}).getByRole('button',{name:'Lunch'}).click()
  await expect(page.getByRole('combobox',{name:'Add to lunch…'})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'Add to breakfast…'})).toHaveCount(0)
  await page.getByRole('navigation',{name:'Meals in order'}).getByRole('button',{name:/Breakfast/}).click()
  await page.getByLabel(/Quantity of Milk/).fill('1')
  await expect(page.getByText('Draft day',{exact:true})).toBeVisible()
  await page.getByRole('button', {name:'Confirm and save day'}).click()
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
  await page.getByText('Previously recorded actions', { exact: true }).click()
  await expect(page.getByText('Discuss snacks at follow-up')).toBeVisible()
  await page.getByText('Files and handouts', { exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Synthetic food diary')
  await page.getByLabel('Google Drive link').fill('https://drive.google.com/file/d/synthetic-example/view')
  await page.getByRole('button', {name: 'Add link'}).click()
  await expect(page.getByRole('link', {name: 'Synthetic food diary'})).toBeVisible()
  await page.getByRole('button', {name: 'Food history', exact: true}).first().click()
  await page.getByLabel('Diary date (optional)').fill('2026-11-14')
  await page.getByText('Reusable meals', {exact: true}).click()
  await page.getByLabel('Insert saved meal').selectOption('meal1')
  await expect(page.getByLabel(/Quantity of Whole milk/)).toBeVisible()
  await expect(page.getByText('Draft saved', {exact: true})).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Diary date (optional)')).toHaveValue('2026-11-14')
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

  await page.getByRole('button',{name:'Food history',exact:true}).first().click()
  await page.getByRole('navigation',{name:'Meals in order'}).getByRole('button',{name:'Lunch'}).click()
  await page.getByLabel('Add an accepted food to Lunch').selectOption({label:'Banana pieces'})
  await expect(page.getByLabel(/Quantity of Bananas, flesh only/)).toBeVisible()
  await page.getByRole('button',{name:'Analyse day'}).click()
  await expect(page.getByRole('heading',{name:'Recorded intake for Day 1'})).toBeVisible()
  await page.getByRole('button',{name:'Confirm and save day'}).click()
  await expect(page.getByText('Confirmed in client record')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Confirmed in client record')).toBeVisible()
  await page.getByRole('tab',{name:'Review & finalise'}).click()
  await expect(page.getByText(/Confirm or exclude Day 2, Day 3/)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
