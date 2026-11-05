// Keyboard shortcuts help

export interface KeyboardShortcut {
  key: string;
  description: string;
  context: 'global' | 'vm' | 'config';
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'Ctrl+Alt', description: 'Release mouse/keyboard capture', context: 'vm' },
  { key: 'F11', description: 'Toggle fullscreen', context: 'vm' },
  { key: 'Escape', description: 'Exit fullscreen', context: 'vm' },
  { key: 'Tab', description: 'Navigate between controls', context: 'global' },
  { key: 'Enter/Space', description: 'Activate buttons', context: 'global' },
  { key: 'Arrow keys', description: 'Navigate menus/radio groups', context: 'global' },
];

export const showKeyboardHelp = (): void => {
  const modal = document.createElement('div');
  modal.className = 'keyboard-help-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'keyboard-help-title');

  modal.innerHTML = `
    <div class="keyboard-help-content">
      <header>
        <h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
        <button type="button" class="close-btn" aria-label="Close keyboard shortcuts">&times;</button>
      </header>
      <div class="keyboard-help-body">
        <section>
          <h3>Global</h3>
          <dl>
            ${KEYBOARD_SHORTCUTS.filter(s => s.context === 'global' || s.context === 'vm')
              .map(s => `<dt><kbd>${s.key}</kbd></dt><dd>${s.description}</dd>`)
              .join('')}
          </dl>
        </section>
        <section>
          <h3>VM Controls</h3>
          <dl>
            ${KEYBOARD_SHORTCUTS.filter(s => s.context === 'vm')
              .map(s => `<dt><kbd>${s.key}</kbd></dt><dd>${s.description}</dd>`)
              .join('')}
          </dl>
        </section>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .keyboard-help-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .keyboard-help-content {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 4px;
      padding: 20px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .keyboard-help-content header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .keyboard-help-content h2 {
      margin: 0;
      font: 700 14px var(--mono);
      color: var(--green);
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--ink);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .close-btn:hover {
      color: var(--green);
    }
    .keyboard-help-body section {
      margin-bottom: 20px;
    }
    .keyboard-help-body h3 {
      font: 700 11px var(--mono);
      color: var(--mute);
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .keyboard-help-body dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
    }
    .keyboard-help-body dt {
      font: 12px var(--mono);
      color: var(--green);
    }
    .keyboard-help-body dd {
      margin: 0;
      font: 12px var(--mono);
      color: var(--ink);
    }
    .keyboard-help-body kbd {
      background: var(--field);
      border: 1px solid var(--line);
      border-radius: 3px;
      padding: 2px 8px;
      font: 11px var(--mono);
      box-shadow: inset 0 1px 3px #000;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);

  // Focus trap
  const closeBtn = modal.querySelector('.close-btn') as HTMLButtonElement;
  const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  const closeModal = () => {
    modal.remove();
    style.remove();
    document.removeEventListener('keydown', handleKeydown);
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', handleKeydown);

  // Focus first element
  firstElement?.focus();
};

export const initKeyboardHelp = (): void => {
  // Add help button to the VM toolbar
  const toolbar = document.querySelector('.bar');
  if (toolbar) {
    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'secondary';
    helpBtn.setAttribute('aria-label', 'Show keyboard shortcuts');
    helpBtn.textContent = 'Help';
    helpBtn.addEventListener('click', showKeyboardHelp);
    toolbar.insertBefore(helpBtn, toolbar.querySelector('#fs'));
  }

  // Add keyboard shortcut F1 to show help globally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      showKeyboardHelp();
    }
  });
};