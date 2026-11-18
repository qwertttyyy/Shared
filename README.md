# Shared

Личное веб-хранилище заметок и файлов с синхронизацией между устройствами.

Записи доступны только владельцу аккаунта. Заметки и файлы хранятся в одной ленте, которая обновляется через WebSocket. Можно прикрепить несколько файлов за раз, скачать их и открыть изображения JPEG, PNG и WebP прямо в браузере. Лимит по умолчанию — 25 МиБ на файл.

Заметки и метаданные файлов хранятся в PostgreSQL, содержимое файлов — в отдельном томе Docker при запуске через Compose.

**Стек** — React, TypeScript, Vite, TanStack Query, Go (`net/http`, chi и `coder/websocket`), PostgreSQL, GORM, Goose, Docker Compose и Nginx.

## Быстрый запуск

Понадобятся Docker и Docker Compose. Из корня проекта запустите PostgreSQL, Go API и Vite.

```bash
docker compose -f docker-compose.local.yml up -d --build
```

Откройте **http://localhost:5173** и зарегистрируйтесь. При первом запуске хватает встроенных настроек, а API применяет миграции автоматически. Для существующего тома PostgreSQL сохраните его `POSTGRES_DB`, `POSTGRES_USER` и `POSTGRES_PASSWORD` в корневом `.env`.

Проверить API можно через Vite. Smoke-тест использует Bash, `curl` и Python 3 и создаёт тестовые аккаунты, заметку и файл.

```bash
curl -fsS http://localhost:5173/api/health
bash scripts/smoke.sh
```

Команда `docker compose -f docker-compose.local.yml down` останавливает сервисы и сохраняет тома.

## Локальная разработка

Для запуска Go и Vite напрямую нужны Go 1.25+, Node.js 22+ и запущенный PostgreSQL. Скопируйте [`backend/.env.example`](backend/.env.example) в `backend/.env` и укажите свой `DATABASE_URL`. При необходимости настройте порт Vite и адрес API в `frontend/.env` по [шаблону](frontend/.env.example).

```bash
# Терминал 1 — backend
cd backend
go run ./cmd/server
```

```bash
# Терминал 2 — frontend
cd frontend
npm ci
npm run dev
```

По умолчанию Vite работает на `http://localhost:5173` и направляет `/api` и WebSocket на `http://localhost:8080`. Если измените адрес страницы, обновите `PUBLIC_ORIGIN` в `backend/.env`. В Windows PowerShell команды `npm` можно запускать через `npm.cmd`.

Тесты API запускаются командой `go test ./...` из `backend`, проверка сборки интерфейса — командой `npm run build` из `frontend`.

## Развёртывание в prod

Системный Nginx раздаёт сборку из `/var/www/shared` и проксирует `/api` и WebSocket на `127.0.0.1:18080`. Go API и PostgreSQL работают в Docker Compose. База доступна внутри Docker-сети.

Скопируйте [`.env.prod.example`](.env.prod.example) в `.env.prod`. Укажите `PUBLIC_ORIGIN` с `https://` и задайте `POSTGRES_PASSWORD`, например результат `openssl rand -hex 32`. Для существующего тома используйте его текущие учётные данные и имя проекта Compose.

```bash
chmod 600 .env.prod
bash scripts/deploy.sh
```

Скрипт собирает интерфейс через Docker Buildx, запускает сервисы из `docker-compose.prod.yml` и публикует сборку после проверки готовности API.

При первом развёртывании установите [конфиг Nginx](deploy/nginx/shared.conf). Если сайт уже настроен, обновите его конфиг с сохранением настроек TLS. При смене порта API сопоставьте `API_HOST_PORT` с `proxy_pass`.

```bash
sudo install -m 0644 deploy/nginx/shared.conf /etc/nginx/sites-available/shared
sudo ln -s /etc/nginx/sites-available/shared /etc/nginx/sites-enabled/shared
sudo nginx -t && sudo systemctl reload nginx
```

Когда DNS указывает на сервер и открыты порты 80 и 443, выпустите сертификат через Certbot с плагином Nginx и проверьте API. Для другого домена замените `shared.qwertttyyy.ru` в `PUBLIC_ORIGIN`, `server_name` и командах ниже.

```bash
sudo certbot --nginx --redirect -d shared.qwertttyyy.ru
curl -fsS https://shared.qwertttyyy.ru/api/health
```

Для обновлений выполняйте `git pull --ff-only` и `bash scripts/deploy.sh` в той же рабочей копии. Резервная копия данных должна включать PostgreSQL и том `uploads`.

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [HTTP API и WebSocket](docs/API.md)
- [Как изучать backend](docs/LEARNING_PATH.md)
