export const DEFAULT_AI_SUPPORTED_FORMATS = ['docx', 'xlsx', 'csv', 'tsv', 'zip', 'php', 'js', 'ts', 'py', 'java', 'cs'];

export const DEFAULT_AI_RUBRIC = [
    {
        id: 'requirements',
        label: 'Соответствие заданию',
        description: 'Работа решает поставленную задачу и учитывает требования из описания.',
        instructions: 'Проверь полноту решения, соответствие теме и отсутствие явных пропусков.',
        weight: 40,
        checks: ['Решение соответствует теме задания', 'Выполнены основные требования', 'Нет критичных пропусков']
    },
    {
        id: 'quality',
        label: 'Качество выполнения',
        description: 'Работа аккуратная, понятная и достаточно обоснованная.',
        instructions: 'Оцени структуру, аргументацию, оформление и качество реализации.',
        weight: 40,
        checks: ['Работа логично структурирована', 'Результат можно проверить', 'Оформление не мешает пониманию']
    },
    {
        id: 'independence',
        label: 'Самостоятельность и выводы',
        description: 'В работе видны собственные выводы студента и осмысленное выполнение.',
        instructions: 'Проверь, есть ли объяснения решений, выводы или комментарии к результату.',
        weight: 20,
        checks: ['Есть пояснения или выводы', 'Решение выглядит осмысленным', 'Нет признаков случайной сдачи']
    }
];

export const DEFAULT_PEER_REVIEW_SETTINGS = {
    enabled: false,
    mode: 'blind',
    reviewsPerStudent: 2,
    allowScore: true,
    instructions: ''
};

const PEER_REVIEW_SETTINGS_PREFIX = 'aiditorium-peer-review-settings:';

export const getPeerReviewSettingsKey = (taskId) => `${PEER_REVIEW_SETTINGS_PREFIX}${taskId}`;

export const normalizePeerReviewSettings = (settings = {}) => ({
    ...DEFAULT_PEER_REVIEW_SETTINGS,
    ...settings,
    mode: settings.mode === 'open' ? 'open' : 'blind',
    reviewsPerStudent: Number.isFinite(Number(settings.reviewsPerStudent))
        ? Math.max(1, Number(settings.reviewsPerStudent))
        : DEFAULT_PEER_REVIEW_SETTINGS.reviewsPerStudent,
    allowScore: Boolean(settings.allowScore)
});

export const loadPeerReviewSettings = (taskId) => {
    if (!taskId || typeof window === 'undefined') {
        return DEFAULT_PEER_REVIEW_SETTINGS;
    }

    try {
        const storedValue = window.localStorage.getItem(getPeerReviewSettingsKey(taskId));
        return storedValue
            ? normalizePeerReviewSettings(JSON.parse(storedValue))
            : DEFAULT_PEER_REVIEW_SETTINGS;
    } catch (error) {
        console.error('Failed to load peer review settings', error);
        return DEFAULT_PEER_REVIEW_SETTINGS;
    }
};

export const savePeerReviewSettings = (taskId, settings) => {
    if (!taskId || typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(
        getPeerReviewSettingsKey(taskId),
        JSON.stringify(normalizePeerReviewSettings(settings))
    );
};
