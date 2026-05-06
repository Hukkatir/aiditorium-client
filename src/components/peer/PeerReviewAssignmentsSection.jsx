import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    HiArrowTopRightOnSquare,
    HiCheckCircle,
    HiClipboardDocumentCheck,
    HiClock,
    HiDocumentText,
    HiMagnifyingGlass
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { peerReviewService } from '../../services/peerReviewService';
import { extractCollection } from '../../utils/apiUtils';
import { buildFilePreviewPath } from '../../utils/routeUtils';
import {
    loadAllPeerReviewAssignments,
    loadAllPeerReviewResults,
    savePeerReviewResult
} from '../../utils/peerReviewUtils';

const buildTaskPathFromAssignment = (assignment) => (
    `/course/${assignment.course_identifier}/discipline/${assignment.discipline_identifier}/task/${assignment.task_number}`
);

const getAssignmentResult = (assignment, results) => (
    results.find((result) => result.assignment_id === assignment.id) || null
);

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

const PeerReviewAssignmentsSection = ({ className = '' }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [assignments, setAssignments] = useState([]);
    const [results, setResults] = useState([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [forms, setForms] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

    const reloadPeerReviews = useCallback(async () => {
        if (!user?.id) {
            setAssignments([]);
            setResults([]);
            setSelectedAssignmentId(null);
            return;
        }

        setLoading(true);

        let nextAssignments = [];
        let nextResults = [];

        try {
            const assignmentsData = await peerReviewService.getMyAssignments();
            nextAssignments = extractCollection(assignmentsData, 'assignments')
                .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
            nextResults = nextAssignments
                .map((assignment) => assignment.result)
                .filter(Boolean);
        } catch (error) {
            console.error(error);
            nextAssignments = loadAllPeerReviewAssignments()
                .filter((assignment) => Number(assignment.reviewer_id) === Number(user.id))
                .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
            nextResults = loadAllPeerReviewResults()
                .filter((result) => Number(result.reviewer_id) === Number(user.id));
        }

        setAssignments(nextAssignments);
        setResults(nextResults);
        setSelectedAssignmentId((previousId) => (
            nextAssignments.some((assignment) => assignment.id === previousId)
                ? previousId
                : nextAssignments[0]?.id || null
        ));

        setForms((previousForms) => {
            const nextForms = {};
            nextAssignments.forEach((assignment) => {
                const result = getAssignmentResult(assignment, nextResults);
                nextForms[assignment.id] = {
                    grade: result?.grade ?? previousForms[assignment.id]?.grade ?? '',
                    comment: result?.comment || previousForms[assignment.id]?.comment || ''
                };
            });
            return nextForms;
        });
        setLoading(false);
    }, [user?.id]);

    useEffect(() => {
        reloadPeerReviews();
    }, [reloadPeerReviews]);

    const stats = useMemo(() => {
        const completedIds = new Set(results.map((result) => result.assignment_id));
        return {
            total: assignments.length,
            completed: assignments.filter((assignment) => completedIds.has(assignment.id)).length,
            pending: assignments.filter((assignment) => !completedIds.has(assignment.id)).length
        };
    }, [assignments, results]);

    const filteredAssignments = useMemo(() => {
        const completedIds = new Set(results.map((result) => result.assignment_id));

        return assignments.filter((assignment) => {
            const isCompleted = completedIds.has(assignment.id);

            if (filter === 'pending' && isCompleted) {
                return false;
            }

            if (filter === 'completed' && !isCompleted) {
                return false;
            }

            if (!deferredSearchQuery) {
                return true;
            }

            return [
                assignment.task_name,
                assignment.course_name,
                assignment.discipline_name,
                assignment.file_name,
                assignment.blind ? '' : assignment.target_user_name,
                assignment.blind ? '' : assignment.target_user_email
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(deferredSearchQuery);
        });
    }, [assignments, deferredSearchQuery, filter, results]);

    const selectedAssignment = useMemo(
        () => filteredAssignments.find((assignment) => assignment.id === selectedAssignmentId)
            || filteredAssignments[0]
            || null,
        [filteredAssignments, selectedAssignmentId]
    );

    const selectedResult = selectedAssignment ? getAssignmentResult(selectedAssignment, results) : null;

    const handleChange = (assignmentId, field, value) => {
        setForms((previous) => ({
            ...previous,
            [assignmentId]: {
                ...(previous[assignmentId] || {}),
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (!selectedAssignment) {
            return;
        }

        const form = forms[selectedAssignment.id] || {};
        const maxScore = Number(selectedAssignment.max_score) || 100;
        const numericGrade = form.grade === '' ? null : Number(form.grade);

        if (selectedAssignment.allow_score && (!Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > maxScore)) {
            showToast('error', `Оценка должна быть числом от 0 до ${maxScore}`);
            return;
        }

        if (!String(form.comment || '').trim()) {
            showToast('error', 'Напишите короткий комментарий по работе');
            return;
        }

        setSaving(true);

        try {
            await peerReviewService.saveResult({
                assignment_id: selectedAssignment.id,
                grade: selectedAssignment.allow_score ? numericGrade : null,
                comment: form.comment.trim()
            });
            await reloadPeerReviews();
            setSaving(false);
            showToast('success', 'Взаимопроверка сохранена');
            return;
        } catch (error) {
            if (![404, 405].includes(error.response?.status)) {
                console.error(error);
                showToast('error', getApiMessage(error) || 'Не удалось сохранить взаимопроверку');
                setSaving(false);
                return;
            }
        }

        savePeerReviewResult({
            assignment_id: selectedAssignment.id,
            task_id: selectedAssignment.task_id,
            course_id: selectedAssignment.course_id,
            discipline_id: selectedAssignment.discipline_id,
            reviewer_id: Number(user?.id),
            target_user_id: selectedAssignment.target_user_id,
            file_id: selectedAssignment.file_id,
            grade: selectedAssignment.allow_score ? numericGrade : null,
            comment: form.comment.trim(),
            blind: selectedAssignment.blind,
            created_at: selectedResult?.created_at
        });

        await reloadPeerReviews();
        setSaving(false);
        showToast('success', 'Взаимопроверка сохранена');
    };

    return (
        <section className={`rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6 ${className}`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                        <HiClipboardDocumentCheck className="h-4 w-4" />
                        Взаимопроверка
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
                        Работы, которые нужно проверить
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        Здесь появляются работы других студентов, которые преподаватель назначил вам для взаимопроверки.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-xs text-slate-500">Всего</p>
                        <p className="mt-1 text-xl font-semibold text-white">{stats.total}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-xs text-slate-500">Ждут</p>
                        <p className="mt-1 text-xl font-semibold text-purple-200">{stats.pending}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <p className="text-xs text-slate-500">Готово</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-200">{stats.completed}</p>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <label className="flex min-w-[220px] flex-1 items-center gap-3 text-sm text-slate-300" htmlFor="peer-review-search">
                    <HiMagnifyingGlass className="h-4 w-4 text-slate-500" />
                    <input
                        id="peer-review-search"
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Поиск по заданию, курсу или файлу"
                        className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    />
                </label>

                <div className="flex flex-wrap gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
                        className={`rounded-full px-3 py-1.5 transition ${
                            filter === 'pending' ? 'bg-purple-500/15 text-purple-100' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                        }`}
                    >
                        Ждут проверки: {stats.pending}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
                        className={`rounded-full px-3 py-1.5 transition ${
                            filter === 'completed' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                        }`}
                    >
                        Проверены: {stats.completed}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
                    Загружаем задания для взаимопроверки...
                </div>
            ) : assignments.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
                    Пока нет работ для взаимопроверки.
                </div>
            ) : filteredAssignments.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
                    По этому фильтру ничего не найдено.
                </div>
            ) : (
                <div className="mt-5 grid gap-5 xl:grid-cols-[320px,minmax(0,1fr)]">
                    <div className="space-y-3">
                        {filteredAssignments.map((assignment) => {
                            const isSelected = selectedAssignment?.id === assignment.id;
                            const isCompleted = Boolean(getAssignmentResult(assignment, results));

                            return (
                                <button
                                    key={assignment.id}
                                    type="button"
                                    onClick={() => {
                                        startTransition(() => {
                                            setSelectedAssignmentId(assignment.id);
                                        });
                                    }}
                                    className={`w-full rounded-xl border p-4 text-left transition ${
                                        isSelected
                                            ? 'border-purple-400/30 bg-purple-500/10'
                                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-white">{assignment.task_name}</p>
                                            <p className="truncate text-xs text-slate-500">{assignment.discipline_name}</p>
                                        </div>
                                        {isCompleted ? (
                                            <HiCheckCircle className="h-5 w-5 text-emerald-300" />
                                        ) : (
                                            <HiClock className="h-5 w-5 text-slate-500" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedAssignment && (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-purple-200">{selectedAssignment.course_name}</p>
                                        <h3 className="mt-2 text-2xl font-semibold text-white">{selectedAssignment.task_name}</h3>
                                        <p className="mt-2 text-sm text-slate-500">
                                            {selectedAssignment.blind
                                                ? 'Слепая проверка: автор работы скрыт.'
                                                : `Автор работы: ${selectedAssignment.target_user_name || selectedAssignment.target_user_email || 'не указан'}`}
                                        </p>
                                    </div>
                                    <Link
                                        to={buildTaskPathFromAssignment(selectedAssignment)}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                    >
                                        Открыть задание
                                    </Link>
                                </div>

                                {selectedAssignment.instructions && (
                                    <p className="mt-5 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm leading-6 text-purple-100">
                                        {selectedAssignment.instructions}
                                    </p>
                                )}

                                <Link
                                    to={buildFilePreviewPath(selectedAssignment.file_id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.08]"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-200">
                                            <HiDocumentText className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">{selectedAssignment.file_name}</p>
                                            <p className="text-xs text-slate-500">Откроется предпросмотр файла</p>
                                        </div>
                                    </div>
                                    <HiArrowTopRightOnSquare className="h-4 w-4 text-slate-500" />
                                </Link>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-xl font-semibold text-white">Ваша проверка</h3>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Напишите комментарий по работе. Если преподаватель разрешил оценку, укажите баллы.
                                        </p>
                                    </div>
                                    {selectedResult && (
                                        <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                                            Сохранено
                                        </span>
                                    )}
                                </div>

                                <div className="mt-5 grid gap-4 lg:grid-cols-[220px,minmax(0,1fr)]">
                                    {selectedAssignment.allow_score && (
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-400">Баллы</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={selectedAssignment.max_score || 100}
                                                value={forms[selectedAssignment.id]?.grade ?? ''}
                                                onChange={(event) => handleChange(selectedAssignment.id, 'grade', event.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            <p className="mt-2 text-xs text-slate-500">Максимум: {selectedAssignment.max_score || 100}</p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-2 block text-sm text-slate-400">Комментарий</label>
                                        <textarea
                                            value={forms[selectedAssignment.id]?.comment ?? ''}
                                            onChange={(event) => handleChange(selectedAssignment.id, 'comment', event.target.value)}
                                            rows={5}
                                            placeholder="Что получилось хорошо, что можно улучшить?"
                                            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                                    >
                                        {saving ? 'Сохраняем...' : 'Сохранить проверку'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default PeerReviewAssignmentsSection;
