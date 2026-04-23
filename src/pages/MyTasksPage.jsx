import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiCalendar,
    HiMagnifyingGlass,
    HiMiniRectangleStack,
    HiPaperClip,
    HiStar
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { buildTaskPath } from '../utils/routeUtils';

const emptyPaginatedResponse = { data: [] };

const formatDateTime = (dateString) => {
    if (!dateString) {
        return 'Не указано';
    }

    return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const MyTasksPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

    const fetchMyTasks = useCallback(async () => {
        setLoading(true);

        try {
            const filesData = await fileService.getMyFiles({ per_page: 200 }).catch((error) => {
                if (error.response?.status === 404) {
                    return { files: emptyPaginatedResponse };
                }

                throw error;
            });

            const submissions = extractCollection(filesData, 'files')
                .filter((file) => file.type === 'submission' && file.task_id && file.course_id)
                .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

            if (!submissions.length) {
                setEntries([]);
                return;
            }

            const courseIds = [...new Set(submissions.map((submission) => Number(submission.course_id)))];

            const courseBundles = await Promise.all(
                courseIds.map(async (courseId) => {
                    const [courseData, disciplinesData, tasksData, gradesData] = await Promise.all([
                        courseService.getCourse(courseId),
                        disciplineService.getDisciplinesByCourse(courseId).catch(() => ({ data: [] })),
                        taskService.getTasks({ course_id: courseId, per_page: 100 }).catch(() => ({ data: [] })),
                        gradeService.getMyGrades(courseId, 100).catch((error) => {
                            if (error.response?.status === 404) {
                                return emptyPaginatedResponse;
                            }

                            throw error;
                        })
                    ]);

                    return {
                        courseId,
                        course: courseData.course || courseData,
                        disciplines: disciplinesData.data || [],
                        tasks: tasksData.data || [],
                        grades: extractCollection(gradesData, 'grades')
                    };
                })
            );

            const courseMap = new Map();
            const disciplineMap = new Map();
            const taskMap = new Map();
            const gradeMap = new Map();

            courseBundles.forEach(({ courseId, course, disciplines, tasks, grades }) => {
                courseMap.set(courseId, course);
                disciplines.forEach((discipline) => {
                    disciplineMap.set(Number(discipline.id), discipline);
                });
                tasks.forEach((task) => {
                    taskMap.set(Number(task.id), task);
                });
                grades.forEach((grade) => {
                    gradeMap.set(`${courseId}:${Number(grade.task_id)}`, grade);
                });
            });

            const groupedByTask = new Map();

            submissions.forEach((submission) => {
                const key = `${submission.course_id}:${submission.task_id}`;
                const existing = groupedByTask.get(key);

                if (existing) {
                    existing.submissionsCount += 1;
                    return;
                }

                groupedByTask.set(key, {
                    courseId: Number(submission.course_id),
                    taskId: Number(submission.task_id),
                    latestSubmission: submission,
                    submissionsCount: 1
                });
            });

            const nextEntries = Array.from(groupedByTask.values())
                .map((group) => {
                    const course = courseMap.get(group.courseId);
                    const task = taskMap.get(group.taskId);
                    const discipline = disciplineMap.get(Number(task?.discipline_id));
                    const grade = gradeMap.get(`${group.courseId}:${group.taskId}`) || null;

                    if (!course || !task || !discipline) {
                        return null;
                    }

                    return {
                        ...group,
                        course,
                        task,
                        discipline,
                        grade
                    };
                })
                .filter(Boolean)
                .sort((left, right) => new Date(right.latestSubmission.created_at) - new Date(left.latestSubmission.created_at));

            setEntries(nextEntries);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить мои задания');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchMyTasks();
    }, [fetchMyTasks]);

    const filteredEntries = useMemo(() => {
        if (!deferredSearchQuery) {
            return entries;
        }

        return entries.filter((entry) => {
            const haystack = [
                entry.task?.name,
                entry.course?.name,
                entry.discipline?.name
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(deferredSearchQuery);
        });
    }, [deferredSearchQuery, entries]);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-full items-center justify-center">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_36%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs uppercase tracking-[0.32em] text-sky-200/70">Мои задания</p>
                            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Все задания, которые вы отправляли</h1>
                            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                                Здесь собраны ваши отправленные задания. Нажмите на карточку, чтобы сразу перейти в нужное задание.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
                            <div className="text-3xl font-semibold text-white">{entries.length}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">отправленных заданий</div>
                        </div>
                    </div>
                </section>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <label className="flex items-center gap-3 text-sm text-slate-300" htmlFor="my-tasks-search">
                        <HiMagnifyingGlass className="h-4 w-4 text-slate-500" />
                        <input
                            id="my-tasks-search"
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Поиск по заданию, курсу или дисциплине"
                            className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                        />
                    </label>
                </div>

                {filteredEntries.length === 0 ? (
                    <div className="rounded-[32px] border border-dashed border-white/10 px-6 py-16 text-center text-gray-500">
                        {entries.length === 0
                            ? 'Вы пока не отправляли задания.'
                            : 'По этому запросу ничего не найдено.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {filteredEntries.map((entry) => (
                            <button
                                key={`${entry.courseId}:${entry.taskId}`}
                                type="button"
                                onClick={() => navigate(buildTaskPath(entry.course, entry.discipline, entry.task))}
                                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{entry.course.name}</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-white">{entry.task.name}</h2>
                                        <p className="mt-2 text-sm text-slate-400">{entry.discipline.name}</p>
                                    </div>

                                    {entry.grade && (
                                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
                                            <div className="text-lg font-semibold text-emerald-200">
                                                {entry.grade.grade}/{Number(entry.task.scores) || 100}
                                            </div>
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/70">оценка</div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        <HiPaperClip className="h-3.5 w-3.5" />
                                        Версий: {entry.submissionsCount}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        <HiCalendar className="h-3.5 w-3.5" />
                                        Последняя отправка: {formatDateTime(entry.latestSubmission.created_at)}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        <HiMiniRectangleStack className="h-3.5 w-3.5" />
                                        Задание #{entry.task.task_number}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        <HiStar className="h-3.5 w-3.5 text-yellow-400" />
                                        Максимум: {Number(entry.task.scores) || 100}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default MyTasksPage;
