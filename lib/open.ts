import { browser } from 'wxt/browser';
import type { Source } from './types';
import { buildRequest } from './template';
import { newId } from './schema';

export async function openLookup(
  source: Source,
  selection: string,
  placeholder: string,
  active: boolean,
): Promise<void> {
  const req = buildRequest(source, selection, placeholder);

  if (req.method === 'GET') {
    await browser.tabs.create({ url: req.url, active });
    return;
  }

  const key = newId();
  await browser.storage.session.set({
    [`post:${key}`]: { url: req.url, body: req.body ?? '', contentType: req.contentType },
  });
  const page = browser.runtime.getURL('/post-redirect.html') + `?k=${encodeURIComponent(key)}`;
  await browser.tabs.create({ url: page, active });
}
