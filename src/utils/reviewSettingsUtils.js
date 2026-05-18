export const DEFAULT_AI_SUPPORTED_FORMATS = ['docx', 'xlsx', 'csv', 'tsv', 'zip', 'rar', '7z', 'php', 'js', 'ts', 'py', 'java', 'cs'];

export const DEFAULT_AI_MODEL_KEY = 'minimax';

export const DEFAULT_AI_MODEL_OPTIONS = [
    { key: 'minimax', label: 'MiniMax' },
    { key: 'deepseek_v4', label: 'Deepseek v4' }
];

export const DEFAULT_AI_RUBRIC = [
    {
        id: 'requirements',
        label: 'Соответствие заданию',
        description: 'Проверь, насколько работа решает поставленную задачу и учитывает требования из описания.',
        instructions: '',
        weight: 40,
        checks: []
    },
    {
        id: 'quality',
        label: 'Качество выполнения',
        description: 'Оцени структуру, аккуратность, аргументацию и качество реализации.',
        instructions: '',
        weight: 40,
        checks: []
    },
    {
        id: 'independence',
        label: 'Самостоятельность и выводы',
        description: 'Проверь, есть ли в работе собственные выводы, объяснения и осмысленное выполнение.',
        instructions: '',
        weight: 20,
        checks: []
    }
];

export const DEFAULT_PEER_REVIEW_SETTINGS = {
    enabled: true,
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
    enabled: true,
    mode: settings.mode === 'open' ? 'open' : 'blind',
    reviewsPerStudent: Number.isFinite(Number(settings.reviewsPerStudent ?? settings.reviews_per_student))
        ? Math.max(1, Number(settings.reviewsPerStudent ?? settings.reviews_per_student))
        : DEFAULT_PEER_REVIEW_SETTINGS.reviewsPerStudent,
    allowScore: Boolean(settings.allowScore ?? settings.allow_score)
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
