# Аудит проекта до текущего этапа

Дата: 2026-05-28
Окружение: Windows, Node ≥18, PostgreSQL 16 локально (`learning_portal`), Next.js 15.5.18, Prisma 5.22.

## 1. Краткий вывод

Проект в **рабочем состоянии**. Все ключевые слои собраны: схема БД, миграции, авторизация, RBAC (ADMIN/MANAGER/ROP), регистрация-заявка, CRUD курсов/уроков/тестов, прохождение тестов менеджером с авто-оценкой, очередь ручной проверки, аналитика для админа и РОП, профиль с аватарами, дизайн-система.

`npm run build` зелёный. ESLint выдаёт **2 warnings** (неиспользуемые параметры в `_prev`/`_formData` — non-blocking).

Что закрыто плохо или не закрыто:
- **Lesson test progression — не строгая**: если `LessonProgress.isCompleted=true` стоит от прошлой ручной отметки, следующий урок разблокируется без сдачи теста.
- **Email-нотификации**: SMTP_* поля есть в `.env.example`, но никакой отправки в коде нет.
- **CURATOR role** — есть в enum, но не используется нигде (мёртвый код).
- **Legacy demo code** в `src/lib/services/*` и `src/lib/domain.ts` — больше не импортируется, орфаны.
- **Production deployment**: Dockerfile/docker-compose есть, но не протестированы; бэкап-скрипт только для Windows (`scripts/backup-db.ps1`).
- **Mobile** — отдельных проверок на 375px не делали (декларирован базовый адаптив через `@media`).

Готовность к деплою: **MVP функционально достаточен**, но нужно несколько недостатков заклеить перед production (см. раздел 6 → High).

---

## 2. Проверенные источники требований

- `README.md` — высокоуровневая декларация (минимальная, отстаёт от факта).
- `prisma/schema.prisma` — модели и enum'ы.
- `prisma/migrations/` — 4 миграции: `init`, `add_rop_role`, `add_lesson_tests`, `add_avatar_url`.
- `prisma/seed.ts` — стартовые данные.
- Архитектурный план из исходного диалога (План архитектуры обучающего портала).
- Структура `src/app/*` (маршруты) и `src/lib/*` (сервисы и server-actions).
- `.env.example` — переменные конфигурации.
- `package.json` — зависимости и скрипты.
- `middleware.ts` — гейтинг `/admin/*`.

---

## 3. Чеклист запланированных функций

| Функция / опция | Статус | Где реализовано | Проверка работы | Проблемы / замечания |
|---|---|---|---|---|
| **Foundation** | | | | |
| PostgreSQL подключён | ✅ | `prisma/schema.prisma`, `.env`, `src/lib/db.ts` | psql `\dt` — 13 таблиц, миграции применены | — |
| Prisma singleton | ✅ | `src/lib/db.ts` | компилируется, используется везде | — |
| Миграции | ✅ | `prisma/migrations/*` | 4 миграции, последняя `add_avatar_url` | seed.ts использует upsert — безопасен |
| Cookie-сессии jose | ✅ | `src/lib/auth/session.ts` | createSession/getSession/destroy + requireSession/requireAdmin | — |
| Middleware гейтинг /admin/* | ✅ | `middleware.ts` | matcher только /admin/:path* | НЕ режет `/team/*` — это OK, защита в pages |
| **Auth & access** | | | | |
| Login form | ✅ | `src/app/login/*`, `src/lib/auth/actions.ts` | bcrypt-compare, role-based redirect (ADMIN→/admin, ROP→/team, иначе→/) | — |
| Logout | ✅ | `logoutAction` в `actions.ts` | destroySession + redirect /login | — |
| Регистрация-заявка | ✅ | `src/app/register/*`, `src/lib/auth/registration.ts` | Динамические отделы из БД (Автоподбор/Импорт/Сопровождение) | — |
| Одобрение/отклонение заявки | ✅ | `src/lib/admin/users.ts` (approve/reject) + `/admin/users#applications` | approve назначает DEPARTMENT_DEFAULT курсы | ROP-версия в `src/lib/rop/users.ts` |
| Смена роли (MANAGER↔ROP) | ✅ | `updateUserRoleAction` + `/admin/users/[id]` | защита от смены ADMIN, защита от saml-роль | CURATOR не смещается через UI |
| Смена отдела | ✅ | `updateUserDepartmentAction` | автопересборка DEPARTMENT_DEFAULT-доступов, MANUAL_GRANT сохраняется | — |
| Блок/анблок | ✅ | `blockUserAction`/`unblockUserAction` + ROP-версии | — | — |
| Удаление пользователя | ✅ | `deleteUserAction` | каскад: AnswerAttempt → TestAttempt → LessonProgress → Enrollment → CourseAccess → User + удаление файла аватара | админ удалить нельзя, себя удалить нельзя |
| **Manager portal** | | | | |
| Личный кабинет (dashboard) | ✅ | `src/app/(portal)/page.tsx`, `src/lib/portal/dashboard.ts` | KPI + список курсов из CourseAccess | — |
| Страница курса | ✅ | `(portal)/courses/[slug]/page.tsx`, `getCourseDetail` | список уроков + статусы (locked/done/open), блок «Итоговый тест» | — |
| Страница урока | ✅ | `(portal)/courses/[slug]/lessons/[lessonId]/page.tsx`, `getLessonDetail` | Kinescope iframe, прогресс справа, кнопка «Пройти тест» если есть тест | layout: minmax(0, 2fr) / minmax(280px, 1fr) |
| Отметка прохождения урока | ✅ | `markLessonCompleteAction` + `markLessonComplete` | upsert LessonProgress + пересчёт Enrollment.progress | — |
| Последовательная разблокировка | 🟡 | `getLessonDetail` LOCKED check | проверяет только LessonProgress предыдущего урока | НЕ учитывает что у предыдущего урока есть тест — если LessonProgress.isCompleted=true но тест не сдан, следующий урок открыт |
| Прохождение теста | ✅ | `(portal)/courses/[slug]/test/page.tsx` + lesson вариант | `TestRunner.tsx`, 4 типа вопросов | — |
| Auto-scoring | ✅ | `src/lib/portal/testing.ts` `isCorrectAnswer` | SINGLE/MULTIPLE/MATCHING auto, TEXT → PENDING | — |
| Сохранение попытки | ✅ | `submitTestAttempt` в транзакции | TestAttempt + AnswerAttempt[] | — |
| Учёт maxAttempts | ✅ | проверка перед созданием attempt | — | — |
| Страница результата | ✅ | `test/results/[attemptId]/page.tsx` + `AttemptResultView.tsx` | разбор каждого ответа с реальным/правильным | — |
| Авто-завершение урока при сдаче теста | ✅ | `markLessonCompletedOnPass` | upsert LessonProgress=true + пересчёт Enrollment | — |
| Авто-завершение курса при сдаче итогового | ✅ | `markCourseCompletedOnFinalPass` | Enrollment.completedAt + progress=100 (если все уроки done) | — |
| **Profile (все роли)** | | | | |
| /profile (Manager/ROP) | ✅ | `(portal)/profile/page.tsx`, `ProfileEditor.tsx` | имя, email (read-only), пароль, аватар | ADMIN с /profile → /admin/profile |
| /admin/profile | ✅ | `admin/profile/page.tsx` | то же что выше | — |
| Аватары | ✅ | `uploadAvatarAction`, `removeAvatarAction` в `auth/profile.ts` | сохранение в `public/uploads/avatars/`, удаление при удалении пользователя | лимит 3 МБ, типы JPG/PNG/WEBP, имя `{userId}-{ts}.{ext}` |
| Смена пароля | ✅ | `changePasswordAction` | bcrypt-compare текущего, min 8 символов, confirm | — |
| **Admin** | | | | |
| /admin dashboard | ✅ | `admin/page.tsx`, `analytics.ts` | period filter (7/30/90/всё + custom range), KPI с чипами по отделам, dept-cards, 14-day stacked chart, top/worst курсы, зависшие, лента | — |
| /admin/users — список | ✅ | `admin/users/page.tsx` | фильтры по статусу/отделу/поиску, заявки, действия в строке | — |
| /admin/users/[id] | ✅ | `admin/users/[userId]/page.tsx` | профиль, KPI, прогресс по курсам, история, настройки (role/dept), управление доступом | settings-row layout новый |
| /admin/courses | ✅ | `admin/courses/page.tsx` | группировка DRAFT/PUBLISHED/ARCHIVED, accent-dot, table-actions | — |
| /admin/courses/new + /admin/courses/[id] | ✅ | `courses.ts` actions | секционная форма, color-picker, lesson list, reorder | — |
| Lesson editor | ✅ | `lessons/[lessonId]/page.tsx`, `lessons.ts` actions | свойства, attachments, lesson test card | — |
| Test editor | ✅ | `test/page.tsx`, `tests.ts` actions, `QuestionForm.tsx` | 4 типа вопросов, reorder, edit, delete | — |
| Lesson test (один на урок) | ✅ | миграция `add_lesson_tests` + Test.lessonId unique | createTestAction поддерживает lessonId | — |
| /admin/review | ✅ | `admin/review/page.tsx`, `review.ts` | очередь PENDING text ответов, approve/reject + comment | — |
| **ROP role** | | | | |
| /team dashboard | ✅ | `(portal)/team/page.tsx`, `rop/analytics.ts` | период-фильтр, KPI, активность, топ/худшие курсы, зависшие, лента | scoped к ropUser.departmentId |
| /team/managers | ✅ | `team/managers/page.tsx` | фильтры status/поиск, блок/анблок | scoped |
| /team/managers/[id] | ✅ | `team/managers/[userId]/page.tsx` | drill-down с настройками доступов | scoped |
| /team/applications | ✅ | `team/applications/page.tsx` | заявки своего отдела | scoped |
| /team/review | ✅ | `team/review/page.tsx` | проверка открытых ответов своего отдела | scoped |
| ROP actions | ✅ | `src/lib/rop/users.ts` | approveByROP/rejectByROP/block/unblock/grant/revoke с проверкой dept | — |
| **Дизайн-система** | | | | |
| Токены, Manrope, базовые компоненты | ✅ | `globals.css` | `--accent`, `--accent-blue`, `--accent-yellow`, `--surface-strong`, радиусы, тени | — |
| Иконочные сайдбары (Manager/Admin/ROP) | ✅ | `AppSidebar.tsx`, `AdminSidebar.tsx`, `RopSidebar.tsx`, `PortalSidebar.tsx` | dark variant для admin и rop | — |
| Breadcrumbs | ✅ | `PageHeader.tsx` prop `breadcrumbs` | используются в глубоких страницах | — |
| Avatar | ✅ | `components/ui/Avatar.tsx` | fallback на инициалы | используется в feed, sidebar footer, manager drill-down |
| **Departments** | | | | |
| 3 отдела (Автоподбор/Импорт/Сопровождение) | ✅ | `seed.ts` upsert + БД | psql: 3 строки | — |
| Динамическая регистрация | ✅ | `register/page.tsx` загружает из БД | — | — |

---

## 4. Проверка пользовательских сценариев

| Сценарий | Статус | Что проверено | Замечания |
|---|---|---|---|
| Регистрация → одобрение → логин менеджера | ✅ | UI form + approveUserAction + logout/login | — |
| Регистрация → отклонение | ✅ | rejectUserAction → BLOCKED | — |
| Login admin → /admin | ✅ | role-based redirect в loginAction | — |
| Login ROP → /team | ✅ | role-based redirect | — |
| Login MANAGER → / | ✅ | role-based redirect | — |
| Admin меняет роль MANAGER↔ROP | ✅ | updateUserRoleAction, защита от ADMIN/SELF | — |
| Admin меняет отдел | ✅ | updateUserDepartmentAction, пересборка DEFAULT-доступов | — |
| Admin блок/анблок/удаление | ✅ | actions + защиты | — |
| Admin создаёт курс → урок → публикует | ✅ | через UI | — |
| Admin создаёт тест к уроку | ✅ | createTestAction с lessonId | — |
| Admin создаёт итоговый тест курса | ✅ | createTestAction с lessonId=null | — |
| Admin добавляет 4 типа вопросов | ✅ | QuestionForm.tsx | — |
| Менеджер открывает курс → урок → видео | ✅ | Kinescope iframe | — |
| Менеджер отмечает урок (без теста) | ✅ | markLessonCompleteAction | — |
| Менеджер сдаёт lesson-тест | ✅ | submitTestAttempt → авто-завершение урока | проблема: см ниже |
| Менеджер сдаёт итоговый тест | ✅ | submitTestAttempt → Enrollment.completedAt | требует прохождения всех уроков |
| Admin/ROP проверяет открытый ответ | ✅ | reviewAnswerAction → пересчёт TestAttempt | — |
| Menager блокируется при попытке /admin/* | ✅ | middleware → /login или / | — |
| ROP блокируется при попытке /admin/* | ✅ | middleware пускает только ADMIN | — |
| Manager блокируется на /team/* | ✅ | requireSession + role check в каждой странице | — |
| ROP видит только своих менеджеров | ✅ | scoped queries по departmentId | — |
| ROP не может действовать на чужого менеджера | ✅ | `assertRopAndScope` бросает ошибку | — |
| Загрузка аватара | ✅ | uploadAvatarAction, multipart | старый файл удаляется |
| Удаление пользователя удаляет аватар-файл | ✅ | в deleteUserAction inline-функция | — |
| **Lesson unlock с тестом** | 🟡 | `getLessonDetail` проверяет previous.LessonProgress.isCompleted | НЕ учитывает passed-флаг теста предыдущего урока |

---

## 5. Проверка архитектуры

### UI

- App Router Next.js 15, route groups: `(portal)`, без RSC/CSR-конфликтов.
- Client islands только где нужно (`TestRunner`, `LoginForm`, `RegisterForm`, `QuestionForm`, `ProfileEditor`, sidebar components с `usePathname`).
- PageHeader общий с breadcrumbs.
- 3 sidebar-варианта: `PortalSidebar` (Manager, светлый), `AdminSidebar` (Admin, тёмный), `RopSidebar` (ROP, тёмный) — переключаются в `(portal)/layout.tsx` по role.

### API / Server actions

Все действия — Server Actions, маркеры `"use server"`. Файлы:
- `src/lib/auth/{actions,registration,profile}.ts`
- `src/lib/admin/{users,courses,lessons,access,tests,review}.ts`
- `src/lib/portal/actions.ts`
- `src/lib/rop/users.ts`

Каждый action начинается с `requireSession`/`requireAdmin` либо собственной scope-проверки (ROP).

### Services / business logic

- `src/lib/auth/session.ts` — JWT через jose.
- `src/lib/portal/dashboard.ts`, `learning.ts`, `testing.ts` — read-side для менеджера.
- `src/lib/admin/analytics.ts`, `src/lib/rop/analytics.ts` — аналитика.
- `src/lib/admin/review.ts` — review + пересчёт TestAttempt.
- Все маркированы `import "server-only"`.

### Database

- Prisma 5.22, PostgreSQL 16 локально (`learning_portal` БД, `postgres` user).
- 12 моделей: Department, User, Course, Lesson, LessonAttachment, CourseAccess, Enrollment, LessonProgress, Test, Question, TestAttempt, AnswerAttempt.
- Все индексы и каскады прописаны (unique constraints, onDelete: Cascade).

### Migrations

4 миграции, применены в порядке:
1. `20260526075628_init`
2. `20260527053651_add_rop_role`
3. `20260527090000_add_lesson_tests` (Test.lessonId UNIQUE)
4. `20260527132624_add_avatar_url`

### Tests

**Автоматических тестов нет** (ни unit, ни integration, ни e2e). В `package.json` нет test-runner'а.

### Config

- `.env`: DATABASE_URL (postgres@localhost), AUTH_SECRET (real 64-hex), NEXT_PUBLIC_APP_URL, KINESCOPE_EMBED_BASE_URL, SMTP_* (пустые).
- `next.config.mjs` (не открывали — стандартный).
- `eslint.config.mjs` — Next defaults.
- TypeScript strict.

### Error handling

- Server actions — throw на нарушения scope, ловятся Next и показывают 500-страницу (нет красивого error.tsx).
- Auth errors — возвращаются в form state и показываются в UI (badge-danger).
- В `getLessonDetail` бросаются строковые ошибки `"NO_ACCESS"`/`"LOCKED"` — каждая страница ловит и редиректит.
- Зод-валидация в формах регистрации/профиля.

---

## 6. Найденные проблемы

### Critical

Нет critical-багов, блокирующих работу.

### High

#### H1. Lesson unlock не учитывает обязательность теста
**Файл:** `src/lib/portal/learning.ts` → `getLessonDetail`
**Проблема:** проверка LOCKED строится только на `LessonProgress.isCompleted` предыдущего урока. Если предыдущий урок имел тест и был помечен пройденным (вручную ранее или авто), а тест не сдан — это всё равно разблокирует следующий.
**Почему важно:** нарушает заявленную бизнес-логику «урок завершается прохождением теста».
**Как исправить:** при наличии test у предыдущего урока — проверять ещё и `TestAttempt.passed=true` для этого теста и текущего userId.

#### H2. Production deployment не протестирован
**Файлы:** `Dockerfile`, `docker-compose.yml`
**Проблема:** контейнерная сборка скорее всего работает, но не проверена. Бэкап-скрипт `scripts/backup-db.ps1` — только PowerShell, на Linux VPS не запустится.
**Как исправить:** прогнать `docker compose up -d --build` на чистом VPS, добавить `backup-db.sh`.

#### H3. Email-нотификации не отправляются
**Файлы:** `.env.example` имеет SMTP_*, но интеграции нет
**Проблема:** при одобрении заявки менеджер не узнаёт; при PENDING-ответе админ не получает уведомления.
**Как исправить:** интегрировать nodemailer или transactional API (Resend), отправлять при approve/reject/новый PENDING.

### Medium

#### M1. CURATOR role — мёртвый код
**Файл:** `prisma/schema.prisma` enum UserRole
**Проблема:** значение `CURATOR` в enum существует, но нигде в UI/actions не используется. Кодекс в `session.ts` валидирует payload.role как один из 4-х, но кода под curator нет.
**Как исправить:** либо удалить из enum (нужна миграция), либо реализовать функционал.

#### M2. Legacy demo-код
**Файлы:** `src/lib/services/access.ts`, `analytics.ts`, `testing.ts` + `src/lib/domain.ts`
**Проблема:** старые сервисы с lowercase-типами (`"single" | "multiple" | "text" | "matching"`), не используются нигде. Импортируют `domain.ts`, который тоже орфан. Подтверждено через `grep -r "@/lib/services" src/` — 0 совпадений.
**Как исправить:** удалить файлы.

#### M3. Lint warnings
**Файл:** `src/lib/auth/profile.ts:163`
**Проблема:** `removeAvatarAction(_prev, _formData)` — оба параметра помечены underscore (договорённость — не использовать), но ESLint ругается.
**Как исправить:** либо переименовать в `prev`/`formData`, либо добавить eslint-disable-next-line для этой строки, либо настроить правило игнорировать `_*`.

#### M4. Нет автоматических тестов
**Проблема:** ноль unit/integration/e2e тестов. Регрессии не отлавливаются.
**Как исправить:** хотя бы smoke-тесты на критические server-actions через vitest + prisma-test-environment, или playwright e2e на login → курс → урок → тест.

#### M5. Нет error.tsx и not-found.tsx
**Проблема:** ошибки server-actions показывают Next дефолтную 500-страницу. Throw'и `"NO_ACCESS"` ловятся в pages, но если новая страница забудет ловить — будет голый 500.
**Как исправить:** добавить корневой `src/app/error.tsx` и `not-found.tsx` с дизайном системы.

#### M6. README устарел
**Файл:** `README.md`
**Проблема:** упоминает «два отдела Автоподбор и Импорт» (а их 3), «glassmorphism» (сменили на light-flat), отсутствуют РОП, тесты, профиль, аватары.
**Как исправить:** переписать.

### Low

#### L1. Дублирование вспомогательных функций
- `formatDate`, `lastActivityText`, `relativeTime`, `maxDate`, `average`, `daysAgo` — повторяются по 2-4 раза в разных файлах (admin/users, admin/page, team/page, etc.).
- Должны быть в `src/lib/utils/date.ts` или подобном.

#### L2. Большой ManagerDashboard.tsx и CourseCard.tsx — но не критично
- Файлы умеренного размера, читаются.

#### L3. Mobile-проверка не делалась
- Декларирован адаптив через media queries, но никто не пощупал на 375px.

#### L4. Loading states
- Нет `loading.tsx` / Suspense skeleton'ов. При тяжёлых запросах user видит белый экран.

#### L5. KINESCOPE_EMBED_BASE_URL не валидируется
- Если переменная не задана в `.env`, fallback в `LessonDetail` рендерит «Видео не загружено», но это same UX как реально не загруженное видео. Лучше отдельная ошибка конфигурации.

#### L6. CSS-файл globals.css вырос до 2100+ строк
- В одном файле всё. Не плохо для MVP, но к prod-этапу стоит разнести по модулям или перейти на CSS-Modules / Tailwind v4 / vanilla-extract.

#### L7. Нет логирования
- Console.error в catch-блоках, но нет структурированных логов и nothing типа Sentry. Для прода нужен logger.

---

## 7. Что сделано полностью

- Auth (jose + cookie + middleware + role-based redirect)
- Регистрация-заявка + 3-ролевая модерация (admin/ROP/auto-block)
- Manager portal: dashboard, course, lesson, lesson-test, course-final-test, results
- Авто-оценка SINGLE/MULTIPLE/MATCHING, manual review для TEXT
- Admin: full dashboard analytics, users CRUD-light (no create, but full edit), courses/lessons/tests editor, review queue
- ROP: scoped dashboard, managers list/drill-down, applications, review queue
- 3 отдела, динамическая регистрация и фильтры
- Профиль для всех ролей: avatar upload, name change, password change
- Дизайн-система: токены, Manrope, иконочные сайдбары, breadcrumbs, KPI с разноцветной палитрой, period-filter, dept-cards, activity chart, top/worst, feed
- Каскад удаления: User → AnswerAttempt → TestAttempt → LessonProgress → Enrollment → CourseAccess → avatar file
- Build зелёный

---

## 8. Что сделано частично

- **Lesson unlock логика**: разблокировка следующего урока ориентируется на `LessonProgress.isCompleted`, но не на сдачу теста. См. H1.
- **Дизайн-полишинг**: разные страницы шлифовались несколькими итерациями (settings-row, color picker, period-bar) — но не было системного обзора всех страниц на мелкие неровности.
- **Документация (README)**: устарел относительно факта. См. M6.
- **CI / тесты**: на нуле, только ручная проверка через build + curl.

---

## 9. Что ещё не сделано

- Email-нотификации (SMTP, шаблоны)
- Реальный deploy на VPS (Dockerfile есть, но не катали)
- Бэкап-скрипт под Linux
- Loading skeletons и красивый error.tsx
- Pagination на больших списках (когда менеджеров будет 50+)
- Bulk-actions (раздать дефолтный курс всем существующим менеджерам отдела)
- Duplication курса
- Mobile-полишинг (375-414px)
- Логирование (Sentry / Pino)
- Health-check endpoint
- Удаление CURATOR из enum либо реализация

---

## 10. Рекомендации перед следующим этапом

В порядке приоритета:

1. **H1** — починить lesson unlock. Один правка в `getLessonDetail` (добавить проверку на `test.passed` если тест есть). ~30 минут.
2. **M2** — удалить `src/lib/services/*` и `src/lib/domain.ts`. ~5 минут.
3. **M3** — починить lint warnings в `profile.ts`. ~2 минуты.
4. **M6** — переписать README под реальное состояние. ~15 минут.
5. **L1** — вынести date-утилиты в общий модуль. ~20 минут.
6. **M5** — добавить корневой `error.tsx` и `not-found.tsx`. ~10 минут.
7. **H2** — пройтись по Docker-сборке, проверить что собирается, сделать `.sh`-бэкап. ~1 час.
8. **H3** — интеграция email-нотификаций. ~2-3 часа.
9. **M4** — заложить минимальные e2e-тесты на критические потоки. ~1 день.
10. Подготовка к deploy: env-чеклист, DNS, HTTPS, мониторинг. ~1 день.

---

## 11. Команды, которые были запущены

```bash
# Установка зависимостей — ранее, не повторяли
# npm install (предполагается выполнено)

# Сборка production
cd "D:\Vibe coding pojects\Learning portal" && npm run build
# Результат: зелёный билд, 25 маршрутов, размеры в пределах 102-109 kB

# Лinter
npm run lint
# Результат: 0 errors, 2 warnings (профиль.ts: _prev / _formData)

# Проверка БД
PGPASSWORD='Digitalgrass1!' psql -h localhost -U postgres -d learning_portal -c '\dt'
# Результат: 13 таблиц (12 моделей + _prisma_migrations)

# Row counts
SELECT t, COUNT(*) FROM ... GROUP BY t
# User=6, Department=3, Course=3, Lesson=4, Test=3, Question=8, CourseAccess=7,
# Enrollment=3, LessonProgress=5, TestAttempt=1, AnswerAttempt=2

# Структура src/
find src -type d  # 30 директорий
find src -type f -name "*.ts*" | wc -l  # 70 файлов

# Проверка legacy-импортов
grep -r "@/lib/services\|@/lib/domain" src/
# Результат: 0 совпадений в кодовой базе (импортируются только друг другом)

# Список server-actions
grep -l "use server" src/lib/ -r
# 11 файлов

# Список server-only модулей
grep -l "server-only" src/lib/ -r
# 7 файлов
```

---

## Быстрые исправления, которые можно внести сразу

Эти три правки безопасны и закрывают замечания без архитектурных рисков:

1. **Удалить legacy demo-код**: `src/lib/services/*.ts` + `src/lib/domain.ts`. Проверено grep'ом, что не импортируется. Размер кодовой базы уменьшится примерно на 200 строк.
2. **Починить H1 (lesson unlock)** в `src/lib/portal/learning.ts` — добавить запрос `prisma.test.findUnique({where:{lessonId: previousLesson.id}})` и `TestAttempt.findFirst({where: {userId, testId, passed:true}})`. Если тест есть и не сдан — `throw "LOCKED"`.
3. **eslint-disable для `_prev`/`_formData`** или просто переименование без подчёркивания (они используются как сигнатура react `useFormState`, который требует эти параметры). Тривиально.

Эти 3 — можно внести в одну сессию без отдельной задачи. Остальное в разделе 10 — отдельные шаги.

---

## 12. Дополнения после второй проверки

Эти проблемы я пропустил в первом проходе. Все валидны.

### Critical

#### C1. Stale JWT-сессия: блокировка/смена роли в БД не инвалидирует cookie

**Файлы:** `src/lib/auth/session.ts` → `getSession`, `requireAdmin`; `middleware.ts`.

**Проблема:** все check'и доверяют JWT payload (`session.role`), но не обращаются к БД за актуальным `status` и `role` пользователя. Login проверяет `status==="ACTIVE"` один раз — после этого 7 дней (TTL JWT) cookie работает без оглядки на БД.

Сценарии эксплуатации:
1. Пользователь заблокирован админом → продолжает иметь доступ до истечения JWT.
2. ROP понижен до MANAGER → продолжает видеть `/team/*` и выполнять scoped-actions.
3. MANAGER повышен в ROP → не видит `/team/*` до повторного логина (минорный, но всё равно неконсистентно).
4. Через middleware: токен с `role: "ADMIN"` пропускается на `/admin/*` независимо от текущего DB-статуса.

**Почему critical:** реальная дыра в безопасности доступа. Заблокированный пользователь продолжает работать.

**Как исправить:**
1. Ввести `requireActiveSession()` — обёртку: getSession + lookup user в БД + проверка `status==="ACTIVE"` и актуальной role. Возвращает обновлённую `{userId, role}` или редиректит на /login.
2. Заменить вызовы `requireSession` и `requireAdmin` на новую обёртку во всех серверных контекстах (страницы, server-actions).
3. В middleware (он работает в Edge runtime — без доступа к Prisma) хранить version-номер сессии или короткий TTL JWT (15-30 мин) + refresh-токен с DB-валидацией. Для MVP — сократить TTL JWT до 1-2 часов + ввести `/admin/*` гейтинг через server-action (или promoted server-side check в layout, что уже фактически делает requireAdmin внутри страниц).

Минимальный фикс под MVP: добавить DB-check в `requireSession` и `requireAdmin`, оставить middleware как есть (он только cheap gate, реальная защита на странице).

### High (новые)

#### H4. Docker: нет `.dockerignore`, секреты в docker-compose.yml

**Файлы:** `Dockerfile` (line 9 `COPY . .`), `docker-compose.yml` (line 21 `AUTH_SECRET: replace-with-long-random-string`), отсутствует `.dockerignore`.

**Проблема:**
1. Без `.dockerignore` в build context уходят `.env`, `node_modules`, `.next`, `public/uploads/`, `backups/`, `chrome-profile-*` — раздувает контекст и тащит секреты в промежуточные слои.
2. `docker-compose.yml` хранит плейсхолдер AUTH_SECRET прямо в репо. Тот, кто скопирует — может не заметить и задеплоить с дефолтным секретом.

**Как исправить:**
1. Создать `.dockerignore` (минимум: `node_modules`, `.next`, `.env*`, `public/uploads`, `backups`, `chrome-profile-*`, `*.log`, `.git`).
2. Убрать AUTH_SECRET из compose, использовать `env_file: .env.production` или указать как обязательный без default. Запускать deploy командой `--env-file`.
3. В README добавить инструкцию по созданию `.env.production` на VPS.

#### H5. Uploads volume отсутствует в docker-compose

**Файлы:** `docker-compose.yml`, `src/lib/auth/profile.ts` (line 103 — writeFile в `public/uploads/avatars`).

**Проблема:** в compose определён volume только для Postgres (`postgres-data`). Папка `public/uploads/avatars/` — внутри контейнера, при пересоздании контейнера (rebuild, redeploy) аватары теряются.

**Как исправить:** добавить в `app` сервис:
```yaml
volumes:
  - ./uploads:/app/public/uploads
```
Или вынести в S3-совместимое хранилище (Selectel, Yandex Object Storage), хранить только URL в БД.

### Medium (новые)

#### M7. `Test.timeLimitMins` — UI без логики

**Файлы:** `src/lib/admin/tests.ts` (createTestAction, updateTestAction), `src/lib/portal/testing.ts` (line 22 `timeLimitMins`, line 170 — возвращается в TakingTest), `submitTestAttempt` (line 264 — проверяется только maxAttempts).

**Проблема:** админ задаёт лимит времени, но серверная сторона не хранит `startedAt`, не валидирует `expiresAt` при submit. Менеджер может закрыть вкладку, потом открыть и сдать через сутки.

**Как исправить (два варианта):**
- A. Скрыть поле в UI до реализации, оставить в схеме на будущее.
- B. Добавить `TestAttempt.startedAt` и `expiresAt`. Создавать «черновик» attempt при открытии страницы, при submit — проверять `Date.now() < startedAt + timeLimitMins*60_000`. Auto-fail при истечении.

#### M8. ROP может назначить курс чужого отдела

**Файлы:** `src/lib/rop/users.ts` `ropGrantCourseAction` (line 147), `src/lib/admin/analytics.ts` `getManagerProfile` → `availableCoursesToGrant` (line 615).

**Проблема:** `ropGrantCourseAction` проверяет только `course.status === "PUBLISHED"`, но не сверяет `course.departmentId === rop.departmentId`. А `availableCoursesToGrant` возвращает все опубликованные курсы. То есть РОП «Автоподбор» может через UI назначить менеджеру курс «Импорт».

**Решение по бизнес-логике на твой выбор:**
- A. Запретить кросс-отдел — фильтровать курсы в `availableCoursesToGrant` по dept + добавить проверку в action. Жёсткий scope.
- B. Разрешить — задокументировать как фичу. Сейчас фактически именно это и работает.

**Если выбираем A:** `availableCoursesToGrant` принимает optional `departmentId` или делается отдельная функция `getManagerProfileForRop(ropUserId, managerId)`.

#### M9. ROP-пользователи исчезают из /admin/users

**Файлы:** `src/app/admin/users/page.tsx` (line 87 `role: "MANAGER"`, line 126 счётчики).

**Проблема:** список и счётчики жёстко фильтруют по `role: "MANAGER"`. После повышения менеджера в ROP — он пропадает из админского списка «Все менеджеры». Админ не может найти и управлять им (только если знает прямой URL `/admin/users/<id>`).

**Как исправить:**
1. Заменить `role: "MANAGER"` → `role: { in: ["MANAGER", "ROP"] }`.
2. Переименовать заголовок «Все менеджеры» → «Сотрудники» (или «Менеджеры и РОП»).
3. Добавить фильтр по роли в `.filter-bar`: «Все / Менеджеры / РОП».
4. В отображении статуса показывать badge с ролью (Менеджер/РОП).

#### M10. Изменение/удаление вопросов теряет историю попыток

**Файлы:** `src/lib/admin/tests.ts` `updateQuestionAction` (line 292), `deleteQuestionAction` (line 321 — удаляет AnswerAttempt).

**Проблема:** после сдач теста админ может:
- Изменить prompt/options/answerKey → старые AnswerAttempt начинают «врать» при разборе результата.
- Удалить вопрос → удаляются связанные AnswerAttempt → потеря данных по сданным попыткам.

Особенно опасно для TEXT-ответов на проверке: вопрос может исчезнуть прямо во время review.

**Как исправить (стратегические варианты):**
- A. Snapshot: при создании TestAttempt копировать prompt/options/answerKey в `AnswerAttempt.questionSnapshot` (Json). Тогда review и разбор всегда смотрят на снапшот, не на актуальный вопрос.
- B. Версионирование: `Question.version` + soft-delete (`deletedAt`). Старые попытки ссылаются на конкретную версию.
- C. Минимальная защита: блокировать `updateQuestionAction`/`deleteQuestionAction` если у теста есть хотя бы один TestAttempt. Дорого для UX, но безопасно.

Для MVP можно начать с C, потом перейти на A.

### Обновлённая сводка приоритетов

| # | Уровень | Что |
|---|---|---|
| C1 | Critical | Stale JWT — добавить DB-check в session |
| H1 | High | Lesson unlock не учитывает test.passed |
| H2 | High | Production deploy не проверен |
| H3 | High | Email-нотификации нет |
| H4 | High | `.dockerignore` отсутствует, секреты в compose |
| H5 | High | Uploads volume в docker-compose |
| M1 | Medium | CURATOR — мёртвый код |
| M2 | Medium | Legacy `src/lib/services/*` |
| M3 | Medium | Lint warnings |
| M4 | Medium | Автотестов нет |
| M5 | Medium | error.tsx / not-found.tsx |
| M6 | Medium | README устарел |
| M7 | Medium | timeLimitMins без серверной логики |
| M8 | Medium | ROP может назначить курс чужого отдела |
| M9 | Medium | ROP исчезают из /admin/users |
| M10 | Medium | Изменение вопросов ломает историю попыток |

### Обновлённые рекомендации перед production

Перед деплоем **обязательно** закрыть:
1. **C1** — DB-проверка status/role в session (security)
2. **H4** — `.dockerignore` + вынос AUTH_SECRET (security)
3. **H5** — volume для uploads (data loss)

И сильно желательно:
4. **H1** — строгий unlock с тестом
5. **H3** — email (хотя бы при одобрении заявки)
6. **M9** — ROP видны в /admin/users
7. **M10** — хотя бы вариант C (блокировка изменений после первой сдачи)

Остальное Medium/Low — после первого деплоя.

