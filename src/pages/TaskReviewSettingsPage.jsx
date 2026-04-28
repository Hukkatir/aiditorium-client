import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiCheck,
    HiPlus,
    HiShieldCheck,
    HiSparkles,
    HiTrash,
    HiUserGroup
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { aiReviewService } from '../services/aiReviewService';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import {
    DEFAULT_AI_RUBRIC,
    DEFAULT_AI_SUPPORTED_FORMATS,
    DEFAULT_PEER_REVIEW_SETTINGS,
    loadPeerReviewSettings,
    savePeerReviewSettings
} from '../utils/reviewSettingsUtils';
import { buildTaskPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

const normalizeCriterion = (criterion = {}, index = 0) => ({
    id: criterion.id || `criterion-${index + 1}`,
    label: criterion.label || '',
    description: criterion.description || '',
    instructions: criterion.instructions || '',
    weight: criterion.weight ?? '',
    checks: Array.isArray(criterion.checks) ? criterion.checks : []
});

const normalizeProfile = (profile = {}) => ({
    enabled: Boolean(profile.enabled),
    rubric: Array.isArray(profile.rubric) && profile.rubric.length
        ? profile.rubric.map(normalizeCriterion)
        : DEFAULT_AI_RUBRIC.map(normalizeCriterion),
    custom_prompt: profile.custom_prompt || '',
    supported_formats: Array.isArray(profile.supported_formats) && profile.supported_formats.length
        ? profile.supported_formats
        : DEFAULT_AI_SUPPORTED_FORMATS
});

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

const TaskReviewSettingsPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [profileForm, setProfileForm] = useState(() => normalizeProfile());
    const [peerForm, setPeerForm] = useState(DEFAULT_PEER_REVIEW_SETTINGS);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPeer, setSavingPeer] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';
    const submissionsPath = task && course && discipline
        ? buildTaskSubmissionsPath(course, discipline, task)
        : '/courses';

    const totalWeight = useMemo(
        () => profileForm.rubric.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0),
        [profileForm.rubric]
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setAccessDenied(false);

        try {
            const taskData = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
            const taskObject = taskData.task || taskData;

            const [courseData, disciplineData, profileData] = await Promise.all([
                courseService.getCourse(taskObject.course_id),
                disciplineService.getDiscipline(taskObject.course_id, taskObject.discipline_id),
                aiReviewService.getReviewProfile(taskObject.id).catch((error) => {
                    if (error.response?.status === 403) {
                        setAccessDenied(true);
                        return { profile: null };
                    }

                    throw error;
                })
            ]);

            setTask(taskObject);
            setCourse(courseData.course || courseData);
            setDiscipline(disciplineData.discipline || disciplineData);
            setProfileForm(normalizeProfile(profileData.profile));
            setPeerForm(loadPeerReviewSettings(taskObject.id));
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось загрузить настройки проверки');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, showToast, taskNumber]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateProfileField = (field, value) => {
        setProfileForm((previous) => ({ ...previous, [field]: value }));
    };

    const updateCriterion = (index, field, value) => {
        setProfileForm((previous) => ({
            ...previous,
            rubric: previous.rubric.map((criterion, criterionIndex) => (
                criterionIndex === index ? { ...criterion, [field]: value } : criterion
            ))
        }));
    };

    const updateCriterionChecks = (index, value) => {
        updateCriterion(
            index,
            'checks',
            value
                .split('\n')
                .map((check) => check.trim())
                .filter(Boolean)
        );
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
                    weight: '',
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

    const toggleFormat = (format) => {
        setProfileForm((previous) => {
            const formats = previous.supported_formats.includes(format)
                ? previous.supported_formats.filter((item) => item !== format)
                : [...previous.supported_formats, format];

            return { ...previous, supported_formats: formats };
        });
    };

    const validateProfile = () => {
        const nextErrors = {};

        if (!profileForm.rubric.length) {
            nextErrors.rubric = 'Добавьте хотя бы один критерий проверки.';
        }

        profileForm.rubric.forEach((criterion, index) => {
            if (!criterion.label.trim()) {
                nextErrors[`rubric.${index}.label`] = 'Введите название критерия.';
            }

            if (!criterion.description.trim()) {
                nextErrors[`rubric.${index}.description`] = 'Введите описание критерия.';
            }

            if (criterion.weight !== '' && (Number(criterion.weight) < 0 || Number(criterion.weight) > 100)) {
                nextErrors[`rubric.${index}.weight`] = 'Вес должен быть от 0 до 100.';
            }
        });

        if (!profileForm.supported_formats.length) {
            nextErrors.supported_formats = 'Выберите хотя бы один формат файла.';
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
            showToast('error', 'Проверьте поля настройки AI-проверки');
            return;
        }

        setErrors({});
        setSavingProfile(true);

        try {
            const payload = {
                enabled: profileForm.enabled,
                rubric: profileForm.rubric.map((criterion, index) => ({
                    id: criterion.id || `criterion-${index + 1}`,
                    label: criterion.label.trim(),
                    description: criterion.description.trim(),
                    instructions: criterion.instructions.trim() || null,
                    weight: criterion.weight === '' ? null : Number(criterion.weight),
                    checks: criterion.checks
                })),
                custom_prompt: profileForm.custom_prompt.trim() || null,
                supported_formats: profileForm.supported_formats
            };

            await aiReviewService.updateReviewProfile(task.id, payload);
            setProfileForm(normalizeProfile(payload));
            showToast('success', 'Настройки AI-проверки сохранены');
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось сохранить настройки AI-проверки');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSavePeerSettings = () => {
        if (!task) {
            return;
        }

        setSavingPeer(true);
        savePeerReviewSettings(task.id, peerForm);
        window.setTimeout(() => {
            setSavingPeer(false);
            showToast('success', 'Настройки взаимопроверки сохранены');
        }, 200);
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
                    <p className="text-xl text-gray-400">Настройки проверки недоступны</p>
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
            <div className="mx-auto max-w-7xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(submissionsPath)}
                        className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Назад к проверке
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(taskPath)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    >
                        Открыть задание
                    </button>
                </div>

                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                                <HiShieldCheck className="h-4 w-4" />
                                Настройки проверки
                            </div>
                            <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">{task.name}</h1>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                Здесь настраиваются критерии AI-проверки, режим взаимопроверки и правила, по которым потом собирается журнал оценок.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                            <p className="text-slate-500">Дисциплина</p>
                            <p className="mt-1 font-medium text-white">{discipline.name}</p>
                            <p className="mt-4 text-slate-500">Сумма весов</p>
                            <p className={totalWeight === 100 ? 'mt-1 font-medium text-emerald-300' : 'mt-1 font-medium text-amber-200'}>
                                {totalWeight || 0}%
                            </p>
                        </div>
                    </div>
                </section>

                {accessDenied ? (
                    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
                        Настройки AI-проверки может менять только автор задания или пользователь с правом управления проверкой.
                    </section>
                ) : (
                    <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <HiSparkles className="h-5 w-5 text-purple-300" />
                                    <h2 className="text-xl font-semibold text-white">AI-проверка</h2>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    Критерии отправляются в backend и используются при запуске проверки файла студента.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => updateProfileField('enabled', !profileForm.enabled)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                    profileForm.enabled
                                        ? 'border-purple-400/40 bg-purple-500/20 text-purple-100'
                                        : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                                }`}
                            >
                                {profileForm.enabled ? 'AI включен' : 'AI выключен'}
                            </button>
                        </div>

                        <div className="mt-5 space-y-4">
                            {profileForm.rubric.map((criterion, index) => (
                                <div key={criterion.id || index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">Критерий {index + 1}</p>
                                            <p className="mt-1 text-xs text-slate-500">Название, описание и чек-лист для AI.</p>
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

                                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),140px]">
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
                                            <label className="mb-2 block text-sm text-slate-400">Вес, %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={criterion.weight}
                                                onChange={(event) => updateCriterion(index, 'weight', event.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            {errors[`rubric.${index}.weight`] && (
                                                <p className="mt-2 text-sm text-red-400">{errors[`rubric.${index}.weight`]}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-400">Описание</label>
                                            <textarea
                                                value={criterion.description}
                                                onChange={(event) => updateCriterion(index, 'description', event.target.value)}
                                                rows={4}
                                                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            {errors[`rubric.${index}.description`] && (
                                                <p className="mt-2 text-sm text-red-400">{errors[`rubric.${index}.description`]}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm text-slate-400">Инструкция для AI</label>
                                            <textarea
                                                value={criterion.instructions}
                                                onChange={(event) => updateCriterion(index, 'instructions', event.target.value)}
                                                rows={4}
                                                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className="mb-2 block text-sm text-slate-400">Чек-лист, каждый пункт с новой строки</label>
                                        <textarea
                                            value={criterion.checks.join('\n')}
                                            onChange={(event) => updateCriterionChecks(index, event.target.value)}
                                            rows={3}
                                            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                        />
                                    </div>
                                </div>
                            ))}

                            {errors.rubric && <p className="text-sm text-red-400">{errors.rubric}</p>}

                            <button
                                type="button"
                                onClick={addCriterion}
                                className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20"
                            >
                                <HiPlus className="h-4 w-4" />
                                Добавить критерий
                            </button>
                        </div>

                        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr),340px]">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-400">Дополнительный промпт</label>
                                <textarea
                                    value={profileForm.custom_prompt}
                                    onChange={(event) => updateProfileField('custom_prompt', event.target.value)}
                                    rows={6}
                                    placeholder="Например: обращай внимание на комментарии в коде и кратко объясняй, за что сняты баллы."
                                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <p className="mb-3 text-sm font-medium text-slate-400">Форматы файлов</p>
                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_AI_SUPPORTED_FORMATS.map((format) => {
                                        const selected = profileForm.supported_formats.includes(format);

                                        return (
                                            <button
                                                key={format}
                                                type="button"
                                                onClick={() => toggleFormat(format)}
                                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                    selected
                                                        ? 'border-purple-400/40 bg-purple-500/20 text-purple-100'
                                                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                                                }`}
                                            >
                                                {selected && <HiCheck className="mr-1 inline h-3.5 w-3.5" />}
                                                {format}
                                            </button>
                                        );
                                    })}
                                </div>
                                {errors.supported_formats && <p className="mt-2 text-sm text-red-400">{errors.supported_formats}</p>}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingProfile ? 'Сохраняем...' : 'Сохранить AI-настройки'}
                            </button>
                        </div>
                    </section>
                )}

                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <HiUserGroup className="h-5 w-5 text-purple-300" />
                                <h2 className="text-xl font-semibold text-white">Взаимопроверка студентами</h2>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                                Настройки режима: слепая проверка скрывает автора работы, открытая показывает имя студента.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setPeerForm((previous) => ({ ...previous, enabled: !previous.enabled }))}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                peerForm.enabled
                                    ? 'border-purple-400/40 bg-purple-500/20 text-purple-100'
                                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                            }`}
                        >
                            {peerForm.enabled ? 'Взаимопроверка включена' : 'Взаимопроверка выключена'}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[360px,minmax(0,1fr)]">
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => setPeerForm((previous) => ({ ...previous, mode: 'blind' }))}
                                className={`w-full rounded-2xl border p-4 text-left transition ${
                                    peerForm.mode === 'blind'
                                        ? 'border-purple-400/30 bg-purple-500/10'
                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                                }`}
                            >
                                <p className="font-semibold text-white">Слепая проверка</p>
                                <p className="mt-1 text-sm text-slate-500">Студент не видит, чью работу проверяет.</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeerForm((previous) => ({ ...previous, mode: 'open' }))}
                                className={`w-full rounded-2xl border p-4 text-left transition ${
                                    peerForm.mode === 'open'
                                        ? 'border-purple-400/30 bg-purple-500/10'
                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                                }`}
                            >
                                <p className="font-semibold text-white">Открытая проверка</p>
                                <p className="mt-1 text-sm text-slate-500">Имя автора работы видно проверяющему студенту.</p>
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <label className="mb-2 block text-sm text-slate-400">Проверок на одного студента</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={peerForm.reviewsPerStudent}
                                    onChange={(event) => setPeerForm((previous) => ({
                                        ...previous,
                                        reviewsPerStudent: event.target.value
                                    }))}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-sm text-slate-400">Оценка от студента</p>
                                <button
                                    type="button"
                                    onClick={() => setPeerForm((previous) => ({ ...previous, allowScore: !previous.allowScore }))}
                                    className={`mt-3 rounded-full border px-4 py-2 text-sm font-medium transition ${
                                        peerForm.allowScore
                                            ? 'border-purple-400/40 bg-purple-500/20 text-purple-100'
                                            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                                    }`}
                                >
                                    {peerForm.allowScore ? 'Студент ставит баллы' : 'Только комментарий'}
                                </button>
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-slate-400">Инструкция для студентов</label>
                                <textarea
                                    value={peerForm.instructions}
                                    onChange={(event) => setPeerForm((previous) => ({ ...previous, instructions: event.target.value }))}
                                    rows={5}
                                    placeholder="Напишите, на что студентам обращать внимание при взаимопроверке."
                                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-2xl text-xs leading-5 text-slate-500">
                            Режим взаимопроверки отображается в журнале. Оценки студентов будут попадать в отдельную колонку взаимопроверки.
                        </p>

                        <button
                            type="button"
                            onClick={handleSavePeerSettings}
                            disabled={savingPeer}
                            className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                        >
                            {savingPeer ? 'Сохраняем...' : 'Сохранить взаимопроверку'}
                        </button>
                    </div>
                </section>
            </div>
        </MainLayout>
    );
};

export default TaskReviewSettingsPage;
