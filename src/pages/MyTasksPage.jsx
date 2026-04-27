import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
    HiBars3,
    HiCalendar,
    HiMagnifyingGlass,
    HiPaperClip,
    HiSquares2X2
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import TaskCard from '../components/tasks/TaskCard';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { getTaskMaterials } from '../utils/fileUtils';
import { getTaskCreatorName } from '../utils/taskPresentation';

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

const getOwnTaskStatus = (task, latestSubmission) => {
    if (!latestSubmission) {
        return null;
    }

    const deadlineTimestamp = task?.deadline ? new Date(task.deadline).getTime() : null;
    const submittedAt = new Date(latestSubmission.created_at).getTime();
    const isLate = deadlineTimestamp && submittedAt > deadlineTimestamp;

    if (isLate) {
        return {
            key: 'late',
            label: 'Сдано с опозданием',
            className: 'bg-amber-500/10 text-amber-200'
        };
    }

    return {
        key: 'submitted',
        label: 'Сдано',
        className: 'bg-emerald-500/10 text-emerald-200'
    };
};

const MyTasksPage = () => {
    const { showToast } = useToast();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');

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
                    const [courseData, disciplinesData, tasksData, gradesData, usersData] = await Promise.all([
                        courseService.getCourse(courseId),
                        disciplineService.getDisciplinesByCourse(courseId).catch(() => ({ data: [] })),
                        taskService.getTasks({ course_id: courseId, per_page: 100 }).catch(() => ({ data: [] })),
                        gradeService.getMyGrades(courseId, 100).catch((error) => {
                            if (error.response?.status === 404) {
                                return emptyPaginatedResponse;
                            }

                            throw error;
                        }),
                        courseService.getCourseUsers(courseId).catch(() => ({ users: [] }))
                    ]);

                    return {
                        courseId,
                        course: courseData.course || courseData,
                        disciplines: disciplinesData.data || [],
                        tasks: tasksData.data || [],
                        grades: extractCollection(gradesData, 'grades'),
                        users: usersData.users || usersData.data || []
                    };
                })
            );

            const courseMap = new Map();
            const disciplineMap = new Map();
            const taskMap = new Map();
            const gradeMap = new Map();
            const usersMap = new Map();

            courseBundles.forEach(({ courseId, course, disciplines, tasks, grades, users }) => {
                courseMap.set(courseId, course);
                usersMap.set(courseId, users);

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
                    const courseUsers = usersMap.get(group.courseId) || [];

                    if (!course || !task || !discipline) {
                        return null;
                    }

                    return {
                        ...group,
                        course,
                        task,
                        discipline,
                        grade,
                        creatorName: getTaskCreatorName(task, courseUsers)
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
                entry.discipline?.name,
                entry.creatorName
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
                <section className="rounded-2xl border border-white/10 bg-[#1A1A1C] p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-sm text-purple-200/80">Мои задания</p>
                            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
                                Все задания, которые вы отправляли
                            </h1>
                            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                                Здесь собраны ваши отправленные задания. Нажмите на карточку, чтобы сразу перейти в нужное задание.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                            <div className="text-3xl font-semibold text-white">{entries.length}</div>
                            <div className="mt-1 text-sm text-slate-500">отправленных заданий</div>
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <label className="flex min-w-[240px] flex-1 items-center gap-3 text-sm text-slate-300" htmlFor="my-tasks-search">
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

                    <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`rounded-xl p-2.5 transition ${
                                viewMode === 'grid'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                            aria-label="Плитка"
                            title="Плитка"
                        >
                            <HiSquares2X2 className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`rounded-xl p-2.5 transition ${
                                viewMode === 'list'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                            aria-label="Список"
                            title="Список"
                        >
                            <HiBars3 className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {filteredEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-gray-500">
                        {entries.length === 0
                            ? 'Вы пока не отправляли задания.'
                            : 'По этому запросу ничего не найдено.'}
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-4'}>
                        {filteredEntries.map((entry) => (
                            <TaskCard
                                key={`${entry.courseId}:${entry.taskId}`}
                                task={entry.task}
                                course={entry.course}
                                discipline={entry.discipline}
                                layout={viewMode}
                                creatorName={entry.creatorName}
                                courseLabel={entry.course.name}
                                disciplineLabel={entry.discipline.name}
                                status={getOwnTaskStatus(entry.task, entry.latestSubmission)}
                                grade={entry.grade}
                                materialsCount={getTaskMaterials(entry.task).length}
                                extraChips={[
                                    {
                                        key: 'versions',
                                        icon: HiPaperClip,
                                        label: `Версий: ${entry.submissionsCount}`
                                    },
                                    {
                                        key: 'submitted-at',
                                        icon: HiCalendar,
                                        label: `Последняя отправка: ${formatDateTime(entry.latestSubmission.created_at)}`
                                    }
                                ]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default MyTasksPage;
