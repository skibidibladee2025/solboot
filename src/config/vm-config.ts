// VM Configuration export/import

import { getConfig as getUIConfig } from '../ui/ui';

export interface VMConfig {
  version: number;
  driveName: string;
  storageSize: number;
  os: string;
  ram: number;
  res: string;
  perf: string;
  slot: string;
  src: 'file' | 'opfs' | 'url';
  fileName?: string;
  opfsName?: string;
  url?: string;
  resume: boolean;
  exeName?: string;
  relay: 'public' | 'custom' | 'off';
  customRelay?: string;
}

export const exportConfig = (): VMConfig => {
  const config = getUIConfig();
  const src = document.querySelector('input[name="src"]:checked') as HTMLInputElement;
  const fileInput = document.getElementById('file') as HTMLInputElement;
  const opfsSelect = document.getElementById('opfsList') as HTMLSelectElement;
  const urlInput = document.getElementById('url') as HTMLInputElement;
  const resumeCheckbox = document.getElementById('resume') as HTMLInputElement;
  const exeInput = document.getElementById('exe') as HTMLInputElement;
  const relaySelect = document.getElementById('relay') as HTMLSelectElement;
  const customRelayInput = document.getElementById('customRelay') as HTMLInputElement;

  const exportedConfig: VMConfig = {
    version: 1,
    driveName: config.driveName,
    storageSize: config.storageSize,
    os: config.os,
    ram: config.ram,
    res: (document.getElementById('res') as HTMLSelectElement).value,
    perf: config.perf,
    slot: config.slot,
    src: src?.value as 'file' | 'opfs' | 'url' || 'file',
    resume: resumeCheckbox?.checked ?? true,
    relay: relaySelect?.value as 'public' | 'custom' | 'off' || 'public',
  };

  // Add source-specific data
  if (exportedConfig.src === 'file' && fileInput?.files?.[0]) {
    exportedConfig.fileName = fileInput.files[0].name;
  } else if (exportedConfig.src === 'opfs') {
    exportedConfig.opfsName = opfsSelect?.value || '';
  } else if (exportedConfig.src === 'url') {
    exportedConfig.url = urlInput?.value || '';
  }

  // Add exe name if present
  if (exeInput?.files?.[0]) {
    exportedConfig.exeName = exeInput.files[0].name;
  }

  // Add custom relay if applicable
  if (exportedConfig.relay === 'custom') {
    exportedConfig.customRelay = customRelayInput?.value || '';
  }

  return exportedConfig;
};

export const downloadConfig = (): void => {
  const config = exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.driveName.replace(/[^a-z0-9._-]+/gi, '-') || 'vm-config'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importConfig = async (file: File): Promise<void> => {
  const text = await file.text();
  const config = JSON.parse(text) as VMConfig;

  if (!config.version || config.version > 1) {
    throw new Error('Unsupported configuration version');
  }

  // Apply configuration to UI
  (document.getElementById('driveName') as HTMLInputElement).value = config.driveName || '';
  (document.getElementById('storageSize') as HTMLInputElement).value = String(config.storageSize || 128);
  (document.getElementById('os') as HTMLSelectElement).value = config.os || 'linux';
  (document.getElementById('ram') as HTMLSelectElement).value = String(config.ram || 512);
  (document.getElementById('res') as HTMLSelectElement).value = config.res || 'auto';
  (document.getElementById('perf') as HTMLSelectElement).value = config.perf || 'balanced';
  (document.getElementById('slot') as HTMLSelectElement).value = config.slot || 'hda';

  // Set source radio
  const srcRadio = document.querySelector(`input[name="src"][value="${config.src}"]`) as HTMLInputElement;
  if (srcRadio) srcRadio.checked = true;

  // Set resume
  (document.getElementById('resume') as HTMLInputElement).checked = config.resume ?? true;

  // Set relay
  (document.getElementById('relay') as HTMLSelectElement).value = config.relay || 'public';

  // Set custom relay if applicable
  if (config.relay === 'custom' && config.customRelay) {
    (document.getElementById('customRelay') as HTMLInputElement).value = config.customRelay;
  }

  // Trigger sync to update UI
  const event = new Event('input', { bubbles: true });
  document.getElementById('config')?.dispatchEvent(event);

  // Note: File inputs cannot be set programmatically for security reasons
  // User will need to re-select files manually
  if (config.fileName) {
    console.info(`Configuration references file: ${config.fileName} - please re-select the file manually`);
  }
  if (config.opfsName) {
    console.info(`Configuration references OPFS image: ${config.opfsName}`);
  }
  if (config.url) {
    (document.getElementById('url') as HTMLInputElement).value = config.url;
  }
  if (config.exeName) {
    console.info(`Configuration references exe: ${config.exeName} - please re-select the file manually`);
  }
};

export const handleConfigFileImport = (file: File): Promise<void> => importConfig(file);