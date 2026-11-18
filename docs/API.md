# REST API и WebSocket

Базовый префикс: `/api`. Все ответы, кроме файлов и WebSocket, используют JSON. Ошибки имеют вид `{"error":"Текст ошибки"}`.

## Авторизация

`POST /api/auth/register` принимает `{"login":"user123","password":"long-password"}`. Логин содержит 3–32 символа и допускает латиницу, цифры, `_` и `-` без учёта регистра. Пароль содержит минимум 6 символов и занимает не больше 256 байт.

`POST /api/auth/login` принимает тот же JSON.

Оба endpoint устанавливают HttpOnly-cookie и возвращают:

```json
{"user":{"id":"uuid","login":"user123","created_at":"2026-11-17T12:00:00Z"},"csrf_token":"random-token"}
```

`GET /api/auth/me` возвращает те же поля для действующей cookie. `POST /api/auth/logout` завершает только текущую сессию.

Для всех изменяющих авторизованных запросов передавайте заголовок `X-CSRF-Token: <csrf_token>`.

## Записи и файлы

| Метод | URL | Ответ |
|---|---|---|
| GET | `/api/items/stats` | `{all, text, file}` для текущего пользователя |
| GET | `/api/items?page=1` | `{items, total, page, page_size, pages}` |
| GET | `/api/items?page=1&type=text` | Только заметки |
| GET | `/api/items?page=1&type=file` | Только файлы |
| GET | `/api/items/{id}` | Один объект владельца |
| POST | `/api/items/text` | Созданная заметка, 201 |
| POST | `/api/items/file` | Созданный файл, 201 |
| GET | `/api/items/{id}/content` | Встроенное изображение, только JPEG/PNG/WebP |
| GET | `/api/items/{id}/download` | Исходный файл как attachment |

`POST /api/items/text`: `{"text":"Купить кофе"}`.

`POST /api/items/file`: `multipart/form-data`, поле `file` обязательно, `caption` необязательно.

Возвращаемый объект заметки:

```json
{
  "id":"uuid",
  "type":"text",
  "text":"Купить кофе",
  "created_at":"2026-11-17T12:00:00Z"
}
```

Файловый объект содержит `id`, `type: "file"`, `original_filename`, `content_type`, `size`, `caption`, `created_at`. Поле `storage_key` никогда не возвращается наружу.

Доступ по чужому ID возвращает `404`, чтобы не раскрывать факт существования чужого объекта.

## WebSocket

`GET /api/ws` инициирует WebSocket Handshake с обычной session-cookie и проверкой Origin. Клиент не передаёт токен в URL.

После сохранения нового объекта:

```json
{"type":"item.created","item_id":"uuid"}
```

События не являются источником данных и не гарантируют доставку. Получив событие, клиент должен повторить запрос к `/api/items`. После восстановления WebSocket клиент обязан сделать то же самое.
