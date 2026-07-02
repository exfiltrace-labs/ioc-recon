import { browser } from 'wxt/browser';
import type { Source } from '../lib/types';
import { getEffectiveSources, getLocalConfig } from '../lib/storage';
import { detect, selectionMatchesSource, refang, defang } from '../lib/indicators';
import { openLookup } from '../lib/open';
import { syncRemote } from '../lib/remote';

const ROOT_ID = 'ioc-recon-root';
const ALL_ID = 'ioc-recon-all';
const COPY_REFANG_ID = 'ioc-recon-copy-refang';
const COPY_DEFANG_ID = 'ioc-recon-copy-defang';
const SRC_PREFIX = 'src::';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await getLocalConfig();
    await scheduleRebuild();
  });

  browser.runtime.onStartup.addListener(async () => {
    await scheduleRebuild();
    await syncOnStartup();
  });

  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync' || area === 'local') void scheduleRebuild();
  });

  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const selection = (info.selectionText ?? '').trim();
    if (!selection) return;
    try {
      await handleClick(String(info.menuItemId), selection, tab?.id);
    } catch (e) {
      console.error('[IOC Recon] click handler failed:', e);
    }
  });

  void scheduleRebuild();
});

async function syncOnStartup(): Promise<void> {
  const cfg = await getLocalConfig();
  if (!cfg.remote.url) return;
  const outcome = await syncRemote();
  console.info('[IOC Recon] startup sync:', outcome.message);
}

let rebuildChain: Promise<void> = Promise.resolve();

function scheduleRebuild(): Promise<void> {
  rebuildChain = rebuildChain
    .then(buildMenus)
    .catch((e) => console.error('[IOC Recon] menu rebuild failed:', e));
  return rebuildChain;
}

function keyedSources(sources: Source[]): Map<string, Source> {
  const map = new Map<string, Source>();
  sources.forEach((s, i) => {
    let key = s.id;
    if (map.has(key)) key = `${s.id}#${i}`;
    map.set(key, s);
  });
  return map;
}

function menuTitle(text: string): string {
  return text.replace(/&/g, '&&');
}

async function buildMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  const [sources, config] = await Promise.all([getEffectiveSources(), getLocalConfig()]);
  const { settings } = config;

  browser.contextMenus.create({
    id: ROOT_ID,
    title: 'Lookup "%s"',
    contexts: ['selection'],
  });

  if (sources.length === 0) {
    browser.contextMenus.create({
      id: 'ioc-recon-empty',
      parentId: ROOT_ID,
      title: 'No sources configured - open Options',
      contexts: ['selection'],
    });
    addCopyItems();
    return;
  }

  if (settings.showAllItem) {
    browser.contextMenus.create({
      id: ALL_ID,
      parentId: ROOT_ID,
      title: 'Search all matching sources',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: 'ioc-recon-sep-0',
      parentId: ROOT_ID,
      type: 'separator',
      contexts: ['selection'],
    });
  }

  const map = keyedSources(sources);
  const keyById = new Map<Source, string>();
  for (const [k, s] of map) keyById.set(s, k);

  if (settings.groupByCategory) {
    const groups = new Map<string, Source[]>();
    for (const s of sources) {
      const cat = s.category?.trim() || '';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    const uncategorised = groups.get('') ?? [];
    for (const s of uncategorised) addSourceItem(ROOT_ID, s, keyById.get(s)!);
    for (const [cat, list] of groups) {
      if (cat === '') continue;
      const catId = `cat::${cat}`;
      browser.contextMenus.create({
        id: catId,
        parentId: ROOT_ID,
        title: menuTitle(cat),
        contexts: ['selection'],
      });
      for (const s of list) addSourceItem(catId, s, keyById.get(s)!);
    }
  } else {
    for (const s of sources) addSourceItem(ROOT_ID, s, keyById.get(s)!);
  }

  addCopyItems();
}

function addSourceItem(parentId: string, source: Source, key: string): void {
  browser.contextMenus.create({
    id: `${SRC_PREFIX}${key}`,
    parentId,
    title: menuTitle(source.name),
    contexts: ['selection'],
  });
}

function addCopyItems(): void {
  browser.contextMenus.create({
    id: 'ioc-recon-sep-copy',
    parentId: ROOT_ID,
    type: 'separator',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: COPY_REFANG_ID,
    parentId: ROOT_ID,
    title: 'Copy refanged',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: COPY_DEFANG_ID,
    parentId: ROOT_ID,
    title: 'Copy defanged',
    contexts: ['selection'],
  });
}

async function handleClick(
  menuItemId: string,
  selection: string,
  tabId: number | undefined,
): Promise<void> {
  if (menuItemId === COPY_REFANG_ID) {
    await copyToClipboard(tabId, refang(selection));
    return;
  }
  if (menuItemId === COPY_DEFANG_ID) {
    await copyToClipboard(tabId, defang(selection));
    return;
  }
  if (menuItemId === 'ioc-recon-empty') {
    await browser.runtime.openOptionsPage();
    return;
  }

  const sources = await getEffectiveSources();
  const config = await getLocalConfig();
  const placeholder = config.settings.placeholder || '%s';

  if (menuItemId === ALL_ID) {
    const detected = detect(selection);
    const matching = sources.filter((s) => selectionMatchesSource(s, detected));
    const toOpen = matching.length ? matching : sources;
    let first = true;
    for (const s of toOpen) {
      const active = first ? true : !config.settings.openMultipleInBackground;
      await openLookup(s, selection, placeholder, active);
      first = false;
    }
    return;
  }

  if (menuItemId.startsWith(SRC_PREFIX)) {
    const key = menuItemId.slice(SRC_PREFIX.length);
    const source = keyedSources(sources).get(key);
    if (source) await openLookup(source, selection, placeholder, !source.openInBackground);
    return;
  }
}

async function copyToClipboard(tabId: number | undefined, text: string): Promise<void> {
  if (tabId == null) return;
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: (t: string) => {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
          document.execCommand('copy');
        } finally {
          ta.remove();
        }
      },
      args: [text],
    });
  } catch (e) {
    console.error('[IOC Recon] copy failed:', e);
  }
}
