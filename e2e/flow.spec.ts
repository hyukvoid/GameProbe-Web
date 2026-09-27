import { expect, test, type Page } from '@playwright/test'

// One ordered flow against an empty database: submit a direct test, confirm it stays
// hidden until approved, then publish an external report and check the two stay separate.
test.describe.configure({ mode: 'serial' })

async function signIn(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Password').fill('e2e-admin-password-0123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
}

test('empty database shows honest empty states, not filler', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'GameProbe' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wuthering Waves' })).toBeVisible()
  await expect(page.getByText('No verified tests yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Submit a test' }).first()).toBeVisible()
  await expect(page.getByText('No issues reported yet.')).toBeVisible()
})

test('validation errors are shown and submitted values are kept', async ({ page }) => {
  await page.goto('/submit')
  await page.getByLabel('Game', { exact: true }).selectOption({ label: 'Wuthering Waves' })
  await page.getByLabel('Game version (optional)').fill('latest')
  await page.getByRole('button', { name: 'Submit test' }).last().click()
  const summary = page.locator('.error-summary')
  await expect(summary).toContainText('The test was not submitted')
  await expect(summary).toContainText('Choose a controller')
  await expect(summary).toContainText('Mark at least one control')
  await expect(page.getByLabel('Game version (optional)')).toHaveValue('latest')
  await expect(page.getByLabel('Game version (optional)')).toHaveAttribute('aria-invalid', 'true')
})

test('a submitted test stays private until an admin approves it', async ({ page }) => {
  await page.goto('/submit?game=wuthering-waves&controller=8bitdo-ultimate-2')
  await expect(page.getByLabel('Game', { exact: true })).toHaveValue('wuthering-waves')
  await page.getByLabel('Controller', { exact: true }).selectOption({ label: '8BitDo Ultimate 2 Wireless Controller' })
  await page.getByLabel('Bluetooth').check()
  await page.getByLabel('Game version (optional)').fill('2.8.1')
  await page.getByLabel('L2/R2: Broken').check()
  await page.getByLabel('Menu navigation: Works').check()
  await page.getByLabel('Notes (optional)').fill('E2E: RT does nothing in combat.')
  await page.getByRole('button', { name: 'Submit test' }).last().click()
  await expect(page.getByRole('status')).toContainText('Test received')

  await page.goto('/games/wuthering-waves')
  await expect(page.getByText('E2E: RT does nothing in combat.')).toHaveCount(0)

  await signIn(page)
  await page.goto('/admin/tests')
  await expect(page.getByText('E2E: RT does nothing in combat.')).toBeVisible()
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('No pending tests.')).toBeVisible()

  await page.goto('/games/wuthering-waves/8bitdo-ultimate-2')
  await expect(page.getByText('E2E: RT does nothing in combat.')).toBeVisible()

  // The Bluetooth test answers Bluetooth only.
  const connections = page.getByRole('region', { name: 'Connection compatibility' })
  await expect(connections.locator('[data-connection="bluetooth"]')).toContainText('Problem reported in direct tests')
  await expect(connections.locator('[data-connection="usb"]')).toContainText('No controller-specific evidence')
  await expect(connections.locator('[data-connection="dongle"]')).toContainText('No controller-specific evidence')

  const row = page.getByRole('row', { name: /L2\/R2.*Bluetooth/ })
  await expect(row).toContainText('Broken')
  await expect(row).toContainText('1 direct test: broken')
  await expect(page.getByRole('row', { name: /L2\/R2/ })).toHaveCount(1)
  await expect(page.getByText('Mode').first()).toBeVisible()
})

test('an external report is published only after review and is labelled as external', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/evidence')
  await page.getByLabel('URL').fill('https://forum.example.org/t/wuwa-rt-e2e')
  await page.getByRole('button', { name: 'Add to inbox' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Untitled source')

  // A question can't be published.
  await page.getByLabel('No, it’s a question or general discussion').check()
  await page.getByRole('button', { name: 'Publish limited external claim' }).click()
  await expect(page.locator('.error-summary')).toContainText('Questions are not evidence')

  await page.getByLabel('Yes, someone describes what happened when they played').check()
  await page.getByLabel('Game', { exact: true }).selectOption({ label: 'Wuthering Waves' })
  await page.getByLabel('Controller in catalog').selectOption({ label: '8BitDo Ultimate 2, model not specified' })
  await page.getByLabel('Controller, as written in the source').fill('8bitdo ultimate 2')
  await page.getByLabel('L2/R2: Works').check()
  await page.getByLabel('Reviewed claim (public)').fill('E2E: triggers work for this poster.')
  await page.getByRole('button', { name: 'Publish limited external claim' }).click()
  await expect(page.getByRole('status')).toContainText('Published as a limited external claim')

  // Same page added again is caught.
  await page.goto('/admin/evidence')
  await page.getByLabel('URL').fill('https://forum.example.org/t/wuwa-rt-e2e/?utm_source=x')
  await page.getByRole('button', { name: 'Add to inbox' }).click()
  await expect(page.getByText('This URL is already in the inbox.')).toBeVisible()

  await page.goto('/games/wuthering-waves/8bitdo-ultimate-2')
  // The direct test was over Bluetooth; the external report states no connection. They are
  // shown on separate rows and never set against each other or averaged.
  const bluetoothRow = page.getByRole('row', { name: /L2\/R2.*Bluetooth/ })
  await expect(bluetoothRow).toContainText('Broken')
  await expect(bluetoothRow).toContainText('1 direct test: broken')
  await expect(bluetoothRow).toContainText('No external reports')
  const unstatedRow = page.getByRole('row', { name: /L2\/R2.*Connection not stated/ })
  await expect(unstatedRow).toContainText('Reported working')
  await expect(unstatedRow).toContainText('1 external report: works')

  const connections = page.getByRole('region', { name: 'Connection compatibility' })
  const bluetooth = connections.locator('[data-connection="bluetooth"]')
  await expect(bluetooth).toContainText('Problem reported in direct tests')
  await expect(bluetooth).not.toContainText('E2E: triggers work for this poster.')
  await expect(connections.locator('[data-connection="not-stated"]')).toContainText('E2E: triggers work for this poster.')

  const external = page.getByRole('region', { name: 'External reports' })
  await expect(external.getByText('E2E: triggers work for this poster.')).toBeVisible()
  await expect(external.getByText('“8bitdo ultimate 2”')).toBeVisible()
})

test('admin pages require sign-in', async ({ page }) => {
  for (const path of ['/admin', '/admin/tests', '/admin/evidence']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/admin\/login$/)
  }
})

test('search finds games, controllers and combinations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('searchbox').fill('dualsense genshin')
  await page.getByRole('searchbox').press('Enter')
  await expect(page.getByRole('link', { name: 'DualSense in Genshin Impact' })).toBeVisible()
  await page.goto('/search?q=wuwa')
  await expect(page.getByRole('link', { name: 'Wuthering Waves' }).last()).toBeVisible()
})

test('keyboard users can reach search and the submit form', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'GameProbe' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('searchbox')).toBeFocused()
})
