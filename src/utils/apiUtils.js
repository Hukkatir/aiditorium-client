export const extractCollection = (payload, key) => {
    if (!payload || typeof payload !== 'object') {
        return Array.isArray(payload) ? payload : [];
    }

    if (key && Array.isArray(payload?.[key]?.data)) {
        return payload[key].data;
    }

    if (key && Array.isArray(payload?.[key])) {
        return payload[key];
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    const fallbackKeys = ['comments', 'replies', 'files', 'submissions', 'grades', 'reviews', 'tasks', 'courses', 'disciplines', 'users'];

    for (const fallbackKey of fallbackKeys) {
        if (Array.isArray(payload?.[fallbackKey]?.data)) {
            return payload[fallbackKey].data;
        }

        if (Array.isArray(payload?.[fallbackKey])) {
            return payload[fallbackKey];
        }
    }

    return [];
};

const DEFAULT_ERROR_MESSAGE = 'Произошла ошибка. Попробуйте позже.';

export const normalizeErrorText = (message = '') => String(message || '')
    .replace(/\bslug\b/gi, 'короткий URL')
    .replace(/\bbackend\b/gi, 'Бэкенд')
    .replace(/\bAI\b/gi, 'ИИ')
    .replace(/\bemail\b/gi, 'почта')
    .replace(/\bpassword\b/gi, 'пароль')
    .replace(/\bchatgpt\b|gpt-5\.5/gi, 'Deepseek v4')
    .trim();

export const getRawApiMessage = (error) => {
    const data = error?.response?.data;

    if (typeof data === 'string') {
        return data;
    }

    if (data && typeof data === 'object') {
        const candidates = [
            data.error,
            data.message,
            data?.errors?.message?.[0],
            data?.errors?.error?.[0],
        ];

        const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
        if (match) {
            return match;
        }
    }

    return typeof error?.message === 'string' ? error.message : '';
};

export const getFirstValidationMessage = (serverErrors = {}) => {
    if (!serverErrors || typeof serverErrors !== 'object') {
        return '';
    }

    for (const messages of Object.values(serverErrors)) {
        if (Array.isArray(messages)) {
            const message = messages.find((item) => typeof item === 'string' && item.trim());
            if (message) {
                return message;
            }
        } else if (typeof messages === 'string' && messages.trim()) {
            return messages;
        }
    }

    return '';
};

export const translateErrorMessage = (message = '', fallback = DEFAULT_ERROR_MESSAGE) => {
    const original = String(message || '').trim();
    const normalized = normalizeErrorText(message);
    const safeFallback = normalizeErrorText(fallback) || DEFAULT_ERROR_MESSAGE;

    if (!normalized) {
        return safeFallback;
    }

    if (/[А-Яа-яЁё]/.test(original)) {
        return normalized;
    }

    const lower = original.toLowerCase();

    if (/network error|failed to fetch|err_network|connection failed/.test(lower)) {
        return 'Ошибка подключения к серверу. Попробуйте позже.';
    }

    if (/timeout|timed out|cURL error 28/i.test(normalized)) {
        return 'Сервер не успел ответить. Попробуйте позже.';
    }

    if (/too many requests|rate limit|status code 429|\b429\b/.test(lower)) {
        return 'Слишком много запросов. Попробуйте позже.';
    }

    if (/unauthenticated|unauthorized|forbidden|permission|not authorized|this action is unauthorized/.test(lower)) {
        return 'Недостаточно прав для выполнения действия.';
    }

    if (/invalid credentials|credentials/.test(lower)) {
        return 'Неверная почта или пароль.';
    }

    if (/invalid invite code|invite code/.test(lower)) {
        return 'Неверный код приглашения.';
    }

    if (/not found|resource not found|status code 404|\b404\b/.test(lower)) {
        return 'Запрошенные данные не найдены.';
    }

    if (/validation failed|given data was invalid|unprocessable|status code 422|\b422\b/.test(lower)) {
        return 'Проверьте заполненные поля.';
    }

    if (/already been taken|already used|has already been taken|unique/.test(lower)) {
        return lower.includes('email')
            ? 'Эта почта уже зарегистрирована.'
            : 'Такое значение уже используется.';
    }

    if (/required|required field|must be present/.test(lower)) {
        return 'Поле обязательно для заполнения.';
    }

    if (/email/.test(lower) && /valid|invalid/.test(lower)) {
        return 'Введите корректную почту.';
    }

    if (/password/.test(lower) && /least 8|8 characters|min/.test(lower)) {
        return 'Пароль должен быть не менее 8 символов.';
    }

    if (/file too large|too large|uploaded|upload|max file|max size/.test(lower)) {
        return 'Не удалось загрузить файл. Проверьте размер и формат файла.';
    }

    if (/no files to submit/.test(lower)) {
        return 'Выберите хотя бы один файл.';
    }

    if (/created task id is missing/.test(lower)) {
        return 'Задание создано, но сервер не вернул его идентификатор.';
    }

    if (/missing auth token|missing refreshed token/.test(lower)) {
        return 'Сессия истекла. Войдите снова.';
    }

    if (/request failed with status code\s+(\d+)/.test(lower)) {
        const [, statusCode] = lower.match(/request failed with status code\s+(\d+)/) || [];
        return statusCode ? `Сервер вернул ошибку ${statusCode}.` : safeFallback;
    }

    return safeFallback;
};

export const getApiErrorMessage = (error, fallback = DEFAULT_ERROR_MESSAGE) => {
    const validationMessage = getFirstValidationMessage(error?.response?.data?.errors);
    if (validationMessage) {
        return translateErrorMessage(validationMessage, fallback);
    }

    return translateErrorMessage(getRawApiMessage(error), fallback);
};
