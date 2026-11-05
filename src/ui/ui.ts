// UI management

import { PROFILES, RAMS, RESOLUTIONS, OS_OPTIONS, PERF_OPTIONS, SLOTS, RELAY_OPTIONS, formatStorage } from '../types/app';
import { $, $$, val, err, sanitizeFilename, isValidWsUrl } from '../utils/helpers';
import { refreshOpfs } from '../storage/opfs';
import { warmAssets } from '../assets/loader';

interface UIElements {
  config: HTMLElement;
  vm: HTMLElement;
  screen: HTMLElement;
}

const elements: Partial<UIElements> = {};

export const initUI = (): void => {
  elements.config = $$<HTMLElement>('#config');
  elements.vm = $$<HTMLElement>('#vm');
  elements.screen = $$<HTMLElement>('#screen');

  // Populate RAM options
  const ramSelect = $$<HTMLSelectElement>('#ram');
  ramSelect.innerHTML = RAMS.map((m) =>
    `<option value="${m}" ${m === 512 ? 'selected' : ''}>${m >= 1024 ? m / 1024 + ' GB' : m + ' MB'}</option>`
  ).join('');

  // Populate resolution options
  const resSelect = $$<HTMLSelectElement>('#res');
  resSelect.innerHTML = RESOLUTIONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('');

  // Populate OS options
  const osSelect = $$<HTMLSelectElement>('#os');
  osSelect.innerHTML = OS_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');

  // Populate performance options
  const perfSelect = $('#perf') as HTMLSelectElement;
  perfSelect.innerHTML = PERF_OPTIONS.map((p) => `<option value="${p.value}">${p.label}</option>`).join('');

  // Populate slot options
  const slotSelect = $('#slot') as HTMLSelectElement;
  slotSelect.innerHTML = SLOTS.map((s) => `<option value="${s.value}">${s.label}</option>`).join('');

  // Populate relay options
  const relaySelect = $('#relay') as HTMLSelectElement;
  relaySelect.innerHTML = RELAY_OPTIONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('');

  // Initial sync
  syncUI();
  refreshOpfs();
  warmAssets();
};

export const syncUI = (): void => {
  const src = val('src');
  document.querySelectorAll('[data-src]').forEach((el) => {
    (el as HTMLElement).hidden = (el as HTMLElement).dataset.src !== src;
  });

  const customRelayWrap = $$<HTMLElement>('#customRelayWrap');
  customRelayWrap.hidden = $$<HTMLSelectElement>('#relay').value !== 'custom';

  const name = src === 'file'
    ? $$<HTMLInputElement>('#file').files?.[0]?.name
    : src === 'opfs'
      ? $$<HTMLSelectElement>('#opfsList').value
      : $$<HTMLInputElement>('#url').value;

  const archWarn = $$<HTMLElement>('#archWarn');
  archWarn.hidden = !/x86[_-]?64|amd64|x64/i.test(name || '');

  const storageSize = Number($$<HTMLInputElement>('#storageSize').value || 128);
  const storageValue = $$<HTMLElement>('#storageValue');
  storageValue.textContent = formatStorage(storageSize);

  updateTags();
};

export const updateTags = (extra: string[] = []): void => {
  const os = val('os');
  const tagsContainer = $('#tags')!;
  tagsContainer.innerHTML = [...PROFILES[os].tags, ...extra]
    .map((t) => `<span class="tag">${t}</span>`)
    .join('');
};

export const showConfig = (): void => {
  elements.config!.hidden = false;
  elements.vm!.hidden = true;
};

export const showVM = (): void => {
  elements.config!.hidden = true;
  elements.vm!.hidden = false;

  const resValue = ($$('#res') as HTMLSelectElement).value;
  const width = resValue === 'auto' ? 1024 : Number(resValue.split('x')[0]);
  ($$('#stage') as HTMLElement).style.setProperty('--w', `${width}px`);
};

export const updateStatus = (cls: string, text: string): void => {
  const dot = $('#dot')!;
  dot.className = 'dot ' + cls;
  ($$('#statusText') as HTMLElement).textContent = text;
};

export const setVMError = (message: string): void => {
  err('#vmError', message);
};

export const setConfigError = (message: string): void => {
  err('#error', message);
};

export const clearVMError = (): void => {
  err('#vmError', '');
};

export const clearConfigError = (): void => {
  err('#error', '');
};

export const updateVMTags = (tags: string[]): void => {
  const vmTags = $('#vmTags')!;
  vmTags.innerHTML = tags.map((t) => `<span class="tag">${t}</span>`).join('');
};

export const showVMNote = (message: string): void => {
  const vmNote = $$<HTMLElement>('#vmNote');
  vmNote.textContent = message;
  vmNote.hidden = false;
};

export const hideVMNote = (): void => {
  $$<HTMLElement>('#vmNote').hidden = true;
};

export const showWineUI = (show: boolean, exeName?: string): void => {
  const wineRun = $$<HTMLElement>('#wineRun');
  const wineHint = $$<HTMLElement>('#wineHint');
  wineRun.hidden = !show;
  wineHint.hidden = !show;
  if (show && exeName) {
    wineHint.textContent = `Log in at the guest's shell, then press Run .exe. It mounts the share at /mnt/win and starts the program with Wine.`;
  }
};

export const setWineRunHandler = (handler: () => void): void => {
  $$<HTMLButtonElement>('#wineRun').onclick = handler;
};

export const setStartButtonLoading = (loading: boolean): void => {
  const btn = $$<HTMLButtonElement>('#start');
  btn.disabled = loading;
  btn.textContent = loading ? 'Loading…' : 'Start VM';
};

export const setSaveButtonState = (state: 'idle' | 'saving' | 'saved' | 'error'): void => {
  const btn = $$<HTMLButtonElement>('#save');
  switch (state) {
    case 'saving':
      btn.disabled = true;
      btn.textContent = 'Saving…';
      break;
    case 'saved':
      btn.textContent = 'Saved';
      setTimeout(() => {
        btn.textContent = 'Save to OPFS';
        btn.disabled = false;
      }, 1500);
      break;
    case 'error':
      btn.textContent = 'Save to OPFS';
      btn.disabled = false;
      break;
    default:
      btn.textContent = 'Save to OPFS';
      btn.disabled = false;
  }
};

export const setSnapshotButtonState = (state: 'idle' | 'saving' | 'saved' | 'error'): void => {
  const btn = $$<HTMLButtonElement>('#snap');
  switch (state) {
    case 'saving':
      btn.disabled = true;
      btn.textContent = 'Saving…';
      break;
    case 'saved':
      btn.textContent = 'Saved';
      setTimeout(() => {
        btn.textContent = 'Save snapshot';
        btn.disabled = false;
      }, 1500);
      break;
    case 'error':
      btn.textContent = 'Save snapshot';
      btn.disabled = false;
      break;
    default:
      btn.textContent = 'Save snapshot';
      btn.disabled = false;
  }
};

export const setClearSnapsButtonState = (state: 'idle' | 'cleared'): void => {
  const btn = $$<HTMLButtonElement>('#clearSnaps');
  if (state === 'cleared') {
    btn.textContent = 'Cleared';
    setTimeout(() => (btn.textContent = 'Clear snapshots'), 1500);
  } else {
    btn.textContent = 'Clear snapshots';
  }
};

export const setFullscreenButtonText = (fullscreen: boolean): void => {
  $$<HTMLButtonElement>('#fs').textContent = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
}

export const getFrameWidth = (): string => {
  const resValue = $$<HTMLSelectElement>('#res').value;
  return resValue === 'auto' ? '1024px' : resValue.split('x')[0] + 'px';
};

export const resetScreen = (): void => {
  elements.screen!.innerHTML = '<div class="text"></div><canvas></canvas>';
};

export const validateCustomRelay = (): boolean => {
  const relay = $$<HTMLSelectElement>('#relay').value;
  if (relay === 'custom') {
    const customRelay = $$<HTMLInputElement>('#customRelay').value.trim();
    if (!isValidWsUrl(customRelay)) {
      setConfigError('Custom relay must start with ws:// or wss://.');
      return false;
    }
  }
  return true;
};

export const getRelayUrl = (): string => {
  const relay = $$<HTMLSelectElement>('#relay').value;
  if (relay === 'public') return 'wss://relay.widgetry.org/';
  if (relay === 'custom') return $$<HTMLInputElement>('#customRelay').value.trim();
  return '';
};

export const getSelectedSlot = (): string => {
  return $$<HTMLSelectElement>('#slot').value;
};

export const getConfig = () => {
  return {
    ram: Number($$<HTMLSelectElement>('#ram').value),
    slot: $$<HTMLSelectElement>('#slot').value,
    os: $$<HTMLSelectElement>('#os').value,
    perf: $$<HTMLSelectElement>('#perf').value,
    driveName: $$<HTMLInputElement>('#driveName').value.trim() || 'Custom VM',
    storageSize: Number($$<HTMLInputElement>('#storageSize').value || 0),
  };
};

export const getResumeChecked = (): boolean => {
  return $$<HTMLInputElement>('#resume').checked;
};