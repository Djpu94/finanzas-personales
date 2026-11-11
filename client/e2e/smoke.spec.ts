import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'contraseña-e2e-123';

async function registerAndLogin(page: Page): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const response = await page.request.post('/api/auth/register', {
    data: { email, password: PASSWORD, name: 'Usuario E2E' },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('login lleva al dashboard con landmarks y un único h1', async ({ page }) => {
  await registerAndLogin(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toHaveCount(1);
  await expect(page.locator('header.layout-header')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  await expect(page.locator('main#contenido')).toBeVisible();
});

test('la navegación del sidenav cambia de pantalla por enlace', async ({ page }) => {
  await registerAndLogin(page);

  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Transacciones' })
    .click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Transacciones' })).toBeVisible();
});

test('sin overflow horizontal en móvil (360px) en las pantallas principales', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await registerAndLogin(page);

  for (const path of ['/dashboard', '/transactions', '/accounts', '/budgets']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, `overflow horizontal en ${path}`).toBe(false);
  }
});
