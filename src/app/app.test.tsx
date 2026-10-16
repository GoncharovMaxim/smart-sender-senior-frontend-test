import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb, MOCK_CREDENTIALS, type MockDb } from '../mocks/db';
import { createHandlers } from '../mocks/handlers';

// Node's fetch needs absolute URLs; jsdom's origin is http://localhost:3000.
vi.mock('../config', () => ({ API_BASE_URL: 'http://localhost:3000/api', WEBHOOKS_PAGE_SIZE: 10 }));
const BASE_URL = 'http://localhost:3000/api';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

type User = ReturnType<typeof userEvent.setup>;

/** Simulates a full page load: fresh modules (singletons, router), fresh mock DB, given URL. */
async function startApp(url: string): Promise<{ db: MockDb; user: User }> {
  cleanup();
  vi.resetModules();
  window.history.replaceState(null, '', url);

  const db = createDb();
  server.resetHandlers(...createHandlers({ baseUrl: BASE_URL, db }));

  const { App } = await import('./App');
  const { restoreSession } = await import('../auth/session');
  void restoreSession();
  render(<App />);

  return { db, user: userEvent.setup() };
}

async function logIn(user: User, password: string = MOCK_CREDENTIALS.password) {
  const email = await screen.findByLabelText('Email');
  await user.clear(email);
  await user.type(email, MOCK_CREDENTIALS.email);
  await user.clear(screen.getByLabelText('Пароль'));
  await user.type(screen.getByLabelText('Пароль'), password);
  await user.click(screen.getByRole('button', { name: 'Увійти' }));
}

const currentUrl = () => window.location.pathname + window.location.search;

async function rowNames(): Promise<string[]> {
  const table = await screen.findByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('link').textContent ?? '');
}

async function expectRows(count: number) {
  await waitFor(async () => expect(await rowNames()).toHaveLength(count));
}

describe('app', () => {
  it('logs in: server field error, then the list; device token is never persisted', async () => {
    const { user } = await startApp('/webhooks');

    await screen.findByRole('heading', { name: 'Вхід' });
    expect(screen.queryByText('Сесія завершилась. Увійдіть знову.')).toBeNull();

    await logIn(user, 'wrong-password');
    expect(await screen.findByText('The provided password is incorrect.')).toBeTruthy();
    expect(screen.getByLabelText('Пароль').getAttribute('aria-invalid')).toBe('true');

    await logIn(user);
    await expectRows(10);
    expect(currentUrl()).toBe('/webhooks');
    expect(screen.getByText('Admin Admin')).toBeTruthy();

    expect(Object.keys(localStorage)).toEqual(['device_fingerprint']);
    expect(localStorage.getItem('device_fingerprint')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('keeps page and search in the URL: deep link after reload, search resets page, back/forward', async () => {
    const { user } = await startApp('/webhooks?page=3');

    await logIn(user);
    await expectRows(7); // 27 webhooks → 10 + 10 + 7
    expect(currentUrl()).toBe('/webhooks?page=3');

    await user.click(screen.getByRole('button', { name: /Назад/ }));
    await waitFor(() => expect(currentUrl()).toBe('/webhooks?page=2'));
    await expectRows(10);

    await user.type(screen.getByLabelText('Пошук за назвою'), 'PAID');
    await waitFor(() => expect(currentUrl()).toBe('/webhooks?search=PAID'));
    await waitFor(async () => expect(await rowNames()).toEqual([
      'Order paid · Production',
      'Order paid · Staging',
      'Order paid · Sandbox',
    ]));

    act(() => window.history.back());
    await waitFor(() => expect(currentUrl()).toBe('/webhooks?page=2'));
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Пошук за назвою').value).toBe(''));
    await expectRows(10);

    act(() => window.history.forward());
    await waitFor(() => expect(currentUrl()).toBe('/webhooks?search=PAID'));
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Пошук за назвою').value).toBe('PAID'));
    await expectRows(3);
  });

  it('shows empty and out-of-range states', async () => {
    const { user } = await startApp('/webhooks?search=zzz');
    await logIn(user);
    expect(await screen.findByText('За запитом «zzz» нічого не знайдено.')).toBeTruthy();

    const app = await startApp('/webhooks?page=99');
    await logIn(app.user);
    expect(await screen.findByText('Сторінки 99 не існує.')).toBeTruthy();
    await app.user.click(screen.getByRole('button', { name: 'На першу сторінку' }));
    await expectRows(10);
    expect(currentUrl()).toBe('/webhooks');
  });

  it('shows an error state with retry', async () => {
    const { user } = await startApp('/webhooks');
    server.use(http.get(`${BASE_URL}/v1/webhooks`, () => HttpResponse.json(null, { status: 500 }), { once: true }));

    await logIn(user);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    await expectRows(10);
  });

  it('edits a webhook: 422 errors next to fields, then saves and returns to the same list page', async () => {
    const { user } = await startApp('/webhooks?page=2');
    await logIn(user);
    await expectRows(10);

    await user.click(screen.getAllByRole('link', { name: /·/ })[0]!);
    const name = await screen.findByLabelText('Назва');
    const url = screen.getByLabelText('URL');

    await user.clear(name);
    await user.clear(url);
    await user.type(url, 'ftp://nope');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(await screen.findByText('The name field is required.')).toBeTruthy();
    expect(screen.getByText('The url must be a valid URL.')).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBe('true');

    await user.type(name, 'Renamed hook'); // editing a field clears its error
    expect(screen.queryByText('The name field is required.')).toBeNull();

    await user.clear(url);
    await user.type(url, 'https://example.com/renamed');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => expect(currentUrl()).toBe('/webhooks?page=2'));
    await waitFor(async () => expect(await rowNames()).toContain('Renamed hook'));
  });

  it('rotates an expired session transparently; failed rotate returns to login and back after re-login', async () => {
    const { db, user } = await startApp('/webhooks');
    await logIn(user);
    await expectRows(10);

    db.session!.expiresAt = 0; // 30 s elapsed
    await user.click(screen.getByRole('button', { name: /Далі/ }));
    await waitFor(async () => expect((await rowNames())[0]).toBe('Order paid · Staging')); // page 2 data
    expect(db.session!.expiresAt).toBeGreaterThan(Date.now()); // rotated, user stayed in the app
    expect(currentUrl()).toBe('/webhooks?page=2');

    db.session = null; // server session gone → rotate answers 400
    await user.click(screen.getByRole('button', { name: /Далі/ }));
    expect(await screen.findByText('Сесія завершилась. Увійдіть знову.')).toBeTruthy();

    await logIn(user);
    await waitFor(() => expect(currentUrl()).toBe('/webhooks?page=3'));
    await expectRows(7);
  });

  it('logs out: revokes the session and clears cached user data', async () => {
    const { db, user } = await startApp('/webhooks');
    await logIn(user);
    await expectRows(10);
    const { queryClient } = await import('./services');
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Вийти' }));
    await screen.findByRole('heading', { name: 'Вхід' });

    expect(db.session).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.queryByText('Сесія завершилась. Увійдіть знову.')).toBeNull();
  });
});
