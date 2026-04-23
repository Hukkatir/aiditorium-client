import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArchiveBox,
    HiArchiveBoxXMark,
    HiArrowPath,
    HiCalendar,
    HiClipboard,
    HiClipboardDocumentCheck,
    HiClock,
    HiLockClosed,
    HiLockOpen,
    HiMiniRectangleStack,
    HiPencil,
    HiStar,
    HiTrash,
    HiUserGroup
} from 'react-icons/hi2';
import CreateDisciplineModal from '../components/disciplines/CreateDisciplineModal';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import EditCourseModal from '../components/courses/EditCourseModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import apiClient from '../services/apiClient';
import { taskService } from '../services/taskService';
import { buildCoursePath, buildDisciplinePath, buildTaskPath } from '../utils/routeUtils';

const formatDate = (dateString) => {
    if (!dateString) {
        return '—';
    }

    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const getRoleLabel = (role) => {
    if (role === 'teacher') return 'Преподаватель';
    if (role === 'student') return 'Учащийся';
    return role || 'Учащийся';
};

const getCurrentCourseRole = (course, users, user) => {
    if (!course || !user) {
        return null;
    }

    if (Number(course.creator_id) === Number(user.id)) {
        return 'teacher';
    }

    return users.find((item) => Number(item.id) === Number(user.id))?.pivot?.role || null;
};

const CourseDetailPage = () => {
    const { courseId, courseIdOrSlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [course, setCourse] = useState(null);
    const [disciplines, setDisciplines] = useState([]);
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [coverUrl, setCoverUrl] = useState(null);
    const [activeTab, setActiveTab] = useState('disciplines');
    const [copiedInvite, setCopiedInvite] = useState(false);
    const [copiedTeacherInvite, setCopiedTeacherInvite] = useState(false);
    const [showCreateDiscipline, setShowCreateDiscipline] = useState(false);
    const [showEditCourse, setShowEditCourse] = useState(false);
    const [showEditDiscipline, setShowEditDiscipline] = useState(false);
    const [selectedDiscipline, setSelectedDiscipline] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDeleteDisciplineConfirm, setShowDeleteDisciplineConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showReopenConfirm, setShowReopenConfirm] = useState(false);
    const [showRemoveUserConfirm, setShowRemoveUserConfirm] = useState(false);
    const [userToRemove, setUserToRemove] = useState(null);

    const currentCourseParam = courseIdOrSlug || courseId;
    const currentRole = useMemo(() => getCurrentCourseRole(course, users, user), [course, users, user]);
    const isTeacher = currentRole === 'teacher';
    const isCreator = Number(course?.creator_id) === Number(user?.id);
    const isAdmin = user?.role_id === 1;
    const isArchived = course?.status === 'archived';

    const tabs = [
        { id: 'disciplines', label: 'Дисциплины', count: disciplines.length },
        { id: 'tasks', label: 'Задания', count: tasks.length },
        { id: 'users', label: 'Участники', count: users.length }
    ];

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            const courseData = await courseService.getCourse(currentCourseParam);
            const courseObject = courseData.course || courseData;

            setCourse(courseObject);
            const canonicalPath = buildCoursePath(courseObject);
            if (window.location.pathname !== canonicalPath) {
                navigate(canonicalPath, { replace: true });
            }

            if (courseObject.background_logo_url) {
                setCoverUrl(courseObject.background_logo_url);
            } else if (courseObject.background_logo_id) {
                try {
                    const fileResponse = await apiClient.get(`/file/${courseObject.background_logo_id}`);
                    const path = fileResponse.data.file?.path || fileResponse.data.path;
                    setCoverUrl(path ? `https://aiditorium.ru/storage/${path}` : null);
                } catch {
                    setCoverUrl(null);
                }
            } else {
                setCoverUrl(null);
            }

            const [disciplinesData, usersData, tasksData] = await Promise.all([
                disciplineService.getDisciplinesByCourse(courseObject.id).catch(() => ({ data: [] })),
                courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] })),
                taskService.getTasks({ course_id: courseObject.id, per_page: 100 }).catch(() => ({ data: [] }))
            ]);

            setDisciplines(disciplinesData.data || []);
            setUsers(usersData.users || usersData.data || []);
            setTasks(tasksData.data || []);
        } catch (error) {
            console.error(error);
            setCourse(null);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить данные курса');
        } finally {
            setLoading(false);
        }
    }, [currentCourseParam, navigate, showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCopy = (text, setter) => {
        navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
        showToast('success', 'Код скопирован');
    };

    const runCourseAction = async (action, successMessage, closeModal) => {
        if (!course) {
            return;
        }

        try {
            await action(course.id);
            showToast('success', successMessage);
            await fetchData();
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка');
        } finally {
            closeModal(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!course || !isAdmin) {
            return;
        }

        try {
            await courseService.deleteCourse(course.id);
            showToast('success', 'Курс полностью удалён');
            navigate('/courses');
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleDeleteDiscipline = async () => {
        if (!selectedDiscipline) {
            return;
        }

        try {
            await disciplineService.deleteDiscipline(selectedDiscipline.id);
            showToast('success', 'Дисциплина удалена');
            setSelectedDiscipline(null);
            await fetchData();
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления дисциплины');
        } finally {
            setShowDeleteDisciplineConfirm(false);
        }
    };

    const handleRemoveUser = async () => {
        if (!course || !userToRemove) {
            return;
        }

        try {
            await courseService.removeUserFromCourse(course.id, userToRemove.id);
            setUsers((previous) => previous.filter((item) => item.id !== userToRemove.id));
            showToast('success', `Пользователь ${userToRemove.name} удалён из курса`);
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowRemoveUserConfirm(false);
            setUserToRemove(null);
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

    if (!course) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Курс не найден</p>
                    <button onClick={() => navigate('/courses')} className="mt-4 text-purple-400 transition hover:text-purple-300">
                        ← Вернуться к курсам
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl">
                <div className="relative mb-6 h-64 w-full overflow-hidden rounded-2xl">
                    {coverUrl ? (
                        <img src={coverUrl} alt={course.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-purple-600 to-blue-600" />
                    )}
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                        <h1 className="mb-2 text-4xl font-bold text-white">{course.name}</h1>
                        <p className="max-w-2xl text-lg text-gray-200">{course.description}</p>
                    </div>
                </div>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-300">
                            <HiUserGroup className="h-5 w-5 text-gray-400" />
                            <span>{users.length} участников</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                            <HiCalendar className="h-5 w-5 text-gray-400" />
                            <span>Создан: {formatDate(course.created_at)}</span>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs ${course.is_closed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {course.is_closed ? 'Закрыт' : 'Открыт'}
                        </span>
                        {isArchived && <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">Архивирован</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isCreator && (
                            <>
                                <div className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1">
                                    <span className="text-xs text-gray-400">Студенты:</span>
                                    <code className="font-mono text-sm text-purple-300">{course.invite_code}</code>
                                    <button type="button" onClick={() => handleCopy(course.invite_code, setCopiedInvite)} className="rounded p-1 transition hover:bg-white/10">
                                        {copiedInvite ? <HiClipboardDocumentCheck className="h-4 w-4 text-green-400" /> : <HiClipboard className="h-4 w-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => runCourseAction(courseService.regenerateInviteCode, 'Код приглашения обновлён', () => {})}
                                        className="rounded p-1 transition hover:bg-white/10"
                                    >
                                        <HiArrowPath className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1">
                                    <span className="text-xs text-gray-400">Учителя:</span>
                                    <code className="font-mono text-sm text-purple-300">{course.invite_code_teacher || 'Код не создан'}</code>
                                    {course.invite_code_teacher && (
                                        <button type="button" onClick={() => handleCopy(course.invite_code_teacher, setCopiedTeacherInvite)} className="rounded p-1 transition hover:bg-white/10">
                                            {copiedTeacherInvite ? <HiClipboardDocumentCheck className="h-4 w-4 text-green-400" /> : <HiClipboard className="h-4 w-4" />}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => runCourseAction(courseService.generateTeacherCode, course.invite_code_teacher ? 'Код для учителя обновлён' : 'Код для учителя создан', () => {})}
                                        className="rounded p-1 transition hover:bg-white/10"
                                    >
                                        <HiArrowPath className="h-4 w-4" />
                                    </button>
                                </div>
                            </>
                        )}

                        {isTeacher && (
                            <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => setShowEditCourse(true)} className="rounded-lg bg-purple-600/20 p-2 transition hover:bg-purple-600/30">
                                    <HiPencil className="h-4 w-4" />
                                </button>

                                {isCreator && (
                                    <>
                                        {!course.is_closed ? (
                                            <button type="button" onClick={() => setShowCloseConfirm(true)} className="rounded-lg bg-yellow-600/20 p-2 transition hover:bg-yellow-600/30">
                                                <HiLockClosed className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button type="button" onClick={() => setShowReopenConfirm(true)} className="rounded-lg bg-green-600/20 p-2 transition hover:bg-green-600/30">
                                                <HiLockOpen className="h-4 w-4" />
                                            </button>
                                        )}

                                        {course.status !== 'archived' ? (
                                            <button type="button" onClick={() => setShowArchiveConfirm(true)} className="rounded-lg bg-orange-600/20 p-2 transition hover:bg-orange-600/30">
                                                <HiArchiveBox className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button type="button" onClick={() => setShowRestoreConfirm(true)} className="rounded-lg bg-blue-600/20 p-2 transition hover:bg-blue-600/30">
                                                <HiArchiveBoxXMark className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}

                                {isAdmin && (
                                    <button type="button" onClick={() => setShowDeleteConfirm(true)} className="rounded-lg bg-red-600/20 p-2 transition hover:bg-red-600/30">
                                        <HiTrash className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-6 border-b border-white/10">
                    <nav className="flex gap-6 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap border-b-2 px-1 pb-3 font-medium transition ${activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                            >
                                {tab.label}
                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{tab.count}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'disciplines' && (
                        <motion.div key="disciplines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-semibold">Дисциплины</h2>
                                    {isArchived && isTeacher && (
                                        <p className="mt-1 text-sm text-yellow-300">В архивном курсе нельзя создавать новые дисциплины.</p>
                                    )}
                                </div>
                                {isTeacher && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateDiscipline(true)}
                                        disabled={isArchived}
                                        className="rounded-lg bg-purple-600 px-4 py-2 transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        + Создать дисциплину
                                    </button>
                                )}
                            </div>

                            {disciplines.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет дисциплин</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {disciplines.map((discipline) => (
                                        <div key={discipline.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-purple-500">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 cursor-pointer" onClick={() => navigate(buildDisciplinePath(course, discipline))}>
                                                    <h3 className="mb-2 text-xl font-bold">{discipline.name}</h3>
                                                    <p className="line-clamp-2 text-sm text-gray-400">{discipline.description}</p>
                                                    <div className="mt-3 text-xs text-gray-500">Часов: {discipline.hours || 0}</div>
                                                </div>
                                                {isTeacher && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDiscipline(discipline);
                                                                setShowEditDiscipline(true);
                                                            }}
                                                            className="rounded-lg bg-white/5 p-2 transition hover:bg-white/10"
                                                        >
                                                            <HiPencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDiscipline(discipline);
                                                                setShowDeleteDisciplineConfirm(true);
                                                            }}
                                                            className="rounded-lg bg-red-600/20 p-2 transition hover:bg-red-600/30"
                                                        >
                                                            <HiTrash className="h-4 w-4 text-red-400" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'tasks' && (
                        <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <h2 className="mb-6 text-2xl font-semibold">Задания</h2>
                            {tasks.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет заданий</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {tasks.map((task) => {
                                        const discipline = disciplines.find((item) => item.id === task.discipline_id);

                                        return (
                                            <div
                                                key={task.id}
                                                className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-purple-500"
                                                onClick={() => discipline && navigate(buildTaskPath(course, discipline, task))}
                                            >
                                                <h3 className="mb-1 text-lg font-bold">{task.name}</h3>
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
                                                            <HiClock className="h-3 w-3" />
                                                            Срок сдачи: {formatDate(task.deadline)}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <HiCalendar className="h-3 w-3" />
                                                        Создано: {formatDate(task.created_at)}
                                                    </span>
                                                    {discipline && (
                                                        <span className="flex items-center gap-1">
                                                            <HiMiniRectangleStack className="h-3 w-3" />
                                                            {discipline.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'users' && (
                        <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <h2 className="mb-6 text-2xl font-semibold">Участники ({users.length})</h2>
                            {users.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет участников</p>
                            ) : (
                                <div className="space-y-2">
                                    {users.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-gray-400">{item.email}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="rounded-full bg-purple-600/20 px-2 py-1 text-xs text-purple-300">{getRoleLabel(item.pivot?.role)}</span>
                                                {isCreator && item.id !== user?.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setUserToRemove(item);
                                                            setShowRemoveUserConfirm(true);
                                                        }}
                                                        className="text-red-400 transition hover:text-red-300"
                                                    >
                                                        <HiTrash className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <CreateDisciplineModal
                isOpen={showCreateDiscipline}
                onClose={() => setShowCreateDiscipline(false)}
                onSuccess={() => {
                    setShowCreateDiscipline(false);
                    fetchData();
                }}
                courseId={course.id}
            />
            <EditDisciplineModal
                isOpen={showEditDiscipline}
                onClose={() => setShowEditDiscipline(false)}
                onSuccess={() => {
                    setShowEditDiscipline(false);
                    fetchData();
                }}
                discipline={selectedDiscipline}
            />
            <EditCourseModal
                isOpen={showEditCourse}
                onClose={() => setShowEditCourse(false)}
                course={course}
                onSuccess={() => {
                    setShowEditCourse(false);
                    fetchData();
                }}
            />
            <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteCourse} title="Удаление курса" message="Вы уверены? Это действие необратимо." confirmText="Удалить" />
            <ConfirmModal isOpen={showDeleteDisciplineConfirm} onClose={() => setShowDeleteDisciplineConfirm(false)} onConfirm={handleDeleteDiscipline} title="Удаление дисциплины" message={`Удалить дисциплину ${selectedDiscipline?.name || ''}?`} confirmText="Удалить" />
            <ConfirmModal isOpen={showArchiveConfirm} onClose={() => setShowArchiveConfirm(false)} onConfirm={() => runCourseAction(courseService.archiveCourse, 'Курс архивирован', setShowArchiveConfirm)} title="Архивация курса" message="Курс будет перемещён в архив." confirmText="Архивировать" />
            <ConfirmModal isOpen={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} onConfirm={() => runCourseAction(courseService.restoreCourse, 'Курс восстановлен', setShowRestoreConfirm)} title="Восстановление курса" message="Курс будет восстановлен из архива." confirmText="Восстановить" />
            <ConfirmModal isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} onConfirm={() => runCourseAction(courseService.closeCourse, 'Курс закрыт для новых участников', setShowCloseConfirm)} title="Закрытие курса" message="Новые участники не смогут вступить в курс." confirmText="Закрыть" />
            <ConfirmModal isOpen={showReopenConfirm} onClose={() => setShowReopenConfirm(false)} onConfirm={() => runCourseAction(courseService.reopenCourse, 'Курс снова открыт для новых участников', setShowReopenConfirm)} title="Открытие курса" message="Новые участники снова смогут вступить в курс." confirmText="Открыть" />
            <ConfirmModal isOpen={showRemoveUserConfirm} onClose={() => { setShowRemoveUserConfirm(false); setUserToRemove(null); }} onConfirm={handleRemoveUser} title="Удаление участника" message={`Удалить ${userToRemove?.name || 'этого участника'} из курса?`} confirmText="Удалить" />
        </MainLayout>
    );
};

export default CourseDetailPage;
