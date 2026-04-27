import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiBars3,
    HiClock,
    HiPencil,
    HiSquares2X2,
    HiTrash
} from 'react-icons/hi2';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import EditTaskModal from '../components/tasks/EditTaskModal';
import TaskCard from '../components/tasks/TaskCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { getTaskMaterials } from '../utils/fileUtils';
import { buildCoursePath, buildDisciplinePath } from '../utils/routeUtils';
import {
    getTaskCreatorName,
    getTaskSubmissionStatus,
    matchesTaskStatusFilter
} from '../utils/taskPresentation';

const emptyPaginatedResponse = { data: [] };

const getCurrentCourseRole = (course, users, user) => {
    if (!course || !user) {
        return null;
    }

    if (Number(course.creator_id) === Number(user.id)) {
        return 'teacher';
    }

    return users.find((item) => Number(item.id) === Number(user.id))?.pivot?.role || null;
};

const DisciplineDetailPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [discipline, setDiscipline] = useState(null);
    const [course, setCourse] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [courseUsers, setCourseUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showEditDiscipline, setShowEditDiscipline] = useState(false);
    const [showEditTask, setShowEditTask] = useState(false);
    const [showDeleteDisciplineConfirm, setShowDeleteDisciplineConfirm] = useState(false);
    const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [statusFilter, setStatusFilter] = useState('all');
    const [latestSubmissionsByTask, setLatestSubmissionsByTask] = useState(new Map());
    const [gradesByTask, setGradesByTask] = useState(new Map());

    const currentRole = useMemo(() => getCurrentCourseRole(course, courseUsers, user), [course, courseUsers, user]);
    const canManage = currentRole === 'teacher';
    const isArchived = course?.status === 'archived';
    const courseRef = course || { id: discipline?.course_id, slug: courseIdOrSlug };

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const disciplineData = await disciplineService.getDiscipline(courseIdOrSlug, disciplineIdOrSlug);
            const disciplineObject = disciplineData.discipline || disciplineData;
            const courseData = await courseService.getCourse(disciplineObject.course_id);
            const courseObject = courseData.course || courseData;

            const [tasksData, usersData] = await Promise.all([
                taskService.getTasks({
                    course_id: disciplineObject.course_id,
                    discipline_id: disciplineObject.id,
                    per_page: 100
                }).catch(() => ({ data: [] })),
                courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] }))
            ]);

            const nextTasks = tasksData.data || [];
            const nextUsers = usersData.users || usersData.data || [];
            const nextRole = getCurrentCourseRole(courseObject, nextUsers, user);

            setDiscipline(disciplineObject);
            setCourse(courseObject);
            setTasks(nextTasks);
            setCourseUsers(nextUsers);

            if (nextRole !== 'teacher') {
                const [filesData, gradesData] = await Promise.all([
                    fileService.getMyFiles({ per_page: 200 }).catch((error) => {
                        if (error.response?.status === 404) {
                            return { files: emptyPaginatedResponse };
                        }

                        throw error;
                    }),
                    gradeService.getMyGrades(courseObject.id, 100).catch((error) => {
                        if (error.response?.status === 404) {
                            return emptyPaginatedResponse;
                        }

                        throw error;
                    })
                ]);

                const submissionsMap = new Map();
                extractCollection(filesData, 'files')
                    .filter((file) => file.type === 'submission' && Number(file.course_id) === Number(courseObject.id))
                    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
                    .forEach((file) => {
                        const taskId = Number(file.task_id);

                        if (taskId && !submissionsMap.has(taskId)) {
                            submissionsMap.set(taskId, file);
                        }
                    });

                const gradesMap = new Map();
                extractCollection(gradesData, 'grades').forEach((grade) => {
                    gradesMap.set(Number(grade.task_id), grade);
                });

                setLatestSubmissionsByTask(submissionsMap);
                setGradesByTask(gradesMap);
            } else {
                setLatestSubmissionsByTask(new Map());
                setGradesByTask(new Map());
            }

            const canonicalPath = buildDisciplinePath(courseObject, disciplineObject);
            if (window.location.pathname !== canonicalPath) {
                navigate(canonicalPath, { replace: true });
            }
        } catch (error) {
            console.error(error);
            setDiscipline(null);
            setCourse(null);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить данные дисциплины');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, navigate, showToast, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const taskCards = useMemo(
        () => tasks
            .map((task) => {
                const grade = gradesByTask.get(Number(task.id)) || null;
                const latestSubmission = latestSubmissionsByTask.get(Number(task.id)) || null;
                const status = canManage ? null : getTaskSubmissionStatus(task.deadline, latestSubmission);

                return {
                    task,
                    creatorName: getTaskCreatorName(task, courseUsers),
                    materialsCount: getTaskMaterials(task).length,
                    grade,
                    status
                };
            })
            .filter((item) => matchesTaskStatusFilter(item.status, statusFilter)),
        [canManage, courseUsers, gradesByTask, latestSubmissionsByTask, statusFilter, tasks]
    );

    const handleDeleteDiscipline = async () => {
        if (!discipline) {
            return;
        }

        try {
            await disciplineService.deleteDiscipline(discipline.id);
            showToast('success', 'Дисциплина удалена');
            navigate(buildCoursePath(courseRef));
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления дисциплины');
        } finally {
            setShowDeleteDisciplineConfirm(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!selectedTask) {
            return;
        }

        try {
            await taskService.deleteTask(selectedTask.id);
            showToast('success', 'Задание удалено');
            setSelectedTask(null);
            await fetchData();
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления задания');
        } finally {
            setShowDeleteTaskConfirm(false);
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

    if (!discipline) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Дисциплина не найдена</p>
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="mt-4 text-slate-300 transition hover:text-white"
                    >
                        ← Назад
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl space-y-6">
                <button
                    type="button"
                    onClick={() => navigate(buildCoursePath(courseRef))}
                    className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                >
                    ← Назад к курсу
                </button>

                <section className="rounded-2xl border border-white/10 bg-[#1A1A1C] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="text-sm text-purple-200/80">Дисциплина</div>
                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">{discipline.name}</h1>
                            <p className="mt-4 text-sm leading-7 text-slate-400 md:text-base">
                                {discipline.description || 'Описание дисциплины пока не заполнено.'}
                            </p>
                            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm text-slate-300">
                                <HiClock className="h-4 w-4 text-slate-400" />
                                Часов: {discipline.hours || 0}
                            </div>
                        </div>

                        {canManage && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditDiscipline(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                                >
                                    <HiPencil className="h-4 w-4" />
                                    Редактировать
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteDisciplineConfirm(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                                >
                                    <HiTrash className="h-4 w-4" />
                                    Удалить
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-white">Задания</h2>
                        {isArchived && canManage && (
                            <p className="mt-2 text-sm text-yellow-300">В архивном курсе нельзя создавать новые задания.</p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {!canManage && (
                            <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                                {[
                                    { id: 'all', label: 'Все' },
                                    { id: 'submitted', label: 'Сданные' },
                                    { id: 'not_submitted', label: 'Не сданные' }
                                ].map((filter) => (
                                    <button
                                        key={filter.id}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.id)}
                                        className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                                            statusFilter === filter.id
                                                ? 'bg-purple-600 text-white'
                                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        )}

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

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setShowCreateTask(true)}
                                disabled={isArchived}
                                className="rounded-2xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Создать задание
                            </button>
                        )}
                    </div>
                </div>

                {taskCards.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-slate-500">
                        В этой дисциплине пока нет заданий.
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-4'}>
                        {taskCards.map(({ task, creatorName, materialsCount, grade, status }) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                course={courseRef}
                                discipline={discipline}
                                layout={viewMode}
                                creatorName={creatorName}
                                materialsCount={materialsCount}
                                grade={grade}
                                status={status}
                                actionItems={canManage ? [
                                    {
                                        label: 'Редактировать',
                                        icon: HiPencil,
                                        onClick: () => {
                                            setSelectedTask(task);
                                            setShowEditTask(true);
                                        }
                                    },
                                    {
                                        label: 'Удалить',
                                        icon: HiTrash,
                                        danger: true,
                                        onClick: () => {
                                            setSelectedTask(task);
                                            setShowDeleteTaskConfirm(true);
                                        }
                                    }
                                ] : []}
                            />
                        ))}
                    </div>
                )}
            </div>

            <EditDisciplineModal
                isOpen={showEditDiscipline}
                onClose={() => setShowEditDiscipline(false)}
                onSuccess={() => {
                    setShowEditDiscipline(false);
                    fetchData();
                }}
                discipline={discipline}
            />
            <CreateTaskModal
                isOpen={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                onSuccess={() => {
                    setShowCreateTask(false);
                    fetchData();
                }}
                courseId={discipline.course_id}
                disciplineId={discipline.id}
            />
            <EditTaskModal
                isOpen={showEditTask}
                onClose={() => {
                    setShowEditTask(false);
                    setSelectedTask(null);
                }}
                onSuccess={() => {
                    setShowEditTask(false);
                    setSelectedTask(null);
                    fetchData();
                }}
                task={selectedTask}
            />
            <ConfirmModal
                isOpen={showDeleteDisciplineConfirm}
                onClose={() => setShowDeleteDisciplineConfirm(false)}
                onConfirm={handleDeleteDiscipline}
                title="Удаление дисциплины"
                message={`Удалить дисциплину ${discipline.name}?`}
                confirmText="Удалить"
            />
            <ConfirmModal
                isOpen={showDeleteTaskConfirm}
                onClose={() => {
                    setShowDeleteTaskConfirm(false);
                    setSelectedTask(null);
                }}
                onConfirm={handleDeleteTask}
                title="Удаление задания"
                message={`Удалить задание ${selectedTask?.name || ''}?`}
                confirmText="Удалить"
            />
        </MainLayout>
    );
};

export default DisciplineDetailPage;
