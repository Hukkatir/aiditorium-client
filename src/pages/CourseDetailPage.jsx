import React, { useEffect, useState } from 'react';
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
    if (!dateString) return '—';
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showReopenConfirm, setShowReopenConfirm] = useState(false);
    const [showRemoveUserConfirm, setShowRemoveUserConfirm] = useState(false);
    const [userToRemove, setUserToRemove] = useState(null);

    const currentCourseParam = courseIdOrSlug || courseId;
    const canManage = course && user && (course.creator_id === user.id || course.pivot?.role === 'teacher');
    const isAdmin = user?.role_id === 1;

    const syncCanonicalCourseUrl = (courseObj) => {
        const canonicalPath = buildCoursePath(courseObj);
        if (window.location.pathname !== canonicalPath) {
            navigate(canonicalPath, { replace: true });
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const courseData = await courseService.getCourse(currentCourseParam);
            const courseObj = courseData.course || courseData;
            setCourse(courseObj);
            syncCanonicalCourseUrl(courseObj);

            if (courseObj.background_logo_url) {
                setCoverUrl(courseObj.background_logo_url);
            } else if (courseObj.background_logo_id) {
                try {
                    const fileRes = await apiClient.get(`/file/${courseObj.background_logo_id}`);
                    const path = fileRes.data.file?.path || fileRes.data.path;
                    setCoverUrl(path ? `https://aiditorium.ru/storage/${path}` : null);
                } catch {
                    setCoverUrl(null);
                }
            } else {
                setCoverUrl(null);
            }

            try {
                const disciplinesData = await disciplineService.getDisciplinesByCourse(courseObj.id);
                setDisciplines(disciplinesData.data || []);
            } catch (error) {
                setDisciplines(error.response?.status === 404 ? [] : []);
            }

            try {
                const usersData = await courseService.getCourseUsers(courseObj.id);
                setUsers(usersData.users || usersData.data || []);
            } catch {
                setUsers([]);
            }

            try {
                const tasksData = await taskService.getTasks({ course_id: courseObj.id, per_page: 100 });
                setTasks(tasksData.data || []);
            } catch (error) {
                setTasks(error.response?.status === 404 ? [] : []);
            }
        } catch (error) {
            console.error(error);
            setCourse(null);
            showToast('error', 'Не удалось загрузить данные курса');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentCourseParam]);

    const handleCopy = (text, setter) => {
        navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
        showToast('success', 'Код скопирован');
    };

    const runCourseAction = async (action, successMessage, closeModal) => {
        if (!course) return;
        try {
            await action(course.id);
            showToast('success', successMessage);
            fetchData();
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Ошибка');
        } finally {
            closeModal(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!course || !isAdmin) return;
        try {
            await courseService.deleteCourse(course.id);
            showToast('success', 'Курс полностью удалён');
            navigate('/courses');
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleRemoveUser = async () => {
        if (!course || !userToRemove) return;
        try {
            await courseService.removeUserFromCourse(course.id, userToRemove.id);
            setUsers((prev) => prev.filter((item) => item.id !== userToRemove.id));
            showToast('success', `Пользователь ${userToRemove.name} удалён из курса`);
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowRemoveUserConfirm(false);
            setUserToRemove(null);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MainLayout>
        );
    }

    if (!course) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <p className="text-gray-400 text-xl">Курс не найден</p>
                    <button onClick={() => navigate('/courses')} className="mt-4 text-purple-400 hover:text-purple-300">
                        ← Вернуться к курсам
                    </button>
                </div>
            </MainLayout>
        );
    }

    const tabs = [
        { id: 'disciplines', label: 'Дисциплины', count: disciplines.length },
        { id: 'tasks', label: 'Задания', count: tasks.length },
        { id: 'users', label: 'Участники', count: users.length }
    ];

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                <div className="relative w-full h-64 mb-6 rounded-2xl overflow-hidden">
                    {coverUrl ? (
                        <img src={coverUrl} alt={course.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
                        <h1 className="text-4xl font-bold text-white mb-2">{course.name}</h1>
                        <p className="text-gray-200 text-lg max-w-2xl">{course.description}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white/5 p-4 rounded-xl">
                    <div className="flex items-center gap-4 flex-wrap">
                        <HiUserGroup className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-300">{users.length} участников</span>
                        <HiCalendar className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-300">Создан: {formatDate(course.created_at)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${course.is_closed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {course.is_closed ? 'Закрыт' : 'Открыт'}
                        </span>
                        {course.status === 'archived' && (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Архивирован</span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg">
                            <span className="text-xs text-gray-400">Студенты:</span>
                            <code className="text-purple-300 font-mono text-sm">{course.invite_code}</code>
                            <button onClick={() => handleCopy(course.invite_code, setCopiedInvite)} className="p-1 hover:bg-white/10 rounded">
                                {copiedInvite ? <HiClipboardDocumentCheck className="w-4 h-4 text-green-400" /> : <HiClipboard className="w-4 h-4" />}
                            </button>
                            {canManage && (
                                <button onClick={() => runCourseAction(courseService.regenerateInviteCode, 'Код приглашения обновлён', () => {})} className="p-1 hover:bg-white/10 rounded" title="Обновить код">
                                    <HiArrowPath className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {canManage && course.invite_code_teacher && (
                            <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg">
                                <span className="text-xs text-gray-400">Учителя:</span>
                                <code className="text-purple-300 font-mono text-sm">{course.invite_code_teacher}</code>
                                <button onClick={() => handleCopy(course.invite_code_teacher, setCopiedTeacherInvite)} className="p-1 hover:bg-white/10 rounded">
                                    {copiedTeacherInvite ? <HiClipboardDocumentCheck className="w-4 h-4 text-green-400" /> : <HiClipboard className="w-4 h-4" />}
                                </button>
                                <button onClick={() => runCourseAction(courseService.generateTeacherCode, 'Код для учителя обновлён', () => {})} className="p-1 hover:bg-white/10 rounded" title="Обновить код учителя">
                                    <HiArrowPath className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {canManage && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => setShowEditCourse(true)} className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg transition"><HiPencil className="w-4 h-4" /></button>
                            {!course.is_closed ? (
                                <button onClick={() => setShowCloseConfirm(true)} className="p-2 bg-yellow-600/20 hover:bg-yellow-600/30 rounded-lg transition"><HiLockClosed className="w-4 h-4" /></button>
                            ) : (
                                <button onClick={() => setShowReopenConfirm(true)} className="p-2 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition"><HiLockOpen className="w-4 h-4" /></button>
                            )}
                            {course.status !== 'archived' ? (
                                <button onClick={() => setShowArchiveConfirm(true)} className="p-2 bg-orange-600/20 hover:bg-orange-600/30 rounded-lg transition"><HiArchiveBox className="w-4 h-4" /></button>
                            ) : (
                                <button onClick={() => setShowRestoreConfirm(true)} className="p-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition"><HiArchiveBoxXMark className="w-4 h-4" /></button>
                            )}
                            {isAdmin && <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition"><HiTrash className="w-4 h-4" /></button>}
                        </div>
                    )}
                </div>

                <div className="border-b border-white/10 mb-6">
                    <nav className="flex gap-6 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 px-1 font-medium transition border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                            >
                                {tab.label}
                                <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">{tab.count}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'disciplines' && (
                        <motion.div key="disciplines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-semibold">Дисциплины</h2>
                                {canManage && <button onClick={() => setShowCreateDiscipline(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">+ Создать дисциплину</button>}
                            </div>
                            {disciplines.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет дисциплин</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {disciplines.map((discipline) => (
                                        <div
                                            key={discipline.id}
                                            className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition"
                                            onClick={() => navigate(buildDisciplinePath(course, discipline))}
                                        >
                                            <h3 className="text-xl font-bold mb-2">{discipline.name}</h3>
                                            <p className="text-gray-400 text-sm line-clamp-2">{discipline.description}</p>
                                            <div className="mt-3 text-xs text-gray-500">Часов: {discipline.hours || 0}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'tasks' && (
                        <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <h2 className="text-2xl font-semibold mb-6">Задания</h2>
                            {tasks.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет заданий</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {tasks.map((task) => {
                                        const discipline = disciplines.find((item) => item.id === task.discipline_id);
                                        return (
                                            <div
                                                key={task.id}
                                                className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition"
                                                onClick={() => discipline && navigate(buildTaskPath(course, discipline, task))}
                                            >
                                                <h3 className="text-lg font-bold mb-1">{task.name}</h3>
                                                <p className="text-gray-400 text-sm line-clamp-2 mb-3">{task.description}</p>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                    {task.scores !== undefined && <span className="flex items-center gap-1"><HiStar className="w-3 h-3 text-yellow-400" />{task.scores} баллов</span>}
                                                    {task.deadline && <span className="flex items-center gap-1"><HiClock className="w-3 h-3" />Срок сдачи: {formatDate(task.deadline)}</span>}
                                                    <span className="flex items-center gap-1"><HiCalendar className="w-3 h-3" />Создано: {formatDate(task.created_at)}</span>
                                                    {discipline && <span className="flex items-center gap-1"><HiMiniRectangleStack className="w-3 h-3" />{discipline.name}</span>}
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
                            <h2 className="text-2xl font-semibold mb-6">Участники ({users.length})</h2>
                            {users.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет участников</p>
                            ) : (
                                <div className="space-y-2">
                                    {users.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/10 rounded-lg">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-gray-400">{item.email}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs px-2 py-1 bg-purple-600/20 rounded-full text-purple-300">{getRoleLabel(item.pivot?.role)}</span>
                                                {canManage && item.id !== user?.id && (
                                                    <button onClick={() => { setUserToRemove(item); setShowRemoveUserConfirm(true); }} className="text-red-400 hover:text-red-300">
                                                        <HiTrash className="w-5 h-5" />
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
            <ConfirmModal isOpen={showArchiveConfirm} onClose={() => setShowArchiveConfirm(false)} onConfirm={() => runCourseAction(courseService.archiveCourse, 'Курс архивирован', setShowArchiveConfirm)} title="Архивация курса" message="Курс будет перемещён в архив." confirmText="Архивировать" />
            <ConfirmModal isOpen={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} onConfirm={() => runCourseAction(courseService.restoreCourse, 'Курс восстановлен', setShowRestoreConfirm)} title="Восстановление курса" message="Курс будет восстановлен из архива." confirmText="Восстановить" />
            <ConfirmModal isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} onConfirm={() => runCourseAction(courseService.closeCourse, 'Курс закрыт для новых участников', setShowCloseConfirm)} title="Закрытие курса" message="Новые участники не смогут вступить в курс." confirmText="Закрыть" />
            <ConfirmModal isOpen={showReopenConfirm} onClose={() => setShowReopenConfirm(false)} onConfirm={() => runCourseAction(courseService.reopenCourse, 'Курс снова открыт для новых участников', setShowReopenConfirm)} title="Открытие курса" message="Новые участники снова смогут вступить в курс." confirmText="Открыть" />
            <ConfirmModal isOpen={showRemoveUserConfirm} onClose={() => { setShowRemoveUserConfirm(false); setUserToRemove(null); }} onConfirm={handleRemoveUser} title="Удаление участника" message={`Удалить ${userToRemove?.name || 'этого участника'} из курса?`} confirmText="Удалить" />
        </MainLayout>
    );
};

export default CourseDetailPage;
