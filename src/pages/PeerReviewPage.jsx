import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    HiArrowTopRightOnSquare,
    HiCheckCircle,
    HiClipboardDocumentCheck,
    HiClock,
    HiDocumentText,
    HiMagnifyingGlass
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildFilePreviewPath } from '../utils/routeUtils';
import {
    loadAllPeerReviewAssignments,
    loadAllPeerReviewResults,
    savePeerReviewResult
} from '../utils/peerReviewUtils';

const buildTaskPathFromAssignment = (assignment) => (
    `/course/${assignment.course_identifier}/discipline/${assignment.discipline_identifier}/task/${assignment.task_number}`
);

const getAssignmentResult = (assignment, results) => (
    results.find((result) => result.assignment_id === assignment.id) || null
);

const PeerReviewPage = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [assignments, setAssignments] = useState([]);
    const [results, setResults] = useState([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [forms, setForms] = useState({});

    useEffect(() => {
        const nextAssignments = loadAllPeerReviewAssignments()
            .filter((assignment) => Number(assignment.reviewer_id) === Number(user?.id))
            .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
        const nextResults = loadAllPeerReviewResults()
            .filter((result) => Number(result.reviewer_id) === Number(user?.id));

        setAssignments(nextAssignments);
        setResults(nextResults);
        setSelectedAssignmentId(nextAssignments[0]?.id || null);

        const nextForms = {};
        nextAssignments.forEach((assignment) => {
            const result = getAssignmentResult(assignment, nextResults);
            nextForms[assignment.id] = {
                grade: result?.grade ?? '',
                comment: result?.comment || ''
            };
        });
        setForms(nextForms);
    }, [user?.id]);

    const stats = useMemo(() => {
        const completedIds = new Set(results.map((result) => result.assignment_id));
        return {
            total: assignments.length,
            completed: assignments.filter((assignment) => completedIds.has(assignment.id)).length
        };
    }, [assignments, results]);

    const filteredAssignments = useMemo(() => {
        const completedIds = new Set(results.map((result) => result.assignment_id));
        const query = searchQuery.trim().toLowerCase();

        return assignments.filter((assignment) => {
            const isCompleted = completedIds.has(assignment.id);

            if (filter === 'pending' && isCompleted) {
                return false;
            }

            if (filter === 'completed' && !isCompleted) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                assignment.task_name,
                assignment.course_name,
                assignment.discipline_name,
                assignment.file_name,
                assignment.blind ? '' : assignment.target_user_name
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    }, [assignments, filter, results, searchQuery]);

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

    const handleSave = () => {
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

        setResults(loadAllPeerReviewResults().filter((result) => Number(result.reviewer_id) === Number(user?.id)));
        showToast('success', 'Взаимопроверка сохранена');
    };

    return (
        <MainLayout>
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                                <HiClipboardDocumentCheck className="h-4 w-4" />
                                Взаимопроверка
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                                Работы, которые нужно оценить
                            </h1>
                            <p className="mt-4 text-sm leading-7 text-slate-400">
                                Здесь появляются задания, которые преподаватель сформировал для взаимопроверки.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
                                <p className="text-xs text-slate-500">Всего</p>
                                <p className="mt-1 text-2xl font-semibold text-white">{stats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
                                <p className="text-xs text-slate-500">Готово</p>
                                <p className="mt-1 text-2xl font-semibold text-emerald-200">{stats.completed}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
                    <section className="self-start rounded-2xl border border-white/10 bg-white/[0.03] p-5 xl:sticky xl:top-6">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <label className="flex items-center gap-3 text-sm text-slate-300" htmlFor="peer-search">
                                <HiMagnifyingGlass className="h-4 w-4 text-slate-500" />
                                <input
                                    id="peer-search"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Поиск по заданию или курсу"
                                    className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                                />
                            </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
                                className={`rounded-full px-3 py-1.5 transition ${
                                    filter === 'pending' ? 'bg-purple-500/15 text-purple-100' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                }`}
                            >
                                Ждут проверки
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
                                className={`rounded-full px-3 py-1.5 transition ${
                                    filter === 'completed' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                }`}
                            >
                                Проверены
                            </button>
                        </div>

                        <div className="mt-5 space-y-3">
                            {filteredAssignments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                                    Пока нет работ для взаимопроверки.
                                </div>
                            ) : (
                                filteredAssignments.map((assignment) => {
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
                                                    <p className="truncate text-xs text-slate-500">{assignment.course_name}</p>
                                                </div>
                                                {isCompleted ? (
                                                    <HiCheckCircle className="h-5 w-5 text-emerald-300" />
                                                ) : (
                                                    <HiClock className="h-5 w-5 text-slate-500" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {selectedAssignment ? (
                        <section className="space-y-6">
                            <div className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-purple-200">{selectedAssignment.discipline_name}</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-white">{selectedAssignment.task_name}</h2>
                                        <p className="mt-2 text-sm text-slate-500">
                                            {selectedAssignment.blind
                                                ? 'Слепая проверка: автор работы скрыт.'
                                                : `Автор работы: ${selectedAssignment.target_user_name || selectedAssignment.target_user_email}`}
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

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                                <h2 className="text-xl font-semibold text-white">Ваша оценка</h2>
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
                                        className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500"
                                    >
                                        Сохранить проверку
                                    </button>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-slate-500">
                            Выберите работу из списка слева.
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default PeerReviewPage;
