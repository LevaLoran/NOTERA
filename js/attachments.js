/**
 * NOTERA — File attachments & Storage
 */

const NoteraAttachments = (() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/json',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/x-rar-compressed', 'application/x-7z-compressed'
  ];

  const ALLOWED_EXT = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif',
    '.mp4', '.webm', '.mov',
    '.pdf', '.txt', '.md', '.csv', '.json',
    '.zip', '.rar', '.7z', '.doc', '.docx'
  ];

  function getClient() {
    return NoteraSupabase.getClient();
  }

  function getUserId() {
    return NoteraAuth.getUser()?.id;
  }

  function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, error: `Файл «${file.name}» слишком большой (макс. 50 МБ)` };
    }

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.includes(ext) || file.type.startsWith('image/') || file.type.startsWith('video/');

    if (!typeOk) {
      return { ok: false, error: `Тип файла «${file.name}» не поддерживается` };
    }

    return { ok: true };
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function getExt(name) {
    return (name.split('.').pop() || '').toUpperCase().slice(0, 4);
  }

  function isImage(type) {
    return type && type.startsWith('image/');
  }

  function isVideo(type) {
    return type && type.startsWith('video/');
  }

  async function upload(file, onProgress) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    const validation = validateFile(file);
    if (!validation.ok) throw new Error(validation.error);

    const ext = file.name.split('.').pop() || 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const storagePath = `${userId}/${uniqueName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await client.storage
      .from('attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });

    if (uploadError) throw uploadError;

    // Create attachment record (message_id will be set later)
    // We need a temporary message or allow null message_id temporarily.
    // Schema requires message_id NOT NULL. So we create a placeholder message first,
    // or we change approach: create message first, then attach.

    // Better approach used in messages.js: create message, then upload & link.
    // This function returns the storage info; caller creates DB record.

    return {
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size
    };
  }

  async function createRecord(messageId, fileInfo) {
    const client = getClient();
    const userId = getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    const { data, error } = await client
      .from('attachments')
      .insert({
        message_id: messageId,
        user_id: userId,
        file_name: fileInfo.file_name,
        file_type: fileInfo.file_type,
        file_size: fileInfo.file_size,
        storage_path: fileInfo.storage_path
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function getSignedUrl(storagePath, expiresIn = 3600) {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client.storage
      .from('attachments')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }
    return data?.signedUrl || null;
  }

  async function deleteFiles(attachments) {
    const client = getClient();
    if (!client || !attachments?.length) return;

    const paths = attachments.map(a => a.storage_path).filter(Boolean);
    if (paths.length) {
      await client.storage.from('attachments').remove(paths);
    }

    // DB records are cascade-deleted with message, but if called separately:
    const ids = attachments.map(a => a.id).filter(Boolean);
    if (ids.length) {
      await client.from('attachments').delete().in('id', ids);
    }
  }

  async function download(attachment) {
    const url = await getSignedUrl(attachment.storage_path, 60);
    if (!url) throw new Error('Не удалось получить ссылку');

    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return {
    MAX_FILE_SIZE,
    validateFile,
    formatSize,
    getExt,
    isImage,
    isVideo,
    upload,
    createRecord,
    getSignedUrl,
    deleteFiles,
    download
  };
})();
