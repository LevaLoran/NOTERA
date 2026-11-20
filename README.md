# NOTERA

**Личный чат с самим собой** — заметки, фотографии, файлы и всё, что важно.

Минималистичное веб-приложение в духе Telegram Saved Messages. Один чат на пользователя, облачное хранение через Supabase, синхронизация между устройствами, PWA.

Стек: **HTML5 · CSS3 · Vanilla JavaScript · Supabase**

---

## Возможности

- Регистрация / вход по email + пароль
- Вход через GitHub OAuth
- Восстановление пароля и подтверждение email
- Текстовые сообщения (многострочные)
- Редактирование, удаление, копирование, закрепление
- Вложения: изображения, видео, PDF, документы, архивы
- Предпросмотр фото, полноэкранный просмотр
- Drag & Drop файлов
- Поиск по тексту сообщений и именам файлов
- Закреплённые сообщения
- Realtime-синхронизация (несколько устройств)
- Подгрузка истории при прокрутке вверх
- PWA (установка на телефон / рабочий стол)
- Полностью адаптивный интерфейс

---

## Быстрый старт

### 1. Создайте проект Supabase

1. Зайдите на [supabase.com](https://supabase.com) и создайте новый проект.
2. Дождитесь готовности базы.
3. В **Project Settings → API** скопируйте:
   - **Project URL**
   - **anon public** ключ

### 2. Выполните SQL-схему

1. Откройте **SQL Editor** в Supabase.
2. Скопируйте содержимое файла `supabase/schema.sql`.
3. Выполните скрипт (Run).

Скрипт создаёт таблицы `profiles`, `messages`, `attachments`, индексы, RLS-политики, триггеры и включает Realtime.

### 3. Создайте Storage Bucket

1. Перейдите в **Storage**.
2. Создайте bucket с именем **`attachments`**.
3. Сделайте его **Private** (не Public).
4. Перейдите в **Policies** для этого bucket и добавьте политики:

```sql
-- Загрузка только в свою папку (user_id)
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 4. Настройте Authentication

#### Email

1. **Authentication → Providers → Email** — включите.
2. Рекомендуется включить **Confirm email** (для продакшена).
3. В **URL Configuration** укажите Site URL вашего приложения (например `https://username.github.io/NOTERA/`).
4. Добавьте Redirect URLs:
   - `https://username.github.io/NOTERA/`
   - `https://username.github.io/NOTERA/index.html`
   - `http://localhost:5500/` (для локальной разработки)

#### GitHub OAuth

1. Создайте OAuth App на GitHub:  
   [GitHub → Settings → Developer settings → OAuth Apps → New](https://github.com/settings/developers)
2. **Homepage URL**: `https://username.github.io/NOTERA`
3. **Authorization callback URL**:  
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Скопируйте Client ID и Client Secret.
5. В Supabase: **Authentication → Providers → GitHub** — включите и вставьте Client ID / Secret.

### 5. Настройте config.js

```bash
cp config.example.js config.js
```

Откройте `config.js` и подставьте:

```js
window.NOTERA_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  SITE_URL: 'https://username.github.io/NOTERA/'  // или оставьте автоопределение
};
```

> **Важно:** anon-ключ предназначен для использования в клиенте. Безопасность обеспечивается Row Level Security.

### 6. Локальный запуск

Откройте `index.html` через любой статический сервер (не через `file://`):

```bash
# Python
python -m http.server 5500

# или Node
npx serve .
```

Откройте `http://localhost:5500`.

### 7. Публикация на GitHub Pages

1. Создайте репозиторий на GitHub (например `NOTERA`).
2. Загрузите все файлы проекта (включая `config.js` с вашими ключами, если репозиторий приватный; для публичного — можно оставить ключи, anon key публичный по дизайну Supabase).
3. В репозитории: **Settings → Pages**.
4. Source: **Deploy from a branch** → ветка `main` / `master` → папка `/ (root)`.
5. Сохраните. Через 1–2 минуты сайт будет доступен по адресу:
   `https://username.github.io/NOTERA/`

6. Вернитесь в Supabase → Authentication → URL Configuration и обновите Site URL / Redirect URLs на адрес GitHub Pages.

### 8. Проверка синхронизации

1. Откройте приложение в двух браузерах / на телефоне и компьютере.
2. Войдите под одним аккаунтом.
3. Отправьте сообщение на одном устройстве — оно должно появиться на втором без перезагрузки.

---

## Структура проекта

```
NOTERA/
├── index.html              # Главная страница
├── manifest.json           # PWA манифест
├── sw.js                   # Service Worker
├── config.example.js       # Пример конфигурации
├── config.js               # Ваша конфигурация (создайте из example)
├── README.md
├── css/
│   ├── style.css           # Основные стили
│   ├── auth.css            # Экран авторизации
│   └── responsive.css      # Адаптивность
├── js/
│   ├── app.js              # Точка входа
│   ├── supabase.js         # Инициализация клиента
│   ├── auth.js             # Авторизация
│   ├── chat.js             # UI чата
│   ├── messages.js         # CRUD сообщений
│   ├── attachments.js      # Файлы и Storage
│   ├── search.js           # Поиск
│   ├── sync.js             # Realtime
│   └── settings.js         # Настройки
├── assets/
│   ├── logo.svg
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── supabase/
    └── schema.sql          # SQL-схема
```

---

## Безопасность

- Используется только **anon key** (publishable). Service role key в клиентский код не попадает.
- На всех таблицах включён **Row Level Security**: пользователь видит и меняет только свои данные.
- Файлы в Storage лежат в папках вида `{user_id}/...` и доступны только владельцу.
- Service Worker кэширует только статику, никогда — сообщения и файлы.

---

## Ограничения и заметки

- Максимальный размер файла: **50 МБ** (можно изменить в `js/attachments.js`).
- Поддерживаемые типы: изображения, видео (mp4/webm), PDF, txt, md, csv, json, zip, rar, 7z, doc/docx.
- При включённом подтверждении email пользователь должен подтвердить почту перед входом.
- Для GitHub OAuth callback URL обязательно должен указывать на Supabase (`...supabase.co/auth/v1/callback`).

---

## Лицензия

MIT — делайте с проектом что хотите.

---

Сделано с вниманием к деталям. Наслаждайтесь своим личным пространством.
