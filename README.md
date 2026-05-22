# AIditorium Client

Фронтенд образовательной платформы AIditorium. Приложение помогает преподавателям и студентам работать с курсами, дисциплинами, заданиями, сдачами, комментариями, ручной проверкой, AI-review и взаимной проверкой работ.

Backend проекта находится в репозитории [Ares25061/AIditorium](https://github.com/Ares25061/AIditorium).

По умолчанию клиент отправляет API-запросы на `https://aiditorium.ru/api`. Для локальной разработки адрес backend API задается через `REACT_APP_API_URL`.

## Возможности

- Регистрация, вход, выход и хранение JWT-сессии в `localStorage`.
- Автоматическое добавление `Authorization: Bearer <token>` ко всем защищенным API-запросам.
- Обновление токена через `/refresh` при ответе `401`.
- Просмотр, создание, редактирование, закрытие, архивирование и восстановление курсов.
- Присоединение к курсу по коду приглашения, генерация кодов для студентов и преподавателей.
- Управление дисциплинами внутри курса.
- Создание и редактирование заданий с дедлайном, баллами, описанием и материалами.
- Сдача работ студентами, отмена сдачи, просмотр статуса и оценки.
- Страница проверки сдач для преподавателя: фильтры, оценки, комментарии, экспорт таблицы.
- Назначение преподавателей-проверяющих на конкретное задание.
- Настройка AI-review: модель, критерии, баллы, поддерживаемые форматы.
- Запуск AI-проверки по сданным файлам и применение рекомендованной оценки.
- Peer review: настройки взаимопроверки, распределение работ и сохранение результатов.
- Комментарии к заданиям и личные ветки обсуждения по файлам сдачи.
- Личный профиль пользователя, редактирование данных, загрузка и обрезка аватара.
- Просмотр и скачивание файлов через защищенные API-запросы.

## Стек

- React `19`
- React Router `7`
- Create React App / `react-scripts`
- Tailwind CSS `3`
- Axios
- Framer Motion
- React Icons
- React Markdown
- Testing Library / Jest

## Требования

- Node.js `18+`
- npm `9+`
- Запущенный backend AIditorium или доступ к production API

Backend для локальной разработки обычно запускается на `http://localhost:8000`, а API доступно по `http://localhost:8000/api`.

## Быстрый старт

```bash
npm ci
```

Создайте файл `.env.local` в корне frontend-проекта:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

Запустите приложение:

```bash
npm start
```

После запуска откройте [http://localhost:3000](http://localhost:3000).

Важно: Create React App читает переменные окружения только при старте dev-сервера. Если изменили `.env.local`, перезапустите `npm start`.

## Доступные команды

```bash
npm start
```

Запускает dev-сервер на `http://localhost:3000`.

```bash
npm run build
```

Собирает production-версию в папку `build/`.

```bash
npm test
```

Запускает тесты в интерактивном watch-режиме.

```bash
npm test -- --watchAll=false
```

Однократный запуск тестов, удобный для CI.

```bash
npm run eject
```

Извлекает конфигурацию CRA. Это необратимая операция, обычно она не нужна.

## Переменные окружения

| Переменная | Обязательна | Значение по умолчанию | Назначение |
| --- | --- | --- | --- |
| `REACT_APP_API_URL` | Нет | `https://aiditorium.ru/api` | Базовый URL backend API |

Пример для локального Laravel backend:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

Пример для production:

```env
REACT_APP_API_URL=https://aiditorium.ru/api
```

## Связка с backend

Фронтенд работает с REST API под префиксом `/api`. Основные группы endpoint-ов:

- Auth: `/login`, `/register`, `/logout`, `/refresh`.
- Users: `/user`, `/user/edit`, `/user/avatar/upload`, `/user/avatar/destroy`.
- Courses: `/course`, `/course/viewMine`, `/course/addUser`, invite codes, архив и восстановление.
- Disciplines: `/discipline`, `/discipline/viewDisciplines`.
- Tasks: `/task`, `/task/viewTasks`, сдачи, материалы, назначенные проверяющие.
- Files: `/file`, `/file/download/{id}`.
- Comments: `/comment`, `/comment/viewTask`, `/comment/my`.
- Grades: `/grade`, `/grade/course`, `/grade/me`.
- AI-review: `/task/{task}/review-profile`, `/task/{task}/submission/{file}/ai-review`, `/task/{task}/ai-reviews`.
- Peer review: `/peer-review/assignments`, `/task/{task}/peer-review/settings`, `/task/{task}/peer-review/results`.

Подробности настройки backend, миграций, seed-данных, очередей и AI-проверки находятся в [backend README](https://github.com/Ares25061/AIditorium).

Если backend запущен локально, проверьте:

- Laravel server доступен на `http://localhost:8000`.
- В frontend задано `REACT_APP_API_URL=http://localhost:8000/api`.
- В backend выполнены миграции и seed-данные.
- Для файлов выполнен `php artisan storage:link`.
- Если AI-review работает через очередь, запущен queue worker согласно настройкам backend.

## Маршруты приложения

| Маршрут | Доступ | Назначение |
| --- | --- | --- |
| `/` | Публичный | Landing page |
| `/auth` | Публичный | Вход и регистрация |
| `/profile` | Авторизованный | Профиль пользователя |
| `/courses` | Авторизованный | Список курсов пользователя |
| `/my-tasks` | Авторизованный | Все задания пользователя |
| `/file/:fileId/preview` | Авторизованный | Предпросмотр файла |
| `/course/:courseIdOrSlug` | Авторизованный | Страница курса |
| `/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug` | Авторизованный | Страница дисциплины |
| `/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber` | Авторизованный | Страница задания |
| `/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/submissions` | Преподаватель | Проверка сдач |
| `/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/ai-review-settings` | Преподаватель | Настройки AI-review |
| `/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber/peer-review-settings` | Преподаватель | Настройки взаимопроверки |

## Структура проекта

```text
public/
  index.html
  manifest.json
  favicon.ico
  Logo.png
src/
  App.js                         # Роутинг и protected/public routes
  index.js                       # Точка входа, AuthProvider и ToastProvider
  index.css                      # Tailwind layers и базовые стили
  components/                    # Переиспользуемые UI-компоненты
  components/comments/           # Комментарии и ветки обсуждений
  components/courses/            # Карточки и модальные окна курсов
  components/disciplines/        # Модальные окна дисциплин
  components/editor/             # Rich text editor и безопасный вывод HTML
  components/files/              # Сетки файлов и preview surface
  components/layout/             # Navbar, Sidebar, MainLayout, ConfirmModal
  components/peer/               # Блоки взаимопроверки
  components/profile/            # Обрезка аватара
  components/tasks/              # Карточки и модальные окна заданий
  context/                       # AuthContext и ToastContext
  pages/                         # Страницы приложения
  services/                      # API-клиенты по доменным сущностям
  utils/                         # Нормализация данных, slug, оценки, файлы
```

## Важные реализации

### API-клиент

`src/services/apiClient.js` создает общий Axios instance. Он:

- берет `baseURL` из `REACT_APP_API_URL`;
- добавляет JWT-токен из `localStorage`;
- корректно отправляет `FormData`;
- при `401` один раз вызывает `/refresh`, обновляет сессию и повторяет исходный запрос;
- очищает сессию, если refresh не удался.

### Авторизация

`src/context/AuthContext.jsx` хранит текущего пользователя, синхронизируется с `localStorage` и предоставляет методы:

- `login`
- `register`
- `logout`
- `updateUser`

### Роли в курсе

Права на действия определяются по роли пользователя в конкретном курсе:

- `teacher` может управлять курсом, дисциплинами, заданиями, проверкой, AI-review и peer review;
- `student` может просматривать задания, сдавать работы, видеть свои оценки и участвовать во взаимопроверке.

Создатель курса считается преподавателем даже без отдельной записи роли в списке участников.

### Файлы

Файлы скачиваются через защищенный endpoint `/file/download/{id}` как `blob`. Клиент извлекает имя файла из `Content-Disposition`, поддерживает UTF-8 имена и умеет открыть файл в новой вкладке или скачать его.

### Rich text

Описание заданий и комментарии проходят через ограниченную HTML-санитизацию. Разрешены базовые теги форматирования, списки и переносы строк.

## Разработка

- Русский текст в коде и документации должен сохраняться в UTF-8.
- Не сохраняйте файлы с кириллицей в Windows-1251 или другой legacy-кодировке.
- Для новых API-запросов добавляйте методы в `src/services`, а не вызывайте Axios напрямую из компонентов.
- Для URL используйте helpers из `src/utils/routeUtils.js`.
- Для slug используйте `src/utils/slugUtils.js`: числовые slug без букв отклоняются и заменяются на `id`.
- Для работы с коллекциями backend-ответов используйте `extractCollection` из `src/utils/apiUtils.js`.
- UI-тексты сейчас ориентированы на русский язык.

## Сборка и деплой

Соберите production-версию:

```bash
npm run build
```

Результат появится в `build/`. Эту папку можно отдавать через Nginx, Apache, CDN или любой static hosting.

Для SPA-роутинга сервер должен возвращать `index.html` для неизвестных frontend-маршрутов. Иначе прямое открытие URL вида `/course/my-course` будет отдавать `404` на уровне web-сервера.

Пример правила для Nginx:

```nginx
location / {
    try_files $uri /index.html;
}
```

## Проверка перед изменениями

Перед отправкой изменений желательно выполнить:

```bash
npm test -- --watchAll=false
npm run build
```

Если менялась интеграция с backend, дополнительно проверьте основные сценарии в браузере:

- регистрация и вход;
- создание курса и присоединение по коду;
- создание дисциплины и задания;
- загрузка материалов и сдача работы;
- комментарии;
- выставление оценки;
- AI-review;
- peer review.

