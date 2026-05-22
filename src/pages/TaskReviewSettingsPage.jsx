import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiArrowPath,
    HiDocumentText,
    HiPlus,
    HiSparkles,
    HiTrash
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { aiReviewService } from '../services/aiReviewService';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { getDisplayFileName } from '../utils/fileUtils';
import {
    formatGradeValue,
    getAiReviewScore,
    getLatestAiReviewByStudent
} from '../utils/gradeReviewUtils';
import {
    DEFAULT_AI_MODEL_KEY,
    DEFAULT_AI_MODEL_OPTIONS,
    DEFAULT_AI_RUBRIC,
    DEFAULT_AI_SUPPORTED_FORMATS
} from '../utils/reviewSettingsUtils';
import {
    formatAiRuntimeMessage,
    getAiReviewStatus,
    getFriendlyAiErrorMessage,
    isAiReviewActive
} from '../utils/aiReviewPresentation';
import { buildTaskPath, buildTaskPeerReviewSettingsPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

const getTaskMaxScore = (task) => {
    const score = Number(task?.scores);
    return Number.isFinite(score) && score > 0 ? score : 100;
};

const distributeDefaultPoints = (maxScore) => {
    const first = Math.round(maxScore * 0.4);
    const second = Math.round(maxScore * 0.4);
    return [first, second, Math.max(0, maxScore - first - second)];
};

const buildDefaultRubric = (maxScore = 100) => {
    const points = distributeDefaultPoints(maxScore);
    return DEFAULT_AI_RUBRIC.map((criterion, index) => ({
        id: criterion.id || `criterion-${index + 1}`,
        label: criterion.label || '',
        description: criterion.description || criterion.instructions || '',
        instructions: '',
        weight: points[index] ?? '',
        checks: []
    }));
};

const normalizeCriterion = (criterion = {}, index = 0) => ({
    id: criterion.id || `criterion-${index + 1}`,
    label: criterion.label || '',
    description: criterion.description || criterion.instructions || '',
    instructions: '',
    weight: criterion.weight ?? '',
    checks: []
});

const normalizeProfile = (profile = {}, maxScore = 100) => {
    const safeProfile = profile || {};

    return {
        enabled: true,
        ai_model_key: safeProfile.ai_model_key || DEFAULT_AI_MODEL_KEY,
        rubric: Array.isArray(safeProfile.rubric) && safeProfile.rubric.length
            ? safeProfile.rubric.map(normalizeCriterion)
            : buildDefaultRubric(maxScore),
        custom_prompt: '',
        supported_formats: Array.isArray(safeProfile.supported_formats) && safeProfile.supported_formats.length
            ? safeProfile.supported_formats
            : DEFAULT_AI_SUPPORTED_FORMATS
    };
};

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

const formatDateTime = (dateString) => {
    if (!dateString) {
        return '—';
    }

    return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const TaskReviewSettingsPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [profileForm, setProfileForm] = useState(() => normalizeProfile({}, 100));
    const [submissions, setSubmissions] = useState([]);
    const [aiReviews, setAiReviews] = useState([]);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [queueingAiReviewFor, setQueueingAiReviewFor] = useState(null);
    const [queueingAllAiReviews, setQueueingAllAiReviews] = useState(false);
    const [pollingAiReviews, setPollingAiReviews] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [availableModels, setAvailableModels] = useState(DEFAULT_AI_MODEL_OPTIONS);

    const maxScore = useMemo(() => getTaskMaxScore(task), [task]);
    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';
    const submissionsPath = task && course && discipline
        ? buildTaskSubmissionsPath(course, discipline, task)
        : '/courses';
    const peerSettingsPath = task && course && discipline
        ? buildTaskPeerReviewSettingsPath(course, discipline, task)
        : '/courses';

    const totalPoints = useMemo(
        () => profileForm.rubric.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0),
        [profileForm.rubric]
    );
    const remainingPoints = maxScore - totalPoints;

    const groupedSubmissions = useMemo(() => {
        const groups = new Map();
        const sortedSubmissions = [...submissions].sort(
            (left, right) => new Date(right.created_at) - new Date(left.created_at)
        );

        sortedSubmissions.forEach((submission) => {
            const userId = Number(submission.user_id);
            const existingGroup = groups.get(userId);

            if (existingGroup) {
                existingGroup.submissions.push(submission);
                return;
            }

            groups.set(userId, {
                userId,
                user: submission.user,
                latestSubmission: submission,
                submissions: [submission]
            });
        });

        return Array.from(groups.values());
    }, [submissions]);

    const latestAiReviewByStudent = useMemo(
        () => getLatestAiReviewByStudent(aiReviews, groupedSubmissions),
        [aiReviews, groupedSubmissions]
    );

    const aiReviewStats = useMemo(() => {
        const stats = { completed: 0, active: 0, failed: 0 };

        aiReviews.forEach((review) => {
            const status = String(review?.status?.value || review?.status || '').toLowerCase();
            if (status === 'completed') {
                stats.completed += 1;
            } else if (status === 'failed') {
                stats.failed += 1;
            } else if (status) {
                stats.active += 1;
            }
        });

        return stats;
    }, [aiReviews]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setAccessDenied(false);

        try {
            const taskData = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
            const taskObject = taskData.task || taskData;
            const taskMaxScore = getTaskMaxScore(taskObject);

            const [courseData, disciplineData, profileData, submissionsData, reviewsData] = await Promise.all([
                courseService.getCourse(taskObject.course_id),
                disciplineService.getDiscipline(taskObject.course_id, taskObject.discipline_id),
                aiReviewService.getReviewProfile(taskObject.id).catch((error) => {
                    if (error.response?.status === 403) {
                        setAccessDenied(true);
                        return { profile: null };
                    }

                    throw error;
                }),
                taskService.getTaskSubmissions(taskObject.id, 100).catch((error) => {
                    if (error.response?.status === 403) {
                        setAccessDenied(true);
                    }

                    return { submissions: { data: [] } };
                }),
                aiReviewService.getTaskAiReviews(taskObject.id, 100).catch((error) => {
                    if (error.response?.status === 403) {
                        setAccessDenied(true);
                    }

                    return { reviews: { data: [] } };
                })
            ]);

            setTask(taskObject);
            setCourse(courseData.course || courseData);
            setDiscipline(disciplineData.discipline || disciplineData);
            setProfileForm(normalizeProfile(profileData.profile, taskMaxScore));
            setSubmissions(extractCollection(submissionsData, 'submissions'));
            setAiReviews(extractCollection(reviewsData, 'reviews'));
            setAvailableModels(
                Array.isArray(profileData.available_models) && profileData.available_models.length
                    ? profileData.available_models
                    : DEFAULT_AI_MODEL_OPTIONS
            );
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось загрузить настройки проверки искусственным интеллектом');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, showToast, taskNumber]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const pollAiReviewsUntilSettled = useCallback(async (maxAttempts = 240) => {
        if (!task?.id) {
            return;
        }

        setPollingAiReviews(true);

        try {
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                const reviewsData = await aiReviewService.getTaskAiReviews(task.id, 100);
                const nextReviews = extractCollection(reviewsData, 'reviews');
                setAiReviews(nextReviews);

                if (!nextReviews.some(isAiReviewActive)) {
                    break;
                }

                await new Promise((resolve) => {
                    window.setTimeout(resolve, 3000);
                });
            }
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось обновить результаты проверки искусственным интеллектом');
        } finally {
            setPollingAiReviews(false);
        }
    }, [showToast, task?.id]);

    const handleQueueAiReview = async (group, forceRecheck = false) => {
        if (!task?.id || !group?.latestSubmission?.id) {
            return;
        }

        setQueueingAiReviewFor(group.userId);

        try {
            await aiReviewService.queueAiReview(task.id, group.latestSubmission.id, forceRecheck);
            showToast('success', forceRecheck ? 'Повторная проверка искусственным интеллектом запущена' : 'Проверка искусственным интеллектом запущена');
            await pollAiReviewsUntilSettled();
        } catch (error) {
            console.error(error);
            showToast('error', getFriendlyAiErrorMessage(error) || 'Не удалось запустить проверку искусственным интеллектом', 6000);
        } finally {
            setQueueingAiReviewFor(null);
        }
    };

    const handleQueueAllAiReviews = async () => {
        if (!task?.id || !groupedSubmissions.length) {
            return;
        }

        setQueueingAllAiReviews(true);
        let successCount = 0;
        let failedMessage = '';

        try {
            for (const group of groupedSubmissions) {
                try {
                    const hasReview = latestAiReviewByStudent.has(group.userId);
                    await aiReviewService.queueAiReview(task.id, group.latestSubmission.id, hasReview);
                    successCount += 1;
                } catch (error) {
                    console.error(error);
                    failedMessage = failedMessage || getFriendlyAiErrorMessage(error) || 'Не все работы удалось отправить на проверку.';
                }
            }

            if (successCount > 0) {
                showToast('success', `Проверка искусственным интеллектом запущена для работ: ${successCount}`);
                await pollAiReviewsUntilSettled();
            }

            if (failedMessage) {
                showToast('error', failedMessage, 7000);
            }
        } finally {
            setQueueingAllAiReviews(false);
        }
    };

    const updateCriterion = (index, field, value) => {
        setProfileForm((previous) => ({
            ...previous,
            rubric: previous.rubric.map((criterion, criterionIndex) => (
                criterionIndex === index ? { ...criterion, [field]: value } : criterion
            ))
        }));
    };

    const addCriterion = () => {
        setProfileForm((previous) => ({
            ...previous,
            rubric: [
                ...previous.rubric,
                {
                    id: `criterion-${Date.now()}`,
                    label: '',
                    description: '',
                    instructions: '',
                    weight: Math.max(0, maxScore - totalPoints) || '',
                    checks: []
                }
            ]
        }));
    };

    const removeCriterion = (index) => {
        setProfileForm((previous) => ({
            ...previous,
            rubric: previous.rubric.filter((_, criterionIndex) => criterionIndex !== index)
        }));
    };

    const validateProfile = () => {
        const nextErrors = {};

        if (!profileForm.rubric.length) {
            nextErrors.rubric = 'Добавьте хотя бы один критерий проверки.';
        }

        profileForm.rubric.forEach((criterion, index) => {
            const points = Number(criterion.weight);

            if (!criterion.label.trim()) {
                nextErrors[`rubric.${index}.label`] = 'Введите название критерия.';
            }

            if (!criterion.description.trim()) {
                nextErrors[`rubric.${index}.description`] = 'Введите инструкцию для ИИ.';
            }

            if (!Number.isFinite(points) || points < 0) {
                nextErrors[`rubric.${index}.weight`] = 'Баллы должны быть числом от 0.';
            }
        });

        if (totalPoints !== maxScore) {
            nextErrors.totalPoints = `Сумма баллов должна быть ${maxScore}. Сейчас: ${totalPoints}.`;
        }

        return nextErrors;
    };

    const handleSaveProfile = async () => {
        if (!task) {
            return;
        }

        const nextErrors = validateProfile();
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            showToast('error', 'Проверьте поля настройки проверки искусственным интеллектом');
            return;
        }

        setErrors({});
        setSavingProfile(true);

        try {
            const payload = {
                enabled: true,
                ai_model_key: profileForm.ai_model_key || DEFAULT_AI_MODEL_KEY,
                rubric: profileForm.rubric.map((criterion, index) => ({
                    id: criterion.id || `criterion-${index + 1}`,
                    label: criterion.label.trim(),
                    description: criterion.description.trim(),
                    instructions: null,
                    weight: Number(criterion.weight),
                    checks: []
                })),
                custom_prompt: null,
                supported_formats: profileForm.supported_formats
            };

            await aiReviewService.updateReviewProfile(task.id, payload);
            setProfileForm(normalizeProfile(payload, maxScore));
            showToast('success', 'Настройки проверки искусственным интеллектом сохранены');
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось сохранить настройки проверки искусственным интеллектом');
        } finally {
            setSavingProfile(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-full items-center justify-center">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                </div>
            </MainLayout>
        );
    }

    if (!task || !course || !discipline) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Настройки проверки искусственным интеллектом недоступны</p>
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="mt-4 inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Вернуться к курсам
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(submissionsPath)}
                        className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Назад к проверке
                    </button>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(peerSettingsPath)}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        >
                            Взаимопроверка
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(taskPath)}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        >
                            Открыть задание
                        </button>
                    </div>
                </div>

                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                                <HiSparkles className="h-4 w-4" />
                                Проверка искусственным интеллектом включена
                            </div>
                            <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">{task.name}</h1>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                Настройте критерии, по которым искусственный интеллект будет проверять работы студентов. Для каждого критерия задается название, инструкция и количество баллов.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                            <p className="text-slate-500">Максимум за задание</p>
                            <p className="mt-1 font-medium text-white">{maxScore} баллов</p>
                            <p className="mt-4 text-slate-500">Сумма критериев</p>
                            <p className={remainingPoints === 0 ? 'mt-1 font-medium text-emerald-300' : 'mt-1 font-medium text-amber-200'}>
                                {totalPoints}/{maxScore}
                            </p>
                        </div>
                    </div>
                </section>

                {accessDenied ? (
                    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
                        Настройки проверки искусственным интеллектом может менять только автор задания или пользователь с правом управления проверкой.
                    </section>
                ) : (
                    <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <HiSparkles className="h-5 w-5 text-purple-300" />
                                    <h2 className="text-xl font-semibold text-white">Критерии проверки искусственным интеллектом</h2>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    Суммарные баллы всех критериев должны совпадать с максимумом задания.
                                </p>
                            </div>
                            <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${remainingPoints === 0 ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-100'}`}>
                                {remainingPoints === 0 ? 'Баллы распределены' : `Осталось: ${remainingPoints}`}
                            </span>
                        </div>

                        <div className="mt-5">
                            <label className="mb-2 block text-sm text-slate-400">Модель проверки</label>
                            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
                                {availableModels.map((model) => {
                                    const isActive = profileForm.ai_model_key === model.key;

                                    return (
                                        <button
                                            key={model.key}
                                            type="button"
                                            onClick={() => setProfileForm((previous) => ({
                                                ...previous,
                                                ai_model_key: model.key
                                            }))}
                                            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'}`}
                                        >
                                            {model.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-5 space-y-4">
                            {profileForm.rubric.map((criterion, index) => (
                                <div key={criterion.id || index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">Критерий {index + 1}</p>
                                            <p className="mt-1 text-xs text-slate-500">Название, инструкция для ИИ и баллы за этот критерий.</p>
                                        </div>
                                        {profileForm.rubric.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeCriterion(index)}
                                                className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                            >
                                                <HiTrash className="h-4 w-4" />
                                                Удалить
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),160px]">
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-400">Название</label>
                                            <input
                                                type="text"
                                                value={criterion.label}
                                                onChange={(event) => updateCriterion(index, 'label', event.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            {errors[`rubric.${index}.label`] && (
                                                <p className="mt-2 text-sm text-red-400">{errors[`rubric.${index}.label`]}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm text-slate-400">Баллы</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxScore}
                                                value={criterion.weight}
                                                onChange={(event) => updateCriterion(index, 'weight', event.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            {errors[`rubric.${index}.weight`] && (
                                                <p className="mt-2 text-sm text-red-400">{errors[`rubric.${index}.weight`]}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className="mb-2 block text-sm text-slate-400">Инструкция для ИИ</label>
                                        <textarea
                                            value={criterion.description}
                                            onChange={(event) => updateCriterion(index, 'description', event.target.value)}
                                            rows={4}
                                            placeholder="Например: проверь полноту решения, объясни, за что сняты баллы, и приведи короткое доказательство."
                                            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
                                        />
                                        {errors[`rubric.${index}.description`] && (
                                            <p className="mt-2 text-sm text-red-400">{errors[`rubric.${index}.description`]}</p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {errors.rubric && <p className="text-sm text-red-400">{errors.rubric}</p>}
                            {errors.totalPoints && <p className="text-sm text-red-400">{errors.totalPoints}</p>}

                            <button
                                type="button"
                                onClick={addCriterion}
                                className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20"
                            >
                                <HiPlus className="h-4 w-4" />
                                Добавить критерий
                            </button>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingProfile && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                                {savingProfile ? 'Сохраняем...' : 'Сохранить настройки'}
                            </button>
                        </div>
                    </section>
                )}

                {!accessDenied && (
                    <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <HiSparkles className="h-5 w-5 text-purple-300" />
                                    <h2 className="text-xl font-semibold text-white">Результаты проверки искусственным интеллектом</h2>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Здесь собраны статусы и результаты AI-проверки по последним сданным работам студентов.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleQueueAllAiReviews}
                                disabled={queueingAllAiReviews || pollingAiReviews || groupedSubmissions.length === 0}
                                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <HiArrowPath className={`h-4 w-4 ${queueingAllAiReviews || pollingAiReviews ? 'animate-spin' : ''}`} />
                                {queueingAllAiReviews
                                    ? 'Запускаем...'
                                    : pollingAiReviews ? 'Ждем результаты...' : 'Проверить все работы'}
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-2 text-xs sm:max-w-xl">
                            <div className="rounded-xl bg-white/[0.04] p-3">
                                <p className="text-slate-500">Готово</p>
                                <p className="mt-1 text-lg font-semibold text-emerald-200">{aiReviewStats.completed}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] p-3">
                                <p className="text-slate-500">В работе</p>
                                <p className="mt-1 text-lg font-semibold text-purple-200">{aiReviewStats.active}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] p-3">
                                <p className="text-slate-500">Ошибки</p>
                                <p className="mt-1 text-lg font-semibold text-red-200">{aiReviewStats.failed}</p>
                            </div>
                        </div>

                        {groupedSubmissions.length === 0 ? (
                            <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
                                Пока нет сданных работ для проверки.
                            </div>
                        ) : (
                            <div className="mt-5 space-y-3">
                                {groupedSubmissions.map((group) => {
                                    const review = latestAiReviewByStudent.get(group.userId);
                                    const status = getAiReviewStatus(review);
                                    const isQueueing = queueingAiReviewFor === group.userId;

                                    return (
                                        <div key={group.userId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-white">{group.user?.name || 'Студент'}</p>
                                                    <p className="truncate text-sm text-slate-500">{group.user?.email || 'Почта не указана'}</p>
                                                    <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                                                        <HiDocumentText className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{getDisplayFileName(group.latestSubmission)}</span>
                                                        <span className="shrink-0">· {formatDateTime(group.latestSubmission.created_at)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                                                        {status.label}
                                                    </span>
                                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                                                        {formatGradeValue(getAiReviewScore(review), maxScore)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQueueAiReview(group, Boolean(review))}
                                                        disabled={isQueueing || pollingAiReviews}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isQueueing && <HiArrowPath className="h-4 w-4 animate-spin" />}
                                                        {isQueueing ? 'Запускаем...' : review ? 'Перепроверить' : 'Запустить'}
                                                    </button>
                                                </div>
                                            </div>

                                            {review?.summary && (
                                                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                                                    {review.summary}
                                                </p>
                                            )}

                                            {review?.error_message && (
                                                <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-200">
                                                    {formatAiRuntimeMessage(review.error_message)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </MainLayout>
    );
};

export default TaskReviewSettingsPage;
