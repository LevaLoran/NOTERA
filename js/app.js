/**
 * NOTERA — Application entry point
 */

(function () {
  'use strict';

  const authScreen = document.getElementById('auth-screen');
  const appEl = document.getElementById('app');

  function showAuth() {
    authScreen?.classList.remove('hidden');
    appEl?.classList.add('hidden');
  }

  function showApp() {
    authScreen?.classList.add('hidden');
    appEl?.classList.remove('hidden');
  }

  function showAuthMessage(text, type = 'error') {
    const el = document.getElementById('auth-message');
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-message ' + type;
    el.classList.remove('hidden');
  }

  function clearAuthMessage() {
    const el = document.getElementById('auth-message');
    if (el) {
      el.classList.add('hidden');
      el.textContent = '';
    }
  }

  function initAuthUI() {
    // Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form')?.classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form')?.classList.toggle('hidden', target !== 'register');
        document.getElementById('forgot-form')?.classList.add('hidden');
        clearAuthMessage();
      });
    });

    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessage();
      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;
      try {
        await NoteraAuth.signIn(email, password);
        // onAuthChange will switch screens
      } catch (err) {
        showAuthMessage(err.message || 'Ошибка входа');
      }
    });

    // Register
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessage();
      const email = document.getElementById('register-email')?.value.trim();
      const password = document.getElementById('register-password')?.value;
      const confirm = document.getElementById('register-password-confirm')?.value;

      if (password !== confirm) {
        showAuthMessage('Пароли не совпадают');
        return;
      }
      if (password.length < 6) {
        showAuthMessage('Пароль должен быть не короче 6 символов');
        return;
      }

      try {
        const data = await NoteraAuth.signUp(email, password);
        if (data?.user?.identities?.length === 0) {
          showAuthMessage('Этот email уже зарегистрирован', 'error');
        } else if (data?.session) {
          // Auto signed in (email confirm disabled)
        } else {
          showAuthMessage('Проверьте почту и подтвердите регистрацию', 'success');
        }
      } catch (err) {
        showAuthMessage(err.message || 'Ошибка регистрации');
      }
    });

    // Forgot password
    document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
      document.getElementById('login-form')?.classList.add('hidden');
      document.getElementById('register-form')?.classList.add('hidden');
      document.getElementById('forgot-form')?.classList.remove('hidden');
      clearAuthMessage();
    });

    document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
      document.getElementById('forgot-form')?.classList.add('hidden');
      document.getElementById('login-form')?.classList.remove('hidden');
      document.querySelector('.auth-tab[data-tab="login"]')?.classList.add('active');
      document.querySelector('.auth-tab[data-tab="register"]')?.classList.remove('active');
      clearAuthMessage();
    });

    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessage();
      const email = document.getElementById('forgot-email')?.value.trim();
      try {
        await NoteraAuth.resetPassword(email);
        showAuthMessage('Ссылка для сброса отправлена на почту', 'success');
      } catch (err) {
        showAuthMessage(err.message || 'Ошибка');
      }
    });

    // GitHub
    document.getElementById('github-login-btn')?.addEventListener('click', async () => {
      clearAuthMessage();
      try {
        await NoteraAuth.signInWithGitHub();
      } catch (err) {
        showAuthMessage(err.message || 'Ошибка GitHub OAuth');
      }
    });
  }

  async function startApp() {
    NoteraChat.init();
    NoteraSettings.init();
    NoteraSync.initNetworkListeners();

    NoteraSync.onConnectionChange((online) => {
      NoteraChat.updateConnectionStatus(online);
    });

    NoteraSync.onMessage((event, payload) => {
      NoteraChat.handleRealtime(event, payload);
    });

    await NoteraChat.loadAndRender();
    NoteraSync.subscribe();
  }

  async function boot() {
    // Check config
    if (!window.NOTERA_CONFIG ||
        window.NOTERA_CONFIG.SUPABASE_URL?.includes('YOUR_PROJECT') ||
        window.NOTERA_CONFIG.SUPABASE_ANON_KEY?.includes('YOUR_SUPABASE')) {
      showAuth();
      showAuthMessage(
        'Создайте config.js на основе config.example.js и укажите ключи Supabase. Подробности в README.md',
        'info'
      );
      initAuthUI();
      return;
    }

    NoteraSupabase.init();
    initAuthUI();

    NoteraAuth.onAuthChange(async (user) => {
      if (user) {
        showApp();
        await startApp();
      } else {
        NoteraSync.unsubscribe();
        showAuth();
      }
    });

    const user = await NoteraAuth.init();
    if (user) {
      showApp();
      await startApp();
    } else {
      showAuth();
    }
  }

  // Service Worker registration (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Silently ignore — may fail on file:// or restricted hosts
      });
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
