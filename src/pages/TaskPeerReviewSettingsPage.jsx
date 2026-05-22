import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiArrowPath,
    HiCheck,
    HiUserGroup
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { peerReviewService } from '../services/peerReviewService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import {
    DEFAULT_PEER_REVIEW_SETTINGS,
    loadPeerReviewSettings,
    normalizePeerReviewSettings,
    savePeerReviewSettings
} from '../utils/reviewSettingsUtils';
import {
    generatePeerReviewAssignments,
    loadPeerReviewAssignments,
    loadPeerReviewResults,
    savePeerReviewAssignments
} from '../utils/peerReviewUtils';
import { getNumericGrade, formatGradeValue } from '../utils/gradeReviewUtils';
import { buildTaskAiReviewSettingsPath, buildTaskPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

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

const TaskPeerReviewSettingsPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [peerForm, setPeerForm] = useState(DEFAULT_PEER_REVIEW_SETTINGS);
    const [submissions, setSubmissions] = useState([]);
    const [peerAssignments, setPeerAssignments] = useState([]);
    const [peerResults, setPeerResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingPeer, setSavingPeer] = useState(false);
    const [generatingPeerAssignments, setGeneratingPeerAssignments] = useState(false);
    const [peerBackendUnavailable, setPeerBackendUnavailable] = useState(false);

    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';
    const submissionsPath = task && course && discipline
        ? buildTaskSubmissionsPath(course, discipline, task)
        : '/courses';
    const aiSettingsPath = task && course && discipline
        ? buildTaskAiReviewSettingsPath(course, discipline, task)
        : '/courses';

    const maxScore = useMemo(() => {
        const score = Number(task?.scores);
        return Number.isFinite(score) && score > 0 ? score : 100;
    }, [task]);

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

    const peerReviewRows = useMemo(() => {
        const resultsByAssignmentId = new Map(
            peerResults.map((result) => [String(result.assignment_id), result])
        );

        return peerAssignments.map((assignment) => {
            const result = assignment.result
                || resultsByAssignmentId.get(String(assignment.id))
                || resultsByAssignmentId.get(String(assignment.assignment_key))
                || null;

            return {
                id: assignment.id || assignment.assignment_key,
                reviewerName: assignment.reviewer_name || result?.reviewer_name || assignment.reviewer_email || result?.reviewer_email || `Студент #${assignment.reviewer_id}`,
                reviewerEmail: assignment.reviewer_email || result?.reviewer_email || '',
                targetName: assignment.target_user_name || result?.target_user_name || assignment.target_user_email || result?.target_user_email || `Студент #${assignment.target_user_id}`,
                targetEmail: assignment.target_user_email || result?.target_user_email || '',
                fileName: assignment.file_name || result?.file_name || 'Файл',
                grade: getNumericGrade(result?.grade),
                comment: result?.comment || '',
                reviewedAt: result?.updated_at || result?.created_at || null,
                isCompleted: Boolean(result)
            };
        });
    }, [peerAssignments, peerResults]);

    const completedPeerReviewRows = useMemo(
        () => peerReviewRows.filter((row) => row.isCompleted).length,
        [peerReviewRows]
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setPeerBackendUnavailable(false);

        try {
            const taskData = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
            const taskObject = taskData.task || taskData;

            const [courseData, disciplineData] = await Promise.all([
                courseService.getCourse(taskObject.course_id),
                disciplineService.getDiscipline(taskObject.course_id, taskObject.discipline_id)
            ]);

            setTask(taskObject);
            setCourse(courseData.course || courseData);
            setDiscipline(disciplineData.discipline || disciplineData);

            try {
                const [settingsData, submissionsData, assignmentsData, resultsData] = await Promise.all([
                    peerReviewService.getTaskSettings(taskObject.id),
                    taskService.getTaskSubmissions(taskObject.id, 100).catch(() => ({ submissions: { data: [] } })),
                    peerReviewService.getTaskAssignments(taskObject.id)
                        .catch((assignmentsError) => {
                            console.error(assignmentsError);
                            return { assignments: loadPeerReviewAssignments(taskObject.id) };
                        }),
                    peerReviewService.getTaskResults(taskObject.id)
                        .catch((resultsError) => {
                            console.error(resultsError);
                            return { results: loadPeerReviewResults(taskObject.id) };
                        })
                ]);

                setPeerForm(normalizePeerReviewSettings(settingsData.settings || settingsData));
                setSubmissions(extractCollection(submissionsData, 'submissions'));
                setPeerAssignments(extractCollection(assignmentsData, 'assignments'));
                setPeerResults(extractCollection(resultsData, 'results'));
            } catch (settingsError) {
                console.error(settingsError);
                setPeerBackendUnavailable(true);
                setPeerForm(loadPeerReviewSettings(taskObject.id));
                setSubmissions([]);
                setPeerAssignments(loadPeerReviewAssignments(taskObject.id));
                setPeerResults(loadPeerReviewResults(taskObject.id));
            }
        } catch (error) {
            console.error(error);
            showToast('error', getApiMessage(error) || 'Не удалось загрузить настройки взаимопроверки');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, showToast, taskNumber]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleReviewsPerStudentChange = (value) => {
        if (value === '' || /^\d+$/.test(value)) {
            setPeerForm((previous) => ({
                ...previous,
                reviewsPerStudent: value
            }));
        }
    };

    const normalizeReviewsPerStudentInput = () => {
        setPeerForm((previous) => ({
            ...previous,
            reviewsPerStudent: Math.max(1, Math.floor(Number(previous.reviewsPerStudent) || 1))
        }));
    };

    const handleSavePeerSettings = async () => {
        if (!task) {
            return;
        }

        const reviewsPerStudent = Math.max(1, Math.floor(Number(peerForm.reviewsPerStudent) || 1));
        const nextSettings = normalizePeerReviewSettings({
            ...peerForm,
            reviewsPerStudent,
            reviews_per_student: reviewsPerStudent,
            enabled: true
        });

        setSavingPeer(true);
        savePeerReviewSettings(task.id, nextSettings);

        try {
            const settingsData = await peerReviewService.updateTaskSettings(task.id, nextSettings);
            setPeerForm(normalizePeerReviewSettings(settingsData.settings || nextSettings));
            setSavingPeer(false);
            showToast('success', 'Настройки взаимопроверки сохранены');
        } catch (error) {
            if ([404, 405].includes(error.response?.status)) {
                setSavingPeer(false);
                showToast('success', 'Настройки взаимопроверки сохранены');
                return;
            }

            console.error(error);
            setPeerBackendUnavailable(true);
            setSavingPeer(false);
            showToast('error', getApiMessage(error) || 'Backend взаимопроверки недоступен. Проверьте миграции.');
        }
    };

    const handleGeneratePeerAssignments = async () => {
        if (!task || !course || !discipline) {
            return;
        }

        const nextSettings = normalizePeerReviewSettings(peerForm);
        const assignments = generatePeerReviewAssignments({
            task,
            course,
            discipline,
            groups: groupedSubmissions,
            settings: nextSettings
        });

        if (!assignments.length) {
            showToast('error', 'Для взаимопроверки нужно минимум две сданные работы');
            return;
        }

        setGeneratingPeerAssignments(true);
        savePeerReviewAssignments(task.id, assignments);

        try {
            const assignmentsData = await peerReviewService.replaceTaskAssignments(task.id, assignments);
            const savedAssignments = extractCollection(assignmentsData, 'assignments');
            setPeerAssignments(savedAssignments.length ? savedAssignments : assignments);
            setPeerResults([]);
            showToast('success', `Задания для взаимопроверки созданы: ${savedAssignments.length || assignments.length}`);
        } catch (error) {
            if (![404, 405].includes(error.response?.status)) {
                console.error(error);
                setPeerBackendUnavailable(true);
                showToast('error', getApiMessage(error) || 'Не удалось сформировать задания для взаимопроверки');
                setGeneratingPeerAssignments(false);
                return;
            }

            setPeerAssignments(assignments);
            showToast('success', `Задания для взаимопроверки созданы: ${assignments.length}`);
        }

        setGeneratingPeerAssignments(false);
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
                    <p className="text-xl text-gray-400">Настройки взаимопроверки недоступны</p>
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
                            onClick={() => navigate(aiSettingsPath)}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                        >
                            Проверка искусственным интеллектом
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
                                <HiUserGroup className="h-4 w-4" />
                                Взаимопроверка включена
                            </div>
                            <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">{task.name}</h1>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                Настройте, как студенты будут проверять работы друг друга. Сформировать задания можно на странице проверки работ.
                            </p>
                            {peerBackendUnavailable && (
                                <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-100">
                                    Backend взаимопроверки сейчас недоступен. Настройки можно изменить на странице, но для реальной выдачи заданий студентам нужно выполнить миграции на сервере.
                                </p>
                            )}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                            <p className="text-slate-500">Дисциплина</p>
                            <p className="mt-1 font-medium text-white">{discipline.name}</p>
                            <p className="mt-4 text-slate-500">Режим</p>
                            <p className="mt-1 font-medium text-white">
                                {peerForm.mode === 'open' ? 'Открытая' : 'Слепая'}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <HiUserGroup className="h-5 w-5 text-purple-300" />
                                <h2 className="text-xl font-semibold text-white">Настройки взаимопроверки</h2>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                                Взаимопроверка работает по умолчанию. Выберите только формат и инструкцию для студентов.
                            </p>
                        </div>
                        <span className="rounded-full bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-100">
                            Активна
                        </span>
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
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-white">Слепая проверка</p>
                                        <p className="mt-1 text-sm text-slate-500">Студент не видит, чью работу проверяет.</p>
                                    </div>
                                    {peerForm.mode === 'blind' && <HiCheck className="h-5 w-5 text-purple-200" />}
                                </div>
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
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-white">Открытая проверка</p>
                                        <p className="mt-1 text-sm text-slate-500">Имя автора работы видно проверяющему студенту.</p>
                                    </div>
                                    {peerForm.mode === 'open' && <HiCheck className="h-5 w-5 text-purple-200" />}
                                </div>
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <label className="mb-2 block text-sm text-slate-400">Проверок на одного студента</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={peerForm.reviewsPerStudent}
                                    onChange={(event) => handleReviewsPerStudentChange(event.target.value)}
                                    onBlur={normalizeReviewsPerStudentInput}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                                <p className="mt-2 text-xs text-slate-500">Можно указать 1 и более работ.</p>
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
                            Оценки студентов будут попадать в отдельную колонку взаимопроверки в журнале.
                        </p>

                        <button
                            type="button"
                            onClick={handleSavePeerSettings}
                            disabled={savingPeer}
                            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                        >
                            {savingPeer && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                            {savingPeer ? 'Сохраняем...' : 'Сохранить взаимопроверку'}
                        </button>
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <HiUserGroup className="h-5 w-5 text-purple-300" />
                                <h2 className="text-xl font-semibold text-white">Результаты взаимопроверки</h2>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Здесь видно, кому назначена проверка, чью работу студент проверил и какую оценку поставил.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleGeneratePeerAssignments}
                            disabled={groupedSubmissions.length < 2 || generatingPeerAssignments}
                            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {generatingPeerAssignments && <HiArrowPath className="h-4 w-4 animate-spin" />}
                            {generatingPeerAssignments ? 'Формируем...' : 'Сформировать задания'}
                        </button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                            Студентов с работами: {groupedSubmissions.length}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                            Назначений: {peerAssignments.length}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                            Проверено: {completedPeerReviewRows}
                        </span>
                    </div>

                    {peerReviewRows.length === 0 ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
                            Задания для взаимопроверки еще не сформированы.
                        </div>
                    ) : (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                            <div className="max-h-[520px] overflow-y-auto">
                                {peerReviewRows.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr),140px]"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500">Проверяющий</p>
                                            <p className="mt-1 truncate text-sm font-medium text-white">{row.reviewerName}</p>
                                            {row.reviewerEmail && (
                                                <p className="truncate text-xs text-slate-500">{row.reviewerEmail}</p>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500">Проверенная работа</p>
                                            <p className="mt-1 truncate text-sm font-medium text-white">{row.targetName}</p>
                                            {row.targetEmail && (
                                                <p className="truncate text-xs text-slate-500">{row.targetEmail}</p>
                                            )}
                                            <p className="mt-1 truncate text-xs text-slate-500">{row.fileName}</p>
                                        </div>

                                        <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                                                row.isCompleted
                                                    ? 'bg-emerald-500/10 text-emerald-200'
                                                    : 'bg-white/10 text-slate-300'
                                            }`}>
                                                {row.isCompleted ? formatGradeValue(row.grade, maxScore) : 'Ждет проверки'}
                                            </span>
                                            {row.reviewedAt && (
                                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-400">
                                                    {formatDateTime(row.reviewedAt)}
                                                </span>
                                            )}
                                        </div>

                                        {row.comment && (
                                            <p className="rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400 lg:col-span-3">
                                                {row.comment}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </MainLayout>
    );
};

export default TaskPeerReviewSettingsPage;
