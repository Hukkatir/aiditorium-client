import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import MainLayout from '../components/layout/MainLayout';
import CreateDisciplineModal from '../components/disciplines/CreateDisciplineModal';
import EditCourseModal from '../components/courses/EditCourseModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import {
    HiClipboard,
    HiClipboardDocumentCheck,
    HiUserGroup,
    HiCalendar,
    HiPencil,
    HiTrash,
    HiLockClosed,
    HiLockOpen,
    HiArchiveBox,
    HiArchiveBoxXMark,
    HiUserPlus,
    HiArrowPath,
    HiStar,
    HiMiniRectangleStack,
    HiClock,
    HiOutlineClipboard
} from 'react-icons/hi2';
import apiClient from '../services/apiClient';

const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getRoleLabel = (role) => {
    if (role === 'teacher') return 'Преподаватель';
    if (role === 'student') return 'Учащийся';
    return role || 'Учащийся';
};

const CourseDetailPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [course, setCourse] = useState(null);
    const [disciplines, setDisciplines] = useState([]);
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('disciplines');
    const [coverUrl, setCoverUrl] = useState(null);
    const [loadingCover, setLoadingCover] = useState(false);
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

    const canManage = course && user && (course.creator_id === user.id || course.pivot?.role === 'teacher');
    const isAdmin = user?.role_id === 1; // предполагаем, что роль 1 – администратор

    const fetchData = async () => {
        setLoading(true);
        try {
            const courseData = await courseService.getCourse(courseId);
            const courseObj = courseData.course || courseData;
            setCourse(courseObj);

            if (courseObj.background_logo_url) {
                setCoverUrl(courseObj.background_logo_url);
            } else if (courseObj.background_logo_id) {
                setLoadingCover(true);
                try {
                    const fileRes = await apiClient.get(`/file/${courseObj.background_logo_id}`);
                    const path = fileRes.data.file?.path || fileRes.data.path;
                    if (path) setCoverUrl(`https://aiditorium.ru/storage/${path}`);
                } catch (err) {
                    console.error('Ошибка загрузки обложки', err);
                } finally {
                    setLoadingCover(false);
                }
            }

            try {
                const disciplinesData = await disciplineService.getDisciplinesByCourse(courseId);
                setDisciplines(disciplinesData.data || []);
            } catch (err) {
                if (err.response?.status === 404) {
                    setDisciplines([]);
                } else {
                    console.error('Ошибка загрузки дисциплин', err);
                    showToast('warning', 'Не удалось загрузить дисциплины');
                }
            }

            try {
                const usersData = await courseService.getCourseUsers(courseId);
                setUsers(usersData.users || usersData.data || []);
            } catch (err) {
                console.error('Ошибка загрузки участников', err);
                showToast('warning', 'Не удалось загрузить участников');
            }

            try {
                const tasksData = await taskService.getTasks({ course_id: courseId });
                setTasks(tasksData.data || []);
            } catch (err) {
                if (err.response?.status === 404) {
                    setTasks([]);
                } else {
                    console.error('Ошибка загрузки заданий', err);
                    setTasks([]);
                }
            }

        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось загрузить данные курса');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [courseId]);

    const handleCopy = (text, setter) => {
        navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
        showToast('success', 'Код скопирован');
    };

    const handleGenerateTeacherCode = async () => {
        if (!canManage) return;
        try {
            const res = await courseService.generateTeacherCode(courseId);
            showToast('success', res.message || 'Код для учителя обновлён');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка обновления кода');
        }
    };

    const handleRegenerateInviteCode = async () => {
        if (!canManage) return;
        try {
            const res = await courseService.regenerateInviteCode(courseId);
            showToast('success', res.message || 'Код приглашения обновлён');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка обновления кода');
        }
    };

    const handleCloseCourse = async () => {
        if (!canManage) return;
        try {
            await courseService.closeCourse(courseId);
            showToast('success', 'Курс закрыт для новых участников');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка');
        } finally {
            setShowCloseConfirm(false);
        }
    };

    const handleReopenCourse = async () => {
        if (!canManage) return;
        try {
            await courseService.reopenCourse(courseId);
            showToast('success', 'Курс открыт для новых участников');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка');
        } finally {
            setShowReopenConfirm(false);
        }
    };

    const handleArchiveCourse = async () => {
        if (!canManage) return;
        try {
            await courseService.archiveCourse(courseId);
            showToast('success', 'Курс архивирован');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка');
        } finally {
            setShowArchiveConfirm(false);
        }
    };

    const handleRestoreCourse = async () => {
        if (!canManage) return;
        try {
            await courseService.restoreCourse(courseId);
            showToast('success', 'Курс восстановлен');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка');
        } finally {
            setShowRestoreConfirm(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!isAdmin) return; // только админ
        try {
            await courseService.deleteCourse(courseId);
            showToast('success', 'Курс полностью удалён');
            navigate('/courses');
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleRemoveUser = async () => {
        if (!canManage || !userToRemove) return;
        try {
            await courseService.removeUser(courseId, userToRemove.id);
            showToast('success', `Пользователь ${userToRemove.name} удалён из курса`);
            setUsers(users.filter(u => u.id !== userToRemove.id));
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Ошибка удаления');
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
        { id: 'users', label: 'Участники', count: users.length },
    ];

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                {/* Обложка */}
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

                {/* Верхняя панель с информацией и кодами */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white/5 p-4 rounded-xl">
                    {/* Левая часть: участники, дата, статус */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <HiUserGroup className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-300">{users.length} участников</span>
                        <HiCalendar className="w-5 h-5 text-gray-400 ml-2" />
                        <span className="text-gray-300">Создан: {formatDate(course.created_at)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${course.is_closed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {course.is_closed ? 'Закрыт' : 'Открыт'}
                        </span>
                        {course.status === 'archived' && (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Архивирован</span>
                        )}
                    </div>

                    {/* Коды приглашения (доступны всем, но с разным функционалом) */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Код для студентов (виден всем) */}
                        <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg">
                            <span className="text-xs text-gray-400">Студенты:</span>
                            <code className="text-purple-300 font-mono text-sm">{course.invite_code}</code>
                            <button onClick={() => handleCopy(course.invite_code, setCopiedInvite)} className="p-1 hover:bg-white/10 rounded">
                                {copiedInvite ? <HiClipboardDocumentCheck className="w-4 h-4 text-green-400" /> : <HiClipboard className="w-4 h-4" />}
                            </button>
                            {canManage && (
                                <button onClick={handleRegenerateInviteCode} className="p-1 hover:bg-white/10 rounded" title="Обновить код">
                                    <HiArrowPath className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Код для учителей (только для canManage) */}
                        {canManage && course.invite_code_teacher && (
                            <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg">
                                <span className="text-xs text-gray-400">Учителя:</span>
                                <code className="text-purple-300 font-mono text-sm">{course.invite_code_teacher}</code>
                                <button onClick={() => handleCopy(course.invite_code_teacher, setCopiedTeacherInvite)} className="p-1 hover:bg-white/10 rounded">
                                    {copiedTeacherInvite ? <HiClipboardDocumentCheck className="w-4 h-4 text-green-400" /> : <HiClipboard className="w-4 h-4" />}
                                </button>
                                <button onClick={handleGenerateTeacherCode} className="p-1 hover:bg-white/10 rounded" title="Обновить код учителя">
                                    <HiArrowPath className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Кнопки управления (только для canManage) */}
                    {canManage && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => setShowEditCourse(true)} className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg transition" title="Редактировать">
                                <HiPencil className="w-4 h-4" />
                            </button>
                            {!course.is_closed ? (
                                <button onClick={() => setShowCloseConfirm(true)} className="p-2 bg-yellow-600/20 hover:bg-yellow-600/30 rounded-lg transition" title="Закрыть курс">
                                    <HiLockClosed className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={() => setShowReopenConfirm(true)} className="p-2 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition" title="Открыть курс">
                                    <HiLockOpen className="w-4 h-4" />
                                </button>
                            )}
                            {course.status !== 'archived' ? (
                                <button onClick={() => setShowArchiveConfirm(true)} className="p-2 bg-orange-600/20 hover:bg-orange-600/30 rounded-lg transition" title="Архивировать">
                                    <HiArchiveBox className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={() => setShowRestoreConfirm(true)} className="p-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition" title="Восстановить">
                                    <HiArchiveBoxXMark className="w-4 h-4" />
                                </button>
                            )}
                            {isAdmin && (
                                <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition" title="Удалить навсегда">
                                    <HiTrash className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Вкладки (без вкладки "О курсе") */}
                <div className="border-b border-white/10 mb-6">
                    <nav className="flex gap-6 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 px-1 font-medium transition border-b-2 whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'disciplines' && (
                        <motion.div key="disciplines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-semibold">Дисциплины</h2>
                                {canManage && (
                                    <button onClick={() => setShowCreateDiscipline(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
                                        + Создать дисциплину
                                    </button>
                                )}
                            </div>
                            {disciplines.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет дисциплин</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {disciplines.map(d => (
                                        <div
                                            key={d.id}
                                            className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition"
                                            onClick={() => navigate(`/disciplines/${d.id}`)}
                                        >
                                            <h3 className="text-xl font-bold mb-2">{d.name}</h3>
                                            <p className="text-gray-400 text-sm line-clamp-2">{d.description}</p>
                                            <div className="mt-3 text-xs text-gray-500">Часов: {d.hours || 0}</div>
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
                                    {tasks.map(task => {
                                        const disciplineName = disciplines.find(d => d.id === task.discipline_id)?.name;
                                        return (
                                            <div
                                                key={task.id}
                                                className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition"
                                                onClick={() => navigate(`/tasks/${task.id}`)}
                                            >
                                                <h3 className="text-lg font-bold mb-1">{task.name}</h3>
                                                <p className="text-gray-400 text-sm line-clamp-2 mb-3">{task.description}</p>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                    {task.scores !== undefined && (
                                                        <span className="flex items-center gap-1">
                                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                                            {task.scores} баллов
                                                        </span>
                                                    )}
                                                    {task.deadline && (
                                                        <span className="flex items-center gap-1">
                                                            <HiClock className="w-3 h-3" />
                                                            Срок сдачи: {formatDate(task.deadline)}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <HiCalendar className="w-3 h-3" />
                                                        Создано: {formatDate(task.created_at)}
                                                    </span>
                                                    {disciplineName && (
                                                        <span className="flex items-center gap-1">
                                                            <HiMiniRectangleStack className="w-3 h-3" />
                                                            {disciplineName}
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
                            <h2 className="text-2xl font-semibold mb-6">Участники ({users.length})</h2>
                            {users.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет участников</p>
                            ) : (
                                <div className="space-y-2">
                                    {users.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/10 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center overflow-hidden">
                                                    {u.avatar_url ? (
                                                        <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-white">
                                                            {u.name?.charAt(0) || 'U'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{u.name}</p>
                                                    <p className="text-sm text-gray-400">{u.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs px-2 py-1 bg-purple-600/20 rounded-full text-purple-300">
                                                    {getRoleLabel(u.pivot?.role)}
                                                </span>
                                                {canManage && u.id !== user?.id && (
                                                    <button
                                                        onClick={() => { setUserToRemove(u); setShowRemoveUserConfirm(true); }}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
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

            {/* Модалки */}
            <CreateDisciplineModal
                isOpen={showCreateDiscipline}
                onClose={() => setShowCreateDiscipline(false)}
                onSuccess={() => { setShowCreateDiscipline(false); fetchData(); }}
                courseId={courseId}
            />
            <EditCourseModal
                isOpen={showEditCourse}
                onClose={() => setShowEditCourse(false)}
                course={course}
                onSuccess={() => { setShowEditCourse(false); fetchData(); }}
            />
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteCourse}
                title="Удаление курса"
                message="Вы уверены? Это действие необратимо. Все данные курса будут удалены."
                confirmText="Удалить навсегда"
            />
            <ConfirmModal
                isOpen={showArchiveConfirm}
                onClose={() => setShowArchiveConfirm(false)}
                onConfirm={handleArchiveCourse}
                title="Архивация курса"
                message="Курс будет перемещён в архив. Участники не смогут создавать новые задания."
                confirmText="Архивировать"
            />
            <ConfirmModal
                isOpen={showRestoreConfirm}
                onClose={() => setShowRestoreConfirm(false)}
                onConfirm={handleRestoreCourse}
                title="Восстановление курса"
                message="Курс будет восстановлен из архива."
                confirmText="Восстановить"
            />
            <ConfirmModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={handleCloseCourse}
                title="Закрытие курса"
                message="Новые участники не смогут присоединиться к курсу. Существующие останутся."
                confirmText="Закрыть"
            />
            <ConfirmModal
                isOpen={showReopenConfirm}
                onClose={() => setShowReopenConfirm(false)}
                onConfirm={handleReopenCourse}
                title="Открытие курса"
                message="Курс снова будет открыт для новых участников."
                confirmText="Открыть"
            />
            <ConfirmModal
                isOpen={showRemoveUserConfirm}
                onClose={() => { setShowRemoveUserConfirm(false); setUserToRemove(null); }}
                onConfirm={handleRemoveUser}
                title="Удаление участника"
                message={`Вы уверены, что хотите удалить пользователя ${userToRemove?.name} из курса?`}
                confirmText="Удалить"
            />
        </MainLayout>
    );
};

export default CourseDetailPage;