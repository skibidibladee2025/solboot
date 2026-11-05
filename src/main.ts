// Main entry point - solboot: boot any OS, right in your browser

import './style.css';
import { initUI, syncUI, showConfig, showVM, updateStatus, setVMError, clearVMError, clearConfigError, updateVMTags, showVMNote, hideVMNote, showWineUI, setWineRunHandler, setStartButtonLoading, setSaveButtonState, setSnapshotButtonState, setClearSnapsButtonState, setFullscreenButtonText, resetScreen, validateCustomRelay, getRelayUrl, getSelectedSlot, getConfig, getResumeChecked } from './ui/ui';
import { createCustomDrive, saveToOpfs, clearSnapshots, listOpfsFiles } from './storage/opfs';
import { resolveDisk, readExeFile } from './disk/disk';
import { startVM, stopVM, resetVM, teardown, saveSnapshot, setSource, getState } from './vm/vm';
import { $, err, formatStorage, val, $$ } from './utils/helpers';
import { downloadConfig, handleConfigFileImport } from './config/vm-config';
import { initKeyboardHelp } from './ui/keyboard';

// Initialize UI
initUI();
initKeyboardHelp();

// Event listeners for config panel
$('#config')!.addEventListener('input', syncUI);
$('#config')!.addEventListener('change', (e) => {
  if ((e.target as HTMLInputElement).name === 'src' && val('src') === 'opfs') {
    listOpfsFiles().then((files) => {
      const sel = $('#opfsList') as HTMLSelectElement;
      sel.innerHTML = files.length
        ? files.map((n) => `<option>${n}</option>`).join('')
        : "<option value=''>No saved images</option>";
      syncUI();
    });
  }
  syncUI();
});
($$('#opfsRefresh') as HTMLButtonElement).addEventListener('click', () => {
  listOpfsFiles().then((files) => {
    const sel = $('#opfsList') as HTMLSelectElement;
    sel.innerHTML = files.length
      ? files.map((n) => `<option>${n}</option>`).join('')
      : "<option value=''>No saved images</option>";
    syncUI();
  });
});

// Export config
($$('#exportConfig') as HTMLButtonElement).addEventListener('click', () => {
  clearConfigError();
  try {
    downloadConfig();
  } catch (e) {
    err('#error', `Failed to export configuration: ${(e as Error).message}`);
  }
});

// Import config
($$('#importConfig') as HTMLButtonElement).addEventListener('click', () => {
  clearConfigError();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await handleConfigFileImport(file);
      syncUI();
    } catch (e) {
      err('#error', `Failed to import configuration: ${(e as Error).message}`);
    }
  };
  input.click();
});

// Create custom drive
($$('#createDrive') as HTMLButtonElement).addEventListener('click', async () => {
  clearConfigError();
  const name = ($$('#driveName') as HTMLInputElement).value.trim() || 'custom-drive';
  const sizeMb = Number(($$('#storageSize') as HTMLInputElement).value || 128);

  try {
    const safeName = await createCustomDrive(name, sizeMb);
    ($$('#storageStatus') as HTMLElement).textContent = `Created ${safeName} with ${formatStorage(sizeMb)} and saved in browser storage.`;
    const srcRadio = document.querySelector('input[name="src"][value="opfs"]') as HTMLInputElement;
    if (srcRadio) srcRadio.checked = true;
    const files = await listOpfsFiles();
    const sel = $('#opfsList') as HTMLSelectElement;
    sel.innerHTML = files.map((n) => `<option>${n}</option>`).join('');
    sel.value = safeName;
    syncUI();
  } catch (e) {
    err('#error', (e as Error).message || 'Could not create the disk image.');
  }
});

// Start VM
($$('#start') as HTMLButtonElement).addEventListener('click', async () => {
  clearConfigError();
  clearVMError();

  if (!validateCustomRelay()) return;

  const slot = getSelectedSlot();
  const relayUrl = getRelayUrl();
  const config = getConfig();
  const resume = getResumeChecked();

  setStartButtonLoading(true);

  try {
    const [diskResult, exe] = await Promise.all([
      resolveDisk(val('src') as 'file' | 'opfs' | 'url', slot as any,
        ($$('#file') as HTMLInputElement),
        ($$('#opfsList') as HTMLSelectElement),
        ($$('#url') as HTMLInputElement)),
      readExeFile(($$('#exe') as HTMLInputElement)),
    ]);

    const { diskOption, source } = diskResult;
    setSource(source);

    const vmConfig = exe ? { ...config, exe } : config;

    const emu = await startVM(
      vmConfig,
      diskOption,
      (status, text) => updateStatus(status, text),
      (message, destroy = true) => {
        updateStatus('error', 'Error');
        setVMError(message);
        if (destroy) teardown();
      },
      (message) => showVMNote(message),
      (tags) => updateVMTags(tags)
    );

    // Setup Wine if exe provided
    if (exe) {
      showWineUI(true, exe.name);
      setWineRunHandler(() => {
        emu.keyboard_send_text(
          `mkdir -p /mnt/win; mount -t 9p -o trans=virtio,version=9p2000.L host9p /mnt/win; wine "/mnt/win/${exe.name}"\n`
        );
      });
    } else {
      showWineUI(false);
    }

    showVM();

    // Check for non-ranged remote images
    if (source.url && !source.ranged) {
      showVMNote('This server does not support range requests, so the whole image is downloading before boot. Use a host with HTTP Range support for faster starts.');
    } else {
      hideVMNote();
    }
  } catch (e) {
    err('#error', (e as Error).message);
  } finally {
    setStartButtonLoading(false);
  }
});

// Stop VM
($$('#stop') as HTMLButtonElement).addEventListener('click', () => {
  stopVM();
  updateStatus('', 'Stopped');
});

// Reset VM
($$('#reset') as HTMLButtonElement).addEventListener('click', () => {
  clearVMError();
  if (getState().emu) {
    resetVM();
    updateStatus('running', 'Running');
  }
});

// Back to config
($$('#back') as HTMLButtonElement).addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  teardown();
  resetScreen();
  showWineUI(false);
  hideVMNote();
  showConfig();
});

// Save to OPFS
($$('#save') as HTMLButtonElement).addEventListener('click', async () => {
  const state = getState();
  if (!state.source) return setVMError('There is no disk image to save for this session.');
  if (state.source.fromOpfs) return setVMError(`"${state.source.name}" is already in browser storage.`);

  setSaveButtonState('saving');
  try {
    await saveToOpfs(state.source);
    setSaveButtonState('saved');
    listOpfsFiles().then((files) => {
      const sel = $('#opfsList') as HTMLSelectElement;
      sel.innerHTML = files.map((n) => `<option>${n}</option>`).join('');
      syncUI();
    });
  } catch (e) {
    setSaveButtonState('error');
    setVMError(`Could not save to browser storage: ${(e as Error).message}`);
  }
});

// Save snapshot
($$('#snap') as HTMLButtonElement).addEventListener('click', async () => {
  const state = getState();
  if (!state.emu || !state.snapKey) return;

  setSnapshotButtonState('saving');
  try {
    await saveSnapshot();
    setSnapshotButtonState('saved');
  } catch (e) {
    setSnapshotButtonState('error');
    setVMError(`Could not save the snapshot: ${(e as Error).message}`);
  }
});

// Clear snapshots
($$('#clearSnaps') as HTMLButtonElement).addEventListener('click', async () => {
  await clearSnapshots();
  setClearSnapsButtonState('cleared');
});

// Fullscreen
($$('#fs') as HTMLButtonElement).addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await ($$('#stage') as HTMLElement).requestFullscreen();
    }
  } catch (e) {
    setVMError(`Fullscreen is not available: ${(e as Error).message}`);
  }
});

document.addEventListener('fullscreenchange', () => {
  setFullscreenButtonText(!!document.fullscreenElement);
});

// Export functions for potential external use (e.g., testing)
export { getState };