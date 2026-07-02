import { browser } from 'wxt/browser';
import { bodyToFields } from '../../lib/template';
import { isHttpProtocol } from '../../lib/url';

interface PostPayload {
  url: string;
  body: string;
  contentType: string;
}

function fail(message: string): void {
  const spinner = document.getElementById('spinner');
  const status = document.getElementById('status');
  if (spinner) spinner.remove();
  if (status) {
    status.textContent = message;
    status.className = 'err';
  }
}

async function run(): Promise<void> {
  const key = new URLSearchParams(location.search).get('k');
  if (!key) return fail('Missing request key.');

  const storageKey = `post:${key}`;
  const data = await browser.storage.session.get(storageKey);
  const payload = data[storageKey] as PostPayload | undefined;
  await browser.storage.session.remove(storageKey);

  if (!payload) return fail('This search request expired or was already used.');

  let action: URL;
  try {
    action = new URL(payload.url);
  } catch {
    return fail('Invalid destination URL.');
  }
  if (!isHttpProtocol(action.protocol)) {
    return fail('Refusing to submit to a non-http(s) URL.');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payload.url;
  const ct = (payload.contentType || 'application/x-www-form-urlencoded').toLowerCase();
  form.enctype = ct.includes('multipart')
    ? 'multipart/form-data'
    : 'application/x-www-form-urlencoded';

  for (const [name, value] of bodyToFields(payload.body, ct)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

void run().catch((e) => fail(`Failed to submit: ${(e as Error).message}`));
