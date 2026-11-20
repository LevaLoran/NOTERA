/**
 * NOTERA — Search
 */

const NoteraSearch = (() => {
  function getClient() {
    return NoteraSupabase.getClient();
  }

  function getUserId() {
    return NoteraAuth.getUser()?.id;
  }

  /**
   * Search messages and attachment filenames via Supabase
   */
  async function search(query) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId || !query || query.trim().length < 1) return [];

    const q = query.trim();

    // Search content with ilike (works without full-text setup issues)
    const { data: contentMatches, error: e1 } = await client
      .from('messages')
      .select(`
        id, content, created_at, updated_at, is_pinned,
        attachments (id, file_name, file_type, file_size, storage_path)
      `)
      .eq('user_id', userId)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (e1) console.error('Search content error:', e1);

    // Search by filename
    const { data: fileMatches, error: e2 } = await client
      .from('attachments')
      .select(`
        id, file_name, file_type, file_size, storage_path, message_id,
        messages (id, content, created_at, updated_at, is_pinned)
      `)
      .eq('user_id', userId)
      .ilike('file_name', `%${q}%`)
      .limit(30);

    if (e2) console.error('Search files error:', e2);

    // Merge unique messages
    const map = new Map();

    (contentMatches || []).forEach(m => {
      map.set(m.id, m);
    });

    (fileMatches || []).forEach(att => {
      if (att.messages) {
        const m = {
          id: att.messages.id,
          content: att.messages.content,
          created_at: att.messages.created_at,
          updated_at: att.messages.updated_at,
          is_pinned: att.messages.is_pinned,
          attachments: [att]
        };
        if (!map.has(m.id)) {
          map.set(m.id, m);
        } else {
          // ensure attachment is present
          const existing = map.get(m.id);
          if (!existing.attachments?.some(a => a.id === att.id)) {
            existing.attachments = [...(existing.attachments || []), att];
          }
        }
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }

  function highlightText(text, query) {
    if (!text || !query) return NoteraMessages.escapeHtml(text || '');
    const escaped = NoteraMessages.escapeHtml(text);
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!q) return escaped;
    const regex = new RegExp(`(${q})`, 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
  }

  return { search, highlightText };
})();
