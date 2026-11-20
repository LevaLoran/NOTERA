// NOTERA Configuration
// Copy this file to config.js and fill in your Supabase credentials.
// NEVER commit config.js with real keys to a public repository if you care about secrecy,
// but since this is a client-side app the anon key is designed to be public.

window.NOTERA_CONFIG = {
  // Your Supabase project URL (e.g. https://xxxxxxxx.supabase.co)
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',

  // Your Supabase anon / public key
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

  // Optional: redirect URL after OAuth (usually your GitHub Pages URL)
  // Example: https://yourusername.github.io/NOTERA/
  SITE_URL: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/')
};
