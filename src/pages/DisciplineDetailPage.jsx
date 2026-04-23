import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { HiCalendar, HiClock, HiPencil, HiStar, HiTrash } from 'react-icons/hi2';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
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
    const [showDeleteDisciplineConfirm, setShowDeleteDisciplineConfirm] = useState(false);

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
                    <button onClick={() => navigate('/courses')} className="mt-4 text-purple-400 transition hover:text-purple-300">← Назад</button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl">
                <button onClick={() => navigate(buildCoursePath(courseRef))} className="mb-4 flex items-center gap-1 text-purple-400 transition hover:text-purple-300">← Назад к курсу</button>

                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{discipline.name}</h1>
                        <p className="mt-1 text-gray-400">{discipline.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <HiClock className="h-4 w-4" />
                                Часов: {discipline.hours || 0}
                            </span>
                        </div>
                    </div>

                    {canManage && (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowEditDiscipline(true)} className="rounded-lg bg-white/5 p-2 transition hover:bg-white/10">
                                <HiPencil className="h-5 w-5" />
                            </button>
                            <button type="button" onClick={() => setShowDeleteDisciplineConfirm(true)} className="rounded-lg bg-red-600/20 p-2 transition hover:bg-red-600/30">
                                <HiTrash className="h-5 w-5 text-red-400" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold">Задания</h2>
                        {isArchived && canManage && (
                            <p className="mt-1 text-sm text-yellow-300">В архивном курсе нельзя создавать новые задания.</p>
                        )}
                    </div>

                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setShowCreateTask(true)}
                            disabled={isArchived}
                            className="rounded-lg bg-purple-600 px-4 py-2 transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            + Создать задание
                        </button>
                    )}
                </div>

                {tasks.length === 0 ? (
                    <p className="text-gray-500">В этой дисциплине пока нет заданий</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {tasks.map((task) => (
                            <motion.div
                                key={task.id}
                                whileHover={{ y: -4 }}
                                className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-purple-500"
                                onClick={() => navigate(buildTaskPath(courseRef, discipline, task))}
                            >
                                <h3 className="mb-2 text-lg font-bold">{task.name}</h3>
                                <p className="mb-3 line-clamp-2 text-sm text-gray-400">{task.description}</p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    {task.scores !== undefined && (
                                        <span className="flex items-center gap-1">
                                            <HiStar className="h-3 w-3 text-yellow-400" />
                                            {task.scores} баллов
                                        </span>
                                    )}
                                    {task.deadline && (
                                        <span className="flex items-center gap-1">
                                            <HiCalendar className="h-3 w-3" />
                                            Срок сдачи: {new Date(task.deadline).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
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
            <ConfirmModal isOpen={showDeleteDisciplineConfirm} onClose={() => setShowDeleteDisciplineConfirm(false)} onConfirm={handleDeleteDiscipline} title="Удаление дисциплины" message={`Удалить дисциплину ${discipline.name}?`} confirmText="Удалить" />
        </MainLayout>
    );
};

export default DisciplineDetailPage;
