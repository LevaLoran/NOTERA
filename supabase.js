/**
 * NOTERA — Supabase client initialization
 */

const NoteraSupabase = (() => {
  let client = null;

  function init() {
    if (!window.NOTERA_CONFIG) {
      console.error('NOTERA: config.js not found. Copy config.example.js to config.js and fill in your keys.');
      return null;
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NOTERA_CONFIG;

    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT') ||
        !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')) {
      console.warn('NOTERA: Please configure Supabase credentials in config.js');
      return null;
    }

    if (typeof supabase === 'undefined') {
      console.error('NOTERA: Supabase SDK not loaded');
      return null;
    }

    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    return client;
  }

  function getClient() {
    if (!client) {
      client = init();
    }
    return client;
  }

  return { init, getClient };
})();
