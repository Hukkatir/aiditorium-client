export const AI_REVIEW_STATUS_META = {
    queued: { label: 'В очереди', className: 'bg-white/10 text-slate-300' },
    extracting: { label: 'Читает файл', className: 'bg-purple-500/10 text-purple-200' },
    analyzing: { label: 'Проверяет', className: 'bg-purple-500/10 text-purple-200' },
    completed: { label: 'Готово', className: 'bg-emerald-500/10 text-emerald-200' },
    failed: { label: 'Ошибка', className: 'bg-red-500/10 text-red-200' }
};

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

export const getFriendlyAiErrorMessage = (error) => {
    const message = getApiMessage(error);

    if (/ZipArchive/i.test(message)) {
        return 'Не удалось прочитать DOCX-файл для проверки. Попробуйте загрузить работу в другом формате или повторите проверку позже.';
    }

    if (/cURL error 28|timed out|timeout|OpenRouter connection failed/i.test(message)) {
        return 'OpenRouter не успел ответить вовремя. Backend повторяет такие запросы автоматически; если ошибка повторяется после всех попыток, увеличьте AI_TIMEOUT/AI_OPENROUTER_RETRY_ATTEMPTS или проверьте загруженность модели.';
    }

    if (/Elephant Alpha|Ling-2\.6|ling-2\.6|model.*(not found|unavailable|invalid)|no endpoints found|not a valid model|model .* does not exist|unsupported model/i.test(message)) {
        return 'Выбранная модель искусственного интеллекта сейчас недоступна в OpenRouter. Проверьте AI_MODEL в backend .env и очистите кеш конфигурации Laravel.';
    }

    if (/OpenRouter request failed/i.test(message)) {
        return `OpenRouter вернул ошибку: ${message.replace(/^OpenRouter request failed:\s*/i, '')}`;
    }

    return message;
};

export const formatAiRuntimeMessage = (message = '') => (
    getFriendlyAiErrorMessage({ response: { data: { message } } }) || message
);

export const getAiReviewStatus = (review) => {
    const status = String(review?.status?.value || review?.status || '').toLowerCase();
    return AI_REVIEW_STATUS_META[status] || { label: review ? status || 'Неизвестно' : 'Не запускалась', className: 'bg-white/10 text-slate-300' };
};

export const isAiReviewActive = (review) => {
    const status = String(review?.status?.value || review?.status || '').toLowerCase();
    return ['queued', 'extracting', 'analyzing'].includes(status);
};
