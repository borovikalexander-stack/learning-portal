# Learning Portal

Корпоративный портал обучения для отделов продаж с разделением ролей: администратор, менеджер, РОП (руководитель отдела продаж).

## Стек

- Next.js 15 (App Router, Server Actions)
- React 18, TypeScript
- PostgreSQL 16 + Prisma 5
- jose (JWT-сессии) + bcryptjs
- Manrope (Google Fonts)
- Lucide иконки
- Kinescope для видео

## Структура

- `/` — личный кабинет менеджера (свои курсы, прогресс)
- `/courses/<slug>` — страница курса
- `/courses/<slug>/lessons/<id>` — страница урока с Kinescope embed
- `/courses/<slug>/test` — итоговый тест курса
- `/courses/<slug>/lessons/<id>/test` — тест к уроку
- `/profile` — профиль пользователя (имя, аватар, пароль)
- `/team` — дашборд РОП (только свой отдел)
- `/team/managers`, `/team/applications`, `/team/review` — управление командой РОП
- `/admin` — аналитический дашборд админа (вся компания)
- `/admin/users`, `/admin/courses`, `/admin/review` — администрирование
- `/login`, `/register` — auth

## Роли

- **MANAGER** — менеджер отдела продаж. Видит назначенные курсы, проходит уроки и тесты.
- **ROP** — руководитель отдела. Видит аналитику и менеджеров своего отдела, одобряет заявки, назначает курсы вручную, проверяет открытые ответы тестов.
- **ADMIN** — администратор портала. Полный CRUD по курсам/урокам/тестам, аналитика по всей компании, управление пользователями, проверка ответов.
- **CURATOR** — зарезервированная роль для будущего расширения. Через UI не управляется.

В Prisma enum UserRole сейчас 4 значения: ADMIN, MANAGER, ROP, CURATOR.
Через UI можно повышать любого пользователя до ADMIN. Любой ADMIN может удалить
любого пользователя кроме самого себя. CURATOR остаётся зарезервированной ролью
без UI-управления.

## Отделы

В seed создаются: `Автоподбор`, `Импорт`, `Сопровождение`. Можно добавлять новые через psql или Prisma Studio.

## Локальный запуск

```bash
npm install
cp .env.example .env
# отредактируй DATABASE_URL под локальный Postgres (host=localhost)
docker compose up -d postgres   # либо запусти Postgres локально другим способом
npx prisma migrate dev
npm run db:seed
npm run dev
```

Открыть: http://localhost:3000

### Тестовые доступы

После seed:
- Админ: `admin@company.ru` / `portal12345`
- Менеджер: `alex@company.ru` / `portal12345`

## База данных

`src/lib/db.ts` — singleton Prisma. Все сервисы помечены `import "server-only"`. Миграции в `prisma/migrations/`.

## Дизайн-система

Light тема с акцентным lime `#00C896`. Дополнительные палитры:
- accent (lime) — главные действия
- blue `#A8E0FF` — информационные карточки
- yellow `#FAF595` — KPI/предупреждения
- surface-strong `#111111` — тёмные карточки и кнопки

Базовые компоненты: `.card`, `.btn-{primary,accent,secondary,ghost,danger}`, `.badge-*`, `.input`, `.data-table`, `.kpi.{accent,dark,blue,yellow}`, `.dept-card`.

Sidebar:
- Manager — светлый (`PortalSidebar`)
- ROP / Admin — тёмный (`RopSidebar` / `AdminSidebar`)

## Тестирование (учебные тесты)

В системе есть тесты двух типов:
- **Тест к уроку** (`Test.lessonId`) — обязателен для завершения урока. Если не сдан, следующий урок заблокирован.
- **Итоговый тест** (`Test.lessonId = null`) — открывается после прохождения всех уроков курса.

4 типа вопросов: SINGLE_CHOICE, MULTIPLE_CHOICE, TEXT (ручная проверка), MATCHING.

Авто-оценка: SINGLE/MULTIPLE/MATCHING. TEXT → PENDING ручной проверки админом/РОПом.

Поле `Test.timeLimitMins` зарезервировано в схеме, серверная проверка времени не реализована.

После первой попытки структура теста блокируется (нельзя добавлять/менять/удалять вопросы). Чтобы изменить — удалить тест целиком (это снесёт все попытки).

## Деплой на VPS

### Первый запуск

1. Установи Docker и docker compose.
2. Склонируй репозиторий.
3. Создай `.env` на основе `.env.example`:
   - `POSTGRES_PASSWORD` — крепкий пароль
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL` — публичный URL
4. Запусти:

```bash
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed   # только первый раз
```

5. Поставь nginx/Caddy впереди для HTTPS.

### Бэкапы

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh    # вручную
# или crontab:
# 0 3 * * * cd /path/to/learning-portal && ./scripts/backup-db.sh
```

Хранит последние 14 копий в `./backups/`.

## Команды

- `npm run dev` — локальная разработка
- `npm run build` — production-сборка
- `npm run lint` — ESLint
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:seed` — наполнить демо-данные
- `npm run db:reset-content` — обнулить пользователей и контент перед боевым запуском
- `npm run db:generate` — `prisma generate`

### Обнуление контента

Скрипт `npm run db:reset-content` удаляет:
- Всех пользователей (включая ADMIN, ROP, MANAGER)
- Все курсы, уроки, тесты, попытки, прогресс
- Все файлы аватаров из `public/uploads/avatars/`

После обнуления создаёт единственного администратора `ditecs@yandex.ru` / `Inputoutput`.

**⚠️ Внимание:** операция необратимая. Отделы (Departments) сохраняются.

```bash
npm run db:reset-content
```

После запуска все ранее залогиненные пользователи становятся невалидными — старые cookie очищаются при первом заходе на /login.

## Лицензия

Internal.
