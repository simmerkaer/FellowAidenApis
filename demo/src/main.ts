import { FellowAiden, FellowAidenError } from 'fellow-aiden';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const form = $<HTMLFormElement>('login');
const advanced = $<HTMLDetailsElement>('advanced');
const proxyInput = $<HTMLInputElement>('proxyUrl');
const proxyInfoLink = $<HTMLAnchorElement>('proxyInfoLink');
const emailInput = $<HTMLInputElement>('email');
const passwordInput = $<HTMLInputElement>('password');
const submit = $<HTMLButtonElement>('submit');
const statusEl = $<HTMLParagraphElement>('status');
const results = $<HTMLElement>('results');
const brewer = $<HTMLHeadingElement>('brewer');
const profilesList = $<HTMLUListElement>('profiles');
const schedulesList = $<HTMLUListElement>('schedules');

// The relay URL is baked in at build time (VITE_PROXY_URL). Visitors normally
// never touch it. We fall back to a saved value, then to empty (which the UI
// flags as needing configuration — relevant only for local dev).
const BUILT_IN_PROXY = import.meta.env.VITE_PROXY_URL ?? '';
proxyInput.value = BUILT_IN_PROXY || localStorage.getItem('proxyUrl') || '';

// If no relay was baked in, surface the Advanced section so it can be set.
if (!BUILT_IN_PROXY) {
  advanced.open = true;
}

proxyInfoLink.addEventListener('click', (e) => {
  e.preventDefault();
  $('how').scrollIntoView({ behavior: 'smooth' });
});

function setStatus(message: string, kind: 'info' | 'error' | 'success' = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function renderList(target: HTMLUListElement, items: string[]) {
  target.replaceChildren();
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = '(none)';
    target.append(li);
    return;
  }
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    target.append(li);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const baseUrl = proxyInput.value.trim().replace(/\/$/, '');
  if (!baseUrl) {
    advanced.open = true;
    setStatus('Set a relay (proxy) URL under Advanced to continue.', 'error');
    return;
  }

  submit.disabled = true;
  results.classList.add('hidden');
  setStatus('Connecting…');
  // Only remember a relay the user customised, not the built-in one.
  if (baseUrl !== BUILT_IN_PROXY) localStorage.setItem('proxyUrl', baseUrl);

  try {
    const aiden = await FellowAiden.create({
      email: emailInput.value,
      password: passwordInput.value,
      baseUrl,
    });

    const [profiles, schedules] = await Promise.all([aiden.getProfiles(), aiden.getSchedules()]);

    const name = document.createElement('span');
    name.textContent = aiden.getDisplayName() ?? 'Aiden';
    const id = document.createElement('span');
    id.className = 'brewer-id';
    id.textContent = aiden.getBrewerId() ?? '';
    brewer.replaceChildren(name, id);
    renderList(
      profilesList,
      profiles.map((p) => `${p.title}  ·  ${p.id}`),
    );
    renderList(
      schedulesList,
      schedules.map((s) => s.id),
    );

    results.classList.remove('hidden');
    setStatus(
      `Loaded ${profiles.length} profile${profiles.length === 1 ? '' : 's'} and ${schedules.length} schedule${schedules.length === 1 ? '' : 's'}.`,
      'success',
    );
  } catch (err) {
    const message =
      err instanceof FellowAidenError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    setStatus(`Failed: ${message}`, 'error');
  } finally {
    submit.disabled = false;
  }
});
