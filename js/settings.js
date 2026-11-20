/**
 * NOTERA — Settings modal
 */

const NoteraSettings = (() => {
  function open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const user = NoteraAuth.getUser();
    const emailEl = document.getElementById('settings-email');
    const usernameEl = document.getElementById('settings-username');

    if (emailEl) emailEl.textContent = user?.email || '—';

    NoteraAuth.getProfile().then(profile => {
      if (usernameEl) {
        usernameEl.textContent = profile?.username || user?.email?.split('@')[0] || '—';
      }
    });
  }

  function close() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  }

  function init() {
    document.getElementById('settings-btn')?.addEventListener('click', open);
    document.getElementById('settings-close')?.addEventListener('click', close);
    document.querySelector('#settings-modal .modal-backdrop')?.addEventListener('click', close);

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      try {
        await NoteraAuth.signOut();
        close();
      } catch (e) {
        NoteraChat.showToast('Ошибка выхода: ' + e.message);
      }
    });
  }

  return { open, close, init };
})();
