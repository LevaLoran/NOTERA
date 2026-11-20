/**
 * NOTERA — Chat UI controller
 */

const NoteraChat = (() => {
  let pendingFiles = []; // File objects waiting to be sent
  let editingId = null;
  let contextMsgId = null;
  let searchActive = false;
  let searchResults = null;

  const els = {};

  function cacheEls() {
    els.messagesList = document.getElementById('messages-list');
    els.messagesArea = document.getElementById('messages-area');
    els.emptyState = document.getElementById('empty-state');
    els.messageInput = document.getElementById('message-input');
    els.sendBtn = document.getElementById('send-btn');
    els.attachBtn = document.getElementById('attach-btn');
    els.fileInput = document.getElementById('file-input');
    els.attachmentsPreview = document.getElementById('attachments-preview');
    els.pinnedBar = document.getElementById('pinned-bar');
    els.pinnedText = document.getElementById('pinned-text');
    els.pinnedContent = document.getElementById('pinned-content');
    els.unpinBtn = document.getElementById('unpin-btn');
    els.searchBar = document.getElementById('search-bar');
    els.searchInput = document.getElementById('search-input');
    els.searchBtn = document.getElementById('search-btn');
    els.searchCloseBtn = document.getElementById('search-close-btn');
    els.searchClearBtn = document.getElementById('search-clear-btn');
    els.contextMenu = document.getElementById('context-menu');
    els.loadMore = document.getElementById('load-more');
    els.loadMoreBtn = document.getElementById('load-more-btn');
    els.connectionStatus = document.getElementById('connection-status');
    els.userAvatar = document.getElementById('user-avatar');
    els.avatarInitial = document.getElementById('avatar-initial');
    els.imageViewer = document.getElementById('image-viewer');
    els.viewerImage = document.getElementById('viewer-image');
    els.viewerClose = document.getElementById('viewer-close');
    els.toast = document.getElementById('toast');
  }

  function showToast(text, duration = 2800) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(() => {
      els.toast.classList.add('hidden');
    }, duration);
  }

  function updateAvatar() {
    const user = NoteraAuth.getUser();
    if (!user) return;
    const initial = (user.email || 'U')[0].toUpperCase();
    if (els.avatarInitial) els.avatarInitial.textContent = initial;

    NoteraAuth.getProfile().then(profile => {
      if (profile?.avatar_url && els.userAvatar) {
        els.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="" />`;
      }
    });
  }

  function updateConnectionStatus(online) {
    if (!els.connectionStatus) return;
    if (online) {
      els.connectionStatus.textContent = 'онлайн';
      els.connectionStatus.classList.remove('offline');
    } else {
      els.connectionStatus.textContent = 'нет сети';
      els.connectionStatus.classList.add('offline');
    }
  }

  function autoResizeInput() {
    const ta = els.messageInput;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }

  function updateSendButton() {
    const hasText = els.messageInput?.value.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (els.sendBtn) els.sendBtn.disabled = !(hasText || hasFiles) && !editingId;
  }

  // ---------- Rendering ----------

  function renderMessages(list, options = {}) {
    const { append = false, prepend = false, highlightQuery = null } = options;
    if (!els.messagesList) return;

    if (!append && !prepend) {
      els.messagesList.innerHTML = '';
    }

    const msgs = list || NoteraMessages.getAll();
    // Render oldest first (chronological)
    const chronological = [...msgs].reverse();

    if (!msgs.length && !searchActive) {
      els.emptyState?.classList.remove('hidden');
      els.messagesList.innerHTML = '';
      updatePinnedBar();
      return;
    }

    els.emptyState?.classList.add('hidden');

    let lastDate = null;
    const fragment = document.createDocumentFragment();

    chronological.forEach(msg => {
      const dateStr = NoteraMessages.formatDate(msg.created_at);
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = `<span>${dateStr}</span>`;
        fragment.appendChild(sep);
      }

      fragment.appendChild(createMessageEl(msg, highlightQuery));
    });

    if (prepend) {
      const prevHeight = els.messagesArea.scrollHeight;
      els.messagesList.prepend(fragment);
      els.messagesArea.scrollTop = els.messagesArea.scrollHeight - prevHeight;
    } else if (append) {
      els.messagesList.appendChild(fragment);
    } else {
      els.messagesList.appendChild(fragment);
      scrollToBottom();
    }

    updatePinnedBar();
    updateLoadMore();
  }

  function createMessageEl(msg, highlightQuery) {
    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.id = msg.id;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Content
    if (msg.content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'message-content';
      if (highlightQuery) {
        contentEl.innerHTML = NoteraSearch.highlightText(msg.content, highlightQuery);
      } else {
        contentEl.innerHTML = NoteraMessages.linkify(msg.content);
      }
      bubble.appendChild(contentEl);
    }

    // Attachments
    if (msg.attachments?.length) {
      const attWrap = document.createElement('div');
      attWrap.className = 'message-attachments';
      msg.attachments.forEach(att => {
        attWrap.appendChild(createAttachmentEl(att));
      });
      bubble.appendChild(attWrap);
    }

    // Meta
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    let metaHtml = '';
    if (msg.is_pinned) metaHtml += '<span class="pinned-indicator">📌</span> ';
    if (msg.updated_at && msg.updated_at !== msg.created_at) {
      metaHtml += '<span class="edited">изм.</span> ';
    }
    metaHtml += `<span>${NoteraMessages.formatTime(msg.created_at)}</span>`;
    meta.innerHTML = metaHtml;
    bubble.appendChild(meta);

    div.appendChild(bubble);

    // Context menu events
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, msg.id);
    });

    // Long press for mobile
    let pressTimer;
    bubble.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showContextMenu(touch.clientX, touch.clientY, msg.id);
      }, 500);
    }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));

    return div;
  }

  function createAttachmentEl(att) {
    if (NoteraAttachments.isImage(att.file_type)) {
      const img = document.createElement('img');
      img.className = 'attachment-image';
      img.alt = att.file_name;
      img.loading = 'lazy';
      // Load signed URL
      NoteraAttachments.getSignedUrl(att.storage_path).then(url => {
        if (url) {
          img.src = url;
          img.addEventListener('click', () => openImageViewer(url));
        }
      });
      return img;
    }

    // File card
    const a = document.createElement('a');
    a.className = 'attachment-file';
    a.href = '#';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await NoteraAttachments.download(att);
      } catch (err) {
        showToast(err.message || 'Ошибка скачивания');
      }
    });

    a.innerHTML = `
      <div class="file-icon">${NoteraAttachments.getExt(att.file_name)}</div>
      <div class="file-info">
        <div class="file-name">${NoteraMessages.escapeHtml(att.file_name)}</div>
        <div class="file-size">${NoteraAttachments.formatSize(att.file_size || 0)}</div>
      </div>
    `;
    return a;
  }

  function updatePinnedBar() {
    const pinned = NoteraMessages.getPinned();
    if (!pinned || searchActive) {
      els.pinnedBar?.classList.add('hidden');
      return;
    }
    els.pinnedBar?.classList.remove('hidden');
    const text = pinned.content
      ? pinned.content.slice(0, 80) + (pinned.content.length > 80 ? '…' : '')
      : (pinned.attachments?.[0]?.file_name || 'Закреплённое сообщение');
    if (els.pinnedText) els.pinnedText.textContent = text;
  }

  function updateLoadMore() {
    if (NoteraMessages.hasMoreMessages() && !searchActive) {
      els.loadMore?.classList.remove('hidden');
    } else {
      els.loadMore?.classList.add('hidden');
    }
  }

  function scrollToBottom(smooth = true) {
    if (!els.messagesArea) return;
    requestAnimationFrame(() => {
      els.messagesArea.scrollTo({
        top: els.messagesArea.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }

  function scrollToMessage(id) {
    const el = els.messagesList?.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlighted');
      setTimeout(() => el.classList.remove('highlighted'), 1600);
    }
  }

  // ---------- Context menu ----------

  function showContextMenu(x, y, msgId) {
    contextMsgId = msgId;
    const menu = els.contextMenu;
    if (!menu) return;

    const msg = NoteraMessages.getById(msgId);
    const pinBtn = menu.querySelector('[data-action="pin"]');
    if (pinBtn) pinBtn.textContent = msg?.is_pinned ? 'Открепить' : 'Закрепить';

    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function hideContextMenu() {
    els.contextMenu?.classList.add('hidden');
    contextMsgId = null;
  }

  // ---------- Send / Edit ----------

  async function handleSend() {
    const text = els.messageInput?.value.trim() || '';
    if (!text && !pendingFiles.length && !editingId) return;

    if (editingId) {
      try {
        await NoteraMessages.update(editingId, text);
        cancelEdit();
        renderMessages();
        showToast('Сообщение изменено');
      } catch (e) {
        showToast('Ошибка: ' + e.message);
      }
      return;
    }

    els.sendBtn.disabled = true;
    const filesToSend = [...pendingFiles];
    pendingFiles = [];
    renderPendingPreview();
    els.messageInput.value = '';
    autoResizeInput();

    try {
      // First create message
      let msg = await NoteraMessages.send(text || null);

      // Then upload files and link
      if (filesToSend.length && msg) {
        for (const file of filesToSend) {
          try {
            const info = await NoteraAttachments.upload(file);
            await NoteraAttachments.createRecord(msg.id, info);
          } catch (fe) {
            showToast('Файл не загружен: ' + fe.message);
          }
        }
        // Refresh message with attachments
        const client = NoteraSupabase.getClient();
        const { data: full } = await client
          .from('messages')
          .select(`id, content, created_at, updated_at, is_pinned, attachments (id, file_name, file_type, file_size, storage_path)`)
          .eq('id', msg.id)
          .single();
        if (full) {
          NoteraMessages.upsertFromRealtime(full);
          msg = full;
        }
      }

      renderMessages();
      scrollToBottom();
    } catch (e) {
      showToast('Ошибка отправки: ' + e.message);
      // Restore text
      if (text) els.messageInput.value = text;
    } finally {
      updateSendButton();
    }
  }

  function startEdit(id) {
    const msg = NoteraMessages.getById(id);
    if (!msg) return;
    editingId = id;
    els.messageInput.value = msg.content || '';
    autoResizeInput();
    els.messageInput.focus();
    updateSendButton();

    // Mark message visually
    document.querySelectorAll('.message.editing').forEach(el => el.classList.remove('editing'));
    document.querySelector(`.message[data-id="${id}"]`)?.classList.add('editing');
  }

  function cancelEdit() {
    editingId = null;
    els.messageInput.value = '';
    autoResizeInput();
    document.querySelectorAll('.message.editing').forEach(el => el.classList.remove('editing'));
    updateSendButton();
  }

  // ---------- Files ----------

  function addFiles(fileList) {
    const files = Array.from(fileList);
    for (const file of files) {
      const v = NoteraAttachments.validateFile(file);
      if (!v.ok) {
        showToast(v.error);
        continue;
      }
      if (pendingFiles.length >= 10) {
        showToast('Максимум 10 файлов за раз');
        break;
      }
      pendingFiles.push(file);
    }
    renderPendingPreview();
    updateSendButton();
  }

  function renderPendingPreview() {
    if (!els.attachmentsPreview) return;
    if (!pendingFiles.length) {
      els.attachmentsPreview.classList.add('hidden');
      els.attachmentsPreview.innerHTML = '';
      return;
    }
    els.attachmentsPreview.classList.remove('hidden');
    els.attachmentsPreview.innerHTML = '';

    pendingFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'preview-item';

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        item.appendChild(img);
      } else {
        item.innerHTML = `<div class="preview-file">${NoteraAttachments.getExt(file.name)}<br>${file.name.slice(0, 12)}</div>`;
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove';
      removeBtn.innerHTML = '×';
      removeBtn.addEventListener('click', () => {
        pendingFiles.splice(idx, 1);
        renderPendingPreview();
        updateSendButton();
      });
      item.appendChild(removeBtn);
      els.attachmentsPreview.appendChild(item);
    });
  }

  // ---------- Search ----------

  function openSearch() {
    searchActive = true;
    els.searchBar?.classList.remove('hidden');
    els.searchInput?.focus();
  }

  function closeSearch() {
    searchActive = false;
    searchResults = null;
    els.searchBar?.classList.add('hidden');
    if (els.searchInput) els.searchInput.value = '';
    els.searchClearBtn?.classList.add('hidden');
    renderMessages();
  }

  async function performSearch(query) {
    if (!query.trim()) {
      searchResults = null;
      renderMessages();
      return;
    }
    try {
      searchResults = await NoteraSearch.search(query);
      renderMessages(searchResults, { highlightQuery: query });
      if (!searchResults.length) {
        showToast('Ничего не найдено');
      }
    } catch (e) {
      showToast('Ошибка поиска: ' + e.message);
    }
  }

  // ---------- Image viewer ----------

  function openImageViewer(url) {
    if (els.viewerImage) els.viewerImage.src = url;
    els.imageViewer?.classList.remove('hidden');
  }

  function closeImageViewer() {
    els.imageViewer?.classList.add('hidden');
    if (els.viewerImage) els.viewerImage.src = '';
  }

  // ---------- Init & events ----------

  function initEvents() {
    // Send
    els.sendBtn?.addEventListener('click', handleSend);
    els.messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    els.messageInput?.addEventListener('input', () => {
      autoResizeInput();
      updateSendButton();
    });

    // Attach
    els.attachBtn?.addEventListener('click', () => els.fileInput?.click());
    els.fileInput?.addEventListener('change', () => {
      if (els.fileInput.files?.length) {
        addFiles(els.fileInput.files);
        els.fileInput.value = '';
      }
    });

    // Drag & drop
    const area = els.messagesArea;
    if (area) {
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
      });
      area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
      });
    }

    // Search
    els.searchBtn?.addEventListener('click', openSearch);
    els.searchCloseBtn?.addEventListener('click', closeSearch);
    els.searchClearBtn?.addEventListener('click', () => {
      if (els.searchInput) els.searchInput.value = '';
      els.searchClearBtn.classList.add('hidden');
      closeSearch();
    });

    let searchTimer;
    els.searchInput?.addEventListener('input', () => {
      const q = els.searchInput.value;
      els.searchClearBtn?.classList.toggle('hidden', !q);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => performSearch(q), 300);
    });

    // Pinned bar
    els.pinnedContent?.addEventListener('click', () => {
      const pinned = NoteraMessages.getPinned();
      if (pinned) scrollToMessage(pinned.id);
    });
    els.unpinBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pinned = NoteraMessages.getPinned();
      if (pinned) {
        try {
          await NoteraMessages.togglePin(pinned.id);
          renderMessages();
        } catch (err) {
          showToast(err.message);
        }
      }
    });

    // Context menu
    els.contextMenu?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || !contextMsgId) return;
      const action = btn.dataset.action;
      const id = contextMsgId;
      hideContextMenu();

      try {
        if (action === 'copy') {
          const msg = NoteraMessages.getById(id);
          if (msg?.content) {
            await navigator.clipboard.writeText(msg.content);
            showToast('Скопировано');
          }
        } else if (action === 'edit') {
          startEdit(id);
        } else if (action === 'pin') {
          await NoteraMessages.togglePin(id);
          renderMessages();
        } else if (action === 'delete') {
          if (confirm('Удалить сообщение?')) {
            await NoteraMessages.remove(id);
            renderMessages();
            showToast('Удалено');
          }
        }
      } catch (err) {
        showToast(err.message);
      }
    });

    document.addEventListener('click', (e) => {
      if (!els.contextMenu?.contains(e.target)) hideContextMenu();
    });

    // Load more
    els.loadMoreBtn?.addEventListener('click', async () => {
      const older = await NoteraMessages.loadOlder();
      if (older.length) {
        renderMessages(NoteraMessages.getAll(), { prepend: false });
        // Keep scroll position roughly
        renderMessages();
      }
    });

    // Infinite scroll up
    els.messagesArea?.addEventListener('scroll', async () => {
      if (els.messagesArea.scrollTop < 80 && NoteraMessages.hasMoreMessages() && !NoteraMessages.isLoadingMessages() && !searchActive) {
        const older = await NoteraMessages.loadOlder();
        if (older.length) {
          renderMessages(NoteraMessages.getAll());
        }
      }
    });

    // Image viewer
    els.viewerClose?.addEventListener('click', closeImageViewer);
    els.imageViewer?.addEventListener('click', (e) => {
      if (e.target === els.imageViewer) closeImageViewer();
    });

    // Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideContextMenu();
        closeImageViewer();
        if (editingId) cancelEdit();
        if (searchActive) closeSearch();
      }
    });
  }

  async function loadAndRender() {
    try {
      await NoteraMessages.loadInitial();
      renderMessages();
    } catch (e) {
      showToast('Не удалось загрузить сообщения');
      console.error(e);
    }
  }

  function handleRealtime(event, payload) {
    if (event === 'INSERT') {
      const msg = payload.new;
      // Attachments may arrive later
      NoteraMessages.upsertFromRealtime({
        ...msg,
        attachments: msg.attachments || []
      });
      if (!searchActive) renderMessages();
    } else if (event === 'UPDATE') {
      NoteraMessages.upsertFromRealtime(payload.new);
      if (!searchActive) renderMessages();
    } else if (event === 'DELETE') {
      NoteraMessages.removeFromRealtime(payload.old.id);
      if (!searchActive) renderMessages();
    }
  }

  function init() {
    cacheEls();
    initEvents();
    updateAvatar();
  }

  return {
    init,
    loadAndRender,
    handleRealtime,
    showToast,
    updateConnectionStatus,
    updateAvatar,
    renderMessages,
    scrollToBottom
  };
})();
