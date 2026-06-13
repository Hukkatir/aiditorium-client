import { getRawApiMessage, translateErrorMessage } from './apiUtils';
import { formatAiModelLabel } from './reviewSettingsUtils';

export const AI_REVIEW_STATUS_META = {
    queued: { label: 'В очереди', className: 'bg-white/10 text-slate-300' },
    extracting: { label: 'Читает файл', className: 'bg-purple-500/10 text-purple-200' },
    analyzing: { label: 'Проверяет', className: 'bg-purple-500/10 text-purple-200' },
    completed: { label: 'Готово', className: 'bg-emerald-500/10 text-emerald-200' },
    failed: { label: 'Ошибка', className: 'bg-red-500/10 text-red-200' }
};

const getAiErrorCode = (errorOrMessage) => {
    if (typeof errorOrMessage === 'object' && errorOrMessage !== null) {
        const responseCode = errorOrMessage.response?.data?.code
            || errorOrMessage.response?.status
            || errorOrMessage.code;

        if (responseCode) {
            return String(responseCode);
        }
    }

    const message = typeof errorOrMessage === 'string'
        ? errorOrMessage
        : getRawApiMessage(errorOrMessage);
    const statusMatch = String(message || '').match(/\b(4\d{2}|5\d{2}|429)\b/);
    if (statusMatch) {
        return statusMatch[1];
    }

    const curlMatch = String(message || '').match(/cURL error\s+(\d+)/i);
    if (curlMatch) {
        return `cURL ${curlMatch[1]}`;
    }

    if (/timeout|timed out/i.test(message)) {
        return 'тайм-аут';
    }

    return '';
};

const getAiModelName = (model = '') => {
    const value = String(model || '').trim();
    const normalized = value.toLowerCase();

    if (!value) {
        return 'выбранная модель';
    }

    if (normalized.includes('chatgpt') || normalized.includes('gpt-5.5')) {
        return 'Deepseek v4';
    }

    if (normalized === 'deepseek_v4' || normalized.includes('deepseek')) {
        return 'Deepseek v4';
    }

    if (normalized === 'minimax' || normalized.includes('minimax')) {
        return 'MiniMax';
    }

    if (normalized.includes('openrouter') || normalized.includes('/') || normalized.includes(':free')) {
        return 'MiniMax';
    }

    const formattedModel = formatAiModelLabel(value);
    return formattedModel && formattedModel !== value ? formattedModel : 'MiniMax';
};

const extractModelNameFromMessage = (message = '') => {
    const value = String(message || '');

    if (/chatgpt|gpt-5\.5/i.test(value)) {
        return 'Deepseek v4';
    }

    if (/minimax/i.test(value)) {
        return 'MiniMax';
    }

    const modelMatch = value.match(/model\s+["']?([^"',\s)]+)/i);
    return modelMatch?.[1] || '';
};

const getModelUnavailableMessage = (model, errorOrMessage) => {
    const errorCode = getAiErrorCode(errorOrMessage);

    return `модель ${getAiModelName(model)} на данный момент недоступна${errorCode ? `, ${errorCode}` : ''}.`;
};

const isModelAvailabilityError = (message = '') => (
    /OpenRouter|model|no endpoints found|not a valid model|does not exist|unsupported model|unavailable|too many requests|rate limit|429|5\d\d|empty completion|AI API key|connection failed|timeout|timed out|cURL error 28|gpt-5\.5|chatgpt/i
        .test(message)
);

export const getFriendlyAiErrorMessage = (error, model = '') => {
    const message = getRawApiMessage(error);

    if (/ZipArchive/i.test(message)) {
        return 'Не удалось прочитать DOCX-файл для проверки. Попробуйте загрузить работу в другом формате или повторите проверку позже.';
    }

    if (isModelAvailabilityError(message)) {
        return getModelUnavailableMessage(model || extractModelNameFromMessage(message), error);
    }

    return translateErrorMessage(message, 'Не удалось выполнить проверку искусственным интеллектом.');
};

export const formatAiRuntimeMessage = (message = '', model = '') => (
    getFriendlyAiErrorMessage({ response: { data: { message } } }, model)
);

export const getAiReviewStatus = (review) => {
    const status = String(review?.status?.value || review?.status || '').toLowerCase();
    return AI_REVIEW_STATUS_META[status] || { label: review ? status || 'Неизвестно' : 'Не запускалась', className: 'bg-white/10 text-slate-300' };
};

export const isAiReviewActive = (review) => {
    const status = String(review?.status?.value || review?.status || '').toLowerCase();
    return ['queued', 'extracting', 'analyzing'].includes(status);
};
