/**
 * NOTERA — Realtime sync & connection handling
 */

const NoteraSync = (() => {
  let channel = null;
  let isOnline = navigator.onLine;
  let onMessageCallbacks = [];
  let onConnectionCallbacks = [];

  function getClient() {
    return NoteraSupabase.getClient();
  }

  function getUserId() {
    return NoteraAuth.getUser()?.id;
  }

  function onMessage(cb) {
    onMessageCallbacks.push(cb);
  }

  function onConnectionChange(cb) {
    onConnectionCallbacks.push(cb);
  }

  function notifyMessage(event, payload) {
    onMessageCallbacks.forEach(cb => {
      try { cb(event, payload); } catch (e) { console.error(e); }
    });
  }

  function notifyConnection(online) {
    isOnline = online;
    onConnectionCallbacks.forEach(cb => {
      try { cb(online); } catch (e) { console.error(e); }
    });
  }

  function subscribe() {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) return;

    unsubscribe();

    channel = client
      .channel(`messages:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          notifyMessage(payload.eventType, payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attachments',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          notifyMessage('ATTACHMENT_' + payload.eventType, payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          notifyConnection(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          notifyConnection(false);
        }
      });
  }

  function unsubscribe() {
    if (channel) {
      const client = getClient();
      if (client) client.removeChannel(channel);
      channel = null;
    }
  }

  function initNetworkListeners() {
    window.addEventListener('online', () => {
      notifyConnection(true);
      // Re-subscribe
      subscribe();
    });

    window.addEventListener('offline', () => {
      notifyConnection(false);
    });
  }

  function getIsOnline() {
    return isOnline && navigator.onLine;
  }

  return {
    subscribe,
    unsubscribe,
    onMessage,
    onConnectionChange,
    initNetworkListeners,
    getIsOnline
  };
})();
