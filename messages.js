/**
 * NOTERA — Messages CRUD & rendering
 */

const NoteraMessages = (() => {
  const PAGE_SIZE = 40;
  let messages = []; // newest first in memory for simplicity, but render oldest first
  let hasMore = true;
  let isLoading = false;
  let oldestCursor = null; // created_at of oldest loaded
  let pendingIds = new Set(); // protect against double-send

  function getClient() {
    return NoteraSupabase.getClient();
  }

  function getUserId() {
    return NoteraAuth.getUser()?.id;
  }

  async function loadInitial() {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) return [];

    isLoading = true;
    const { data, error } = await client
      .from('messages')
      .select(`
        id, content, created_at, updated_at, is_pinned,
        attachments (id, file_name, file_type, file_size, storage_path)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    isLoading = false;

    if (error) {
      console.error('Load messages error:', error);
      throw error;
    }

    messages = data || [];
    hasMore = (data?.length || 0) >= PAGE_SIZE;
    if (messages.length) {
      oldestCursor = messages[messages.length - 1].created_at;
    }

    // Load attachments fully if needed
    return messages;
  }

  async function loadOlder() {
    if (!hasMore || isLoading) return [];
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId || !oldestCursor) return [];

    isLoading = true;
    const { data, error } = await client
      .from('messages')
      .select(`
        id, content, created_at, updated_at, is_pinned,
        attachments (id, file_name, file_type, file_size, storage_path)
      `)
      .eq('user_id', userId)
      .lt('created_at', oldestCursor)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    isLoading = false;

    if (error) {
      console.error('Load older error:', error);
      return [];
    }

    const older = data || [];
    hasMore = older.length >= PAGE_SIZE;
    if (older.length) {
      oldestCursor = older[older.length - 1].created_at;
      messages = messages.concat(older);
    }
    return older;
  }

  async function send(content, attachmentIds = []) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    if (pendingIds.has(tempId)) return null;
    pendingIds.add(tempId);

    const payload = {
      user_id: userId,
      content: content || null,
      is_pinned: false
    };

    try {
      const { data, error } = await client
        .from('messages')
        .insert(payload)
        .select(`
          id, content, created_at, updated_at, is_pinned,
          attachments (id, file_name, file_type, file_size, storage_path)
        `)
        .single();

      if (error) throw error;

      // Link attachments if any
      if (attachmentIds.length && data) {
        await client
          .from('attachments')
          .update({ message_id: data.id })
          .in('id', attachmentIds)
          .eq('user_id', userId);

        // Re-fetch with attachments
        const { data: full } = await client
          .from('messages')
          .select(`
            id, content, created_at, updated_at, is_pinned,
            attachments (id, file_name, file_type, file_size, storage_path)
          `)
          .eq('id', data.id)
          .single();

        if (full) {
          messages.unshift(full);
          return full;
        }
      }

      messages.unshift(data);
      return data;
    } finally {
      pendingIds.delete(tempId);
    }
  }

  async function update(id, content) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    const { data, error } = await client
      .from('messages')
      .update({ content })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        id, content, created_at, updated_at, is_pinned,
        attachments (id, file_name, file_type, file_size, storage_path)
      `)
      .single();

    if (error) throw error;

    const idx = messages.findIndex(m => m.id === id);
    if (idx !== -1) messages[idx] = data;
    return data;
  }

  async function remove(id) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    // Delete attachments from storage first
    const msg = messages.find(m => m.id === id);
    if (msg?.attachments?.length) {
      await NoteraAttachments.deleteFiles(msg.attachments);
    }

    const { error } = await client
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    messages = messages.filter(m => m.id !== id);
    return true;
  }

  async function togglePin(id) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    const msg = messages.find(m => m.id === id);
    if (!msg) throw new Error('Message not found');

    const newPinned = !msg.is_pinned;

    // Unpin others first if pinning
    if (newPinned) {
      await client
        .from('messages')
        .update({ is_pinned: false })
        .eq('user_id', userId)
        .eq('is_pinned', true);
      
      messages.forEach(m => { m.is_pinned = false; });
    }

    const { data, error } = await client
      .from('messages')
      .update({ is_pinned: newPinned })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        id, content, created_at, updated_at, is_pinned,
        attachments (id, file_name, file_type, file_size, storage_path)
      `)
      .single();

    if (error) throw error;

    const idx = messages.findIndex(m => m.id === id);
    if (idx !== -1) messages[idx] = data;
    return data;
  }

  function getPinned() {
    return messages.find(m => m.is_pinned) || null;
  }

  function getAll() {
    return messages;
  }

  function getById(id) {
    return messages.find(m => m.id === id);
  }

  function upsertFromRealtime(msg) {
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      messages[idx] = { ...messages[idx], ...msg };
    } else {
      // Only add if newer or we don't have older ones yet
      messages.unshift(msg);
      messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }

  function removeFromRealtime(id) {
    messages = messages.filter(m => m.id !== id);
  }

  function hasMoreMessages() {
    return hasMore;
  }

  function isLoadingMessages() {
    return isLoading;
  }

  // Helpers for rendering
  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }

  function linkify(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return escapeHtml(text).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    loadInitial,
    loadOlder,
    send,
    update,
    remove,
    togglePin,
    getPinned,
    getAll,
    getById,
    upsertFromRealtime,
    removeFromRealtime,
    hasMoreMessages,
    isLoadingMessages,
    formatTime,
    formatDate,
    linkify,
    escapeHtml,
    PAGE_SIZE
  };
})();
