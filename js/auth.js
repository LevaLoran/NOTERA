/**
 * NOTERA — Authentication
 */

const NoteraAuth = (() => {
  let currentUser = null;
  let onAuthChangeCallbacks = [];

  function getClient() {
    return NoteraSupabase.getClient();
  }

  function onAuthChange(cb) {
    onAuthChangeCallbacks.push(cb);
  }

  function notifyAuthChange(user) {
    currentUser = user;
    onAuthChangeCallbacks.forEach(cb => {
      try { cb(user); } catch (e) { console.error(e); }
    });
  }

  async function init() {
    const client = getClient();
    if (!client) return null;

    // Listen for auth state changes
    client.auth.onAuthStateChange((event, session) => {
      const user = session?.user || null;
      notifyAuthChange(user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Session restored or refreshed
      }
      if (event === 'SIGNED_OUT') {
        // Cleared
      }
    });

    // Get current session
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.error('Auth session error:', error);
      return null;
    }

    currentUser = session?.user || null;
    return currentUser;
  }

  function getUser() {
    return currentUser;
  }

  async function signUp(email, password) {
    const client = getClient();
    if (!client) throw new Error('Supabase not configured');

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.NOTERA_CONFIG?.SITE_URL || window.location.origin
      }
    });

    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const client = getClient();
    if (!client) throw new Error('Supabase not configured');

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async function signInWithGitHub() {
    const client = getClient();
    if (!client) throw new Error('Supabase not configured');

    const redirectTo = window.NOTERA_CONFIG?.SITE_URL || window.location.href.split('?')[0].split('#')[0];

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo
      }
    });

    if (error) throw error;
    return data;
  }

  async function resetPassword(email) {
    const client = getClient();
    if (!client) throw new Error('Supabase not configured');

    const redirectTo = (window.NOTERA_CONFIG?.SITE_URL || window.location.origin) + '?reset=1';

    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;
    return data;
  }

  async function signOut() {
    const client = getClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getProfile() {
    const client = getClient();
    if (!client || !currentUser) return null;

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.warn('Profile fetch:', error.message);
      return null;
    }
    return data;
  }

  return {
    init,
    getUser,
    onAuthChange,
    signUp,
    signIn,
    signInWithGitHub,
    resetPassword,
    signOut,
    getProfile
  };
})();
