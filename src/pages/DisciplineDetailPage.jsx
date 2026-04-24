import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { HiCalendar, HiClock, HiPaperClip, HiPencil, HiStar, HiTrash } from 'react-icons/hi2';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import EditTaskModal from '../components/tasks/EditTaskModal';
import ActionMenu from '../components/layout/ActionMenu';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import { getTaskMaterials } from '../utils/fileUtils';
import { getRichTextExcerpt } from '../utils/richText';
import { buildCoursePath, buildDisciplinePath, buildTaskPath } from '../utils/routeUtils';

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
                taskService.getTasks({ course_id: disciplineObject.course_id, discipline_id: disciplineObject.id, per_page: 100 }).catch(() => ({ data: [] })),
                courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] }))
            ]);

            setDiscipline(disciplineObject);
            setCourse(courseObject);
            setTasks(tasksData.data || []);
            setCourseUsers(usersData.users || usersData.data || []);

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
    }, [courseIdOrSlug, disciplineIdOrSlug, navigate, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

                <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="text-xs uppercase tracking-[0.24em] text-sky-200/70">Дисциплина</div>
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
                        <p className="mt-2 text-sm text-slate-500">
                            Более спокойные и информативные карточки: короткое описание, баллы, дедлайн и количество материалов.
                        </p>
                        {isArchived && canManage && (
                            <p className="mt-2 text-sm text-yellow-300">В архивном курсе нельзя создавать новые задания.</p>
                        )}
                    </div>

                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setShowCreateTask(true)}
                            disabled={isArchived}
                            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Создать задание
                        </button>
                    )}
                </div>

                {tasks.length === 0 ? (
                    <div className="rounded-[30px] border border-dashed border-white/10 px-6 py-14 text-center text-slate-500">
                        В этой дисциплине пока нет заданий.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {tasks.map((task) => {
                            const materialsCount = getTaskMaterials(task).length;

                            return (
                                <motion.div
                                    key={task.id}
                                    whileHover={{ y: -4 }}
                                    className="cursor-pointer rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_34%),rgba(255,255,255,0.03)] p-5 transition-all hover:border-sky-400/35 hover:bg-white/[0.05]"
                                    onClick={() => navigate(buildTaskPath(courseRef, discipline, task))}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="text-xs uppercase tracking-[0.24em] text-sky-200/70">Задание #{task.task_number}</div>
                                            <h3 className="mt-3 text-xl font-semibold text-white">{task.name}</h3>
                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                                                {getRichTextExcerpt(task.description, 180) || 'Описание пока не заполнено.'}
                                            </p>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                                                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Максимум</div>
                                                <div className="mt-1 text-lg font-semibold text-white">{Number(task.scores) || 100}</div>
                                            </div>
                                            {canManage && (
                                                <ActionMenu
                                                    showLabel
                                                    buttonLabel="Действия"
                                                    buttonClassName="border border-white/10 bg-white/5"
                                                    items={[
                                                        {
                                                            label: 'Редактировать задание',
                                                            icon: HiPencil,
                                                            onClick: () => {
                                                                setSelectedTask(task);
                                                                setShowEditTask(true);
                                                            }
                                                        },
                                                        {
                                                            label: 'Удалить задание',
                                                            icon: HiTrash,
                                                            danger: true,
                                                            onClick: () => {
                                                                setSelectedTask(task);
                                                                setShowDeleteTaskConfirm(true);
                                                            }
                                                        }
                                                    ]}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                        {task.deadline && (
                                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                                <HiCalendar className="h-3.5 w-3.5" />
                                                Сдать до {new Date(task.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                            <HiStar className="h-3.5 w-3.5 text-yellow-400" />
                                            {Number(task.scores) || 100} баллов
                                        </span>
                                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                            <HiPaperClip className="h-3.5 w-3.5" />
                                            Материалов: {materialsCount}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
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
