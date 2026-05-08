import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiCheck,
    HiUserGroup
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { peerReviewService } from '../services/peerReviewService';
import { taskService } from '../services/taskService';
import {
    DEFAULT_PEER_REVIEW_SETTINGS,
    loadPeerReviewSettings,
    normalizePeerReviewSettings,
    savePeerReviewSettings
} from '../utils/reviewSettingsUtils';
import { buildTaskAiReviewSettingsPath, buildTaskPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

const TaskPeerReviewSettingsPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [peerForm, setPeerForm] = useState(DEFAULT_PEER_REVIEW_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [savingPeer, setSavingPeer] = useState(false);
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
                const settingsData = await peerReviewService.getTaskSettings(taskObject.id);
                setPeerForm(normalizePeerReviewSettings(settingsData.settings || settingsData));
            } catch (settingsError) {
                console.error(settingsError);
                setPeerBackendUnavailable(true);
                setPeerForm(loadPeerReviewSettings(taskObject.id));
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

    const handleSavePeerSettings = async () => {
        if (!task) {
            return;
        }

        const nextSettings = normalizePeerReviewSettings({
            ...peerForm,
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
            </div>
        </MainLayout>
    );
};

export default TaskPeerReviewSettingsPage;
