import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArchiveBox,
    HiArchiveBoxXMark,
    HiArrowRightOnRectangle,
    HiArrowPath,
    HiBars3,
    HiCalendar,
    HiClipboard,
    HiClipboardDocumentCheck,
    HiLockClosed,
    HiLockOpen,
    HiPencil,
    HiPlus,
    HiSquares2X2,
    HiTrash,
    HiUserCircle,
    HiUserGroup
} from 'react-icons/hi2';
import EditCourseModal from '../components/courses/EditCourseModal';
import CreateDisciplineModal from '../components/disciplines/CreateDisciplineModal';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import ActionMenu from '../components/layout/ActionMenu';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import EditTaskModal from '../components/tasks/EditTaskModal';
import TaskCard from '../components/tasks/TaskCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import apiClient from '../services/apiClient';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { extractCollection, getApiErrorMessage } from '../utils/apiUtils';
import { getTaskMaterials } from '../utils/fileUtils';
import { buildCoursePath, buildDisciplinePath } from '../utils/routeUtils';
import {
    getTaskCreatorName,
    getTaskSubmissionStatus,
    matchesTaskStatusFilter
} from '../utils/taskPresentation';

const emptyPaginatedResponse = { data: [] };

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
    if (role === 'teacher') {
        return 'Преподаватель';
    }

    if (role === 'student') {
        return 'Учащийся';
    }

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
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showEditCourse, setShowEditCourse] = useState(false);
    const [showEditDiscipline, setShowEditDiscipline] = useState(false);
    const [showEditTask, setShowEditTask] = useState(false);
    const [selectedDiscipline, setSelectedDiscipline] = useState(null);
    const [taskCreationDiscipline, setTaskCreationDiscipline] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDeleteDisciplineConfirm, setShowDeleteDisciplineConfirm] = useState(false);
    const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showReopenConfirm, setShowReopenConfirm] = useState(false);
    const [showRemoveUserConfirm, setShowRemoveUserConfirm] = useState(false);
    const [userToRemove, setUserToRemove] = useState(null);
    const [taskViewMode, setTaskViewMode] = useState('grid');
    const [taskStatusFilter, setTaskStatusFilter] = useState('all');
    const [latestSubmissionsByTask, setLatestSubmissionsByTask] = useState(new Map());
    const [gradesByTask, setGradesByTask] = useState(new Map());

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

            const nextDisciplines = disciplinesData.data || [];
            const nextUsers = usersData.users || usersData.data || [];
            const nextTasks = tasksData.data || [];
            const nextRole = getCurrentCourseRole(courseObject, nextUsers, user);

            setDisciplines(nextDisciplines);
            setUsers(nextUsers);
            setTasks(nextTasks);

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
        } catch (error) {
            console.error(error);
            setCourse(null);
            showToast('error', getApiErrorMessage(error, 'Не удалось загрузить данные курса'));
        } finally {
            setLoading(false);
        }
    }, [currentCourseParam, navigate, showToast, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const taskCards = useMemo(
        () => tasks
            .map((task) => {
                const discipline = disciplines.find((item) => Number(item.id) === Number(task.discipline_id));

                if (!discipline) {
                    return null;
                }

                const grade = gradesByTask.get(Number(task.id)) || null;
                const latestSubmission = latestSubmissionsByTask.get(Number(task.id)) || null;
                const status = isTeacher ? null : getTaskSubmissionStatus(task.deadline, latestSubmission);

                return {
                    task,
                    discipline,
                    creatorName: getTaskCreatorName(task, users),
                    materialsCount: getTaskMaterials(task).length,
                    grade,
                    status
                };
            })
            .filter(Boolean)
            .filter((item) => matchesTaskStatusFilter(item.status, taskStatusFilter)),
        [disciplines, gradesByTask, isTeacher, latestSubmissionsByTask, taskStatusFilter, tasks, users]
    );

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
            showToast('error', getApiErrorMessage(error, 'Ошибка'));
        } finally {
            closeModal(false);
        }
    };

    const handleArchiveCourse = async () => {
        if (!course) {
            return;
        }

        try {
            await courseService.archiveCourse(course.id);
            showToast('success', 'Курс архивирован');
            navigate('/courses/archived');
        } catch (error) {
            showToast('error', getApiErrorMessage(error, 'Ошибка'));
        } finally {
            setShowArchiveConfirm(false);
        }
    };

    const handleRestoreCourse = async () => {
        if (!course) {
            return;
        }

        try {
            await courseService.restoreCourse(course.id);
            showToast('success', 'Курс восстановлен');
            navigate('/courses');
        } catch (error) {
            showToast('error', getApiErrorMessage(error, 'Ошибка'));
        } finally {
            setShowRestoreConfirm(false);
        }
    };

    const applyCoursePatch = (coursePatch) => {
        const nextCourse = coursePatch?.course || coursePatch;

        if (!nextCourse || typeof nextCourse !== 'object') {
            return;
        }

        setCourse((previous) => ({
            ...(previous || {}),
            ...nextCourse
        }));
    };

    const handleRegenerateInviteCode = async () => {
        if (!course) {
            return;
        }

        try {
            const response = await courseService.regenerateInviteCode(course.id);
            applyCoursePatch(response);
            showToast('success', 'Код приглашения обновлён');
        } catch (error) {
            showToast('error', getApiErrorMessage(error, 'Ошибка'));
        }
    };

    const handleGenerateTeacherCode = async () => {
        if (!course) {
            return;
        }

        try {
            const response = await courseService.generateTeacherCode(course.id);
            applyCoursePatch(response);
            showToast('success', course.invite_code_teacher ? 'Код для учителя обновлён' : 'Код для учителя создан');
        } catch (error) {
            showToast('error', getApiErrorMessage(error, 'Ошибка'));
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
            showToast('error', getApiErrorMessage(error, 'Ошибка удаления'));
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
            showToast('error', getApiErrorMessage(error, 'Ошибка удаления дисциплины'));
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
            showToast('error', getApiErrorMessage(error, 'Ошибка удаления задания'));
        } finally {
            setShowDeleteTaskConfirm(false);
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
            showToast('error', getApiErrorMessage(error, 'Ошибка удаления'));
        } finally {
            setShowRemoveUserConfirm(false);
            setUserToRemove(null);
        }
    };

    const handleLeaveCourse = async () => {
        if (!course || isCreator) {
            return;
        }

        try {
            await courseService.leaveCourse(course.id);
            showToast('success', 'Вы вышли из курса');
            navigate('/courses');
        } catch (error) {
            showToast('error', getApiErrorMessage(error, 'Не удалось выйти из курса'));
        } finally {
            setShowLeaveConfirm(false);
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
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="mt-4 text-purple-400 transition hover:text-purple-300"
                    >
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
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(course.invite_code, setCopiedInvite)}
                                        className="rounded p-1 transition hover:bg-white/10"
                                    >
                                        {copiedInvite ? <HiClipboardDocumentCheck className="h-4 w-4 text-green-400" /> : <HiClipboard className="h-4 w-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRegenerateInviteCode}
                                        className="rounded p-1 transition hover:bg-white/10"
                                    >
                                        <HiArrowPath className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1">
                                    <span className="text-xs text-gray-400">Учителя:</span>
                                    <code className="font-mono text-sm text-purple-300">{course.invite_code_teacher || 'Код не создан'}</code>
                                    {course.invite_code_teacher && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(course.invite_code_teacher, setCopiedTeacherInvite)}
                                            className="rounded p-1 transition hover:bg-white/10"
                                        >
                                            {copiedTeacherInvite ? <HiClipboardDocumentCheck className="h-4 w-4 text-green-400" /> : <HiClipboard className="h-4 w-4" />}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleGenerateTeacherCode}
                                        className="rounded p-1 transition hover:bg-white/10"
                                    >
                                        <HiArrowPath className="h-4 w-4" />
                                    </button>
                                </div>
                            </>
                        )}

                        {currentRole && !isCreator && !isArchived && (
                            <button
                                type="button"
                                onClick={() => setShowLeaveConfirm(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600/15 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-600/25"
                            >
                                <HiArrowRightOnRectangle className="h-4 w-4" />
                                Выйти из курса
                            </button>
                        )}

                        {isTeacher && (
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditCourse(true)}
                                    className="rounded-lg bg-purple-600/20 p-2 transition hover:bg-purple-600/30"
                                >
                                    <HiPencil className="h-4 w-4" />
                                </button>

                                {isCreator && (
                                    <>
                                        {!course.is_closed ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowCloseConfirm(true)}
                                                className="rounded-lg bg-yellow-600/20 p-2 transition hover:bg-yellow-600/30"
                                            >
                                                <HiLockClosed className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowReopenConfirm(true)}
                                                className="rounded-lg bg-green-600/20 p-2 transition hover:bg-green-600/30"
                                            >
                                                <HiLockOpen className="h-4 w-4" />
                                            </button>
                                        )}

                                        {course.status !== 'archived' ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowArchiveConfirm(true)}
                                                className="rounded-lg bg-orange-600/20 p-2 transition hover:bg-orange-600/30"
                                            >
                                                <HiArchiveBox className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowRestoreConfirm(true)}
                                                className="rounded-lg bg-blue-600/20 p-2 transition hover:bg-blue-600/30"
                                            >
                                                <HiArchiveBoxXMark className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}

                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="rounded-lg bg-red-600/20 p-2 transition hover:bg-red-600/30"
                                    >
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
                                className={`whitespace-nowrap border-b-2 px-1 pb-3 font-medium transition ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
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
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {disciplines.map((discipline) => (
                                        <div key={discipline.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-purple-500">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 cursor-pointer" onClick={() => navigate(buildDisciplinePath(course, discipline))}>
                                                    <h3 className="mb-2 text-xl font-bold">{discipline.name}</h3>
                                                    <p className="line-clamp-2 text-sm text-gray-400">{discipline.description}</p>
                                                    <div className="mt-3 text-xs text-gray-500">Часов: {discipline.hours || 0}</div>
                                                </div>

                                                {isTeacher && (
                                                    <ActionMenu
                                                        buttonClassName="border border-white/10 bg-white/5"
                                                        items={[
                                                            {
                                                                label: 'Создать задание',
                                                                icon: HiPlus,
                                                                disabled: isArchived,
                                                                onClick: () => {
                                                                    setTaskCreationDiscipline(discipline);
                                                                    setShowCreateTask(true);
                                                                }
                                                            },
                                                            {
                                                                label: 'Редактировать',
                                                                icon: HiPencil,
                                                                onClick: () => {
                                                                    setSelectedDiscipline(discipline);
                                                                    setShowEditDiscipline(true);
                                                                }
                                                            },
                                                            {
                                                                label: 'Удалить',
                                                                icon: HiTrash,
                                                                danger: true,
                                                                onClick: () => {
                                                                    setSelectedDiscipline(discipline);
                                                                    setShowDeleteDisciplineConfirm(true);
                                                                }
                                                            }
                                                        ]}
                                                    />
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
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-semibold">Задания</h2>
                                    {isTeacher && (
                                        <p className="mt-1 text-sm text-slate-500">
                                            Создание задания доступно из меню дисциплины.
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    {!isTeacher && (
                                        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                                            {[
                                                { id: 'all', label: 'Все' },
                                                { id: 'submitted', label: 'Сданные' },
                                                { id: 'not_submitted', label: 'Не сданные' }
                                            ].map((filter) => (
                                                <button
                                                    key={filter.id}
                                                    type="button"
                                                    onClick={() => setTaskStatusFilter(filter.id)}
                                                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                                                        taskStatusFilter === filter.id
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
                                            onClick={() => setTaskViewMode('grid')}
                                            className={`rounded-xl p-2.5 transition ${
                                                taskViewMode === 'grid'
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
                                            onClick={() => setTaskViewMode('list')}
                                            className={`rounded-xl p-2.5 transition ${
                                                taskViewMode === 'list'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                            }`}
                                            aria-label="Список"
                                            title="Список"
                                        >
                                            <HiBars3 className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="rounded-2xl border border-purple-400/15 bg-purple-500/10 px-4 py-2 text-sm text-purple-100">
                                        Всего заданий: <span className="font-semibold">{tasks.length}</span>
                                    </div>
                                </div>
                            </div>

                            {taskCards.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-slate-500">
                                    В этом курсе пока нет заданий.
                                </div>
                            ) : (
                                <div className={taskViewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-4'}>
                                    {taskCards.map(({ task, discipline, creatorName, materialsCount, grade, status }) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            course={course}
                                            discipline={discipline}
                                            layout={taskViewMode}
                                            creatorName={creatorName}
                                            disciplineLabel={discipline.name}
                                            materialsCount={materialsCount}
                                            grade={grade}
                                            status={status}
                                            actionItems={isTeacher ? [
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
                        </motion.div>
                    )}

                    {activeTab === 'users' && (
                        <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <h2 className="mb-6 text-2xl font-semibold">Участники ({users.length})</h2>
                            {users.length === 0 ? (
                                <p className="text-gray-500">В этом курсе пока нет участников</p>
                            ) : (
                                <div className="space-y-3">
                                    {users.map((item) => (
                                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                                    {item.avatar_url ? (
                                                        <img src={item.avatar_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <HiUserCircle className="h-8 w-8 text-white" />
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-white">{item.name}</p>
                                                    <p className="truncate text-sm text-gray-400">{item.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <span className="rounded-full bg-purple-600/20 px-2 py-1 text-xs text-purple-300">
                                                    {getRoleLabel(item.pivot?.role)}
                                                </span>
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
            <CreateTaskModal
                isOpen={showCreateTask}
                onClose={() => {
                    setShowCreateTask(false);
                    setTaskCreationDiscipline(null);
                }}
                onSuccess={() => {
                    setShowCreateTask(false);
                    setTaskCreationDiscipline(null);
                    fetchData();
                }}
                courseId={course.id}
                disciplineId={taskCreationDiscipline?.id}
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
            <EditCourseModal
                isOpen={showEditCourse}
                onClose={() => setShowEditCourse(false)}
                course={course}
                onSuccess={() => {
                    setShowEditCourse(false);
                    fetchData();
                }}
            />

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteCourse}
                title="Удаление курса"
                message="Вы уверены? Это действие необратимо."
                confirmText="Удалить"
            />
            <ConfirmModal
                isOpen={showDeleteDisciplineConfirm}
                onClose={() => setShowDeleteDisciplineConfirm(false)}
                onConfirm={handleDeleteDiscipline}
                title="Удаление дисциплины"
                message={`Удалить дисциплину ${selectedDiscipline?.name || ''}?`}
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
            <ConfirmModal
                isOpen={showArchiveConfirm}
                onClose={() => setShowArchiveConfirm(false)}
                onConfirm={handleArchiveCourse}
                title="Архивация курса"
                message="Курс будет перемещён в архив."
                confirmText="Архивировать"
            />
            <ConfirmModal
                isOpen={showLeaveConfirm}
                onClose={() => setShowLeaveConfirm(false)}
                onConfirm={handleLeaveCourse}
                title="Выход из курса"
                message={`Выйти из курса ${course.name}?`}
                confirmText="Выйти"
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
                onConfirm={() => runCourseAction(courseService.closeCourse, 'Курс закрыт для новых участников', setShowCloseConfirm)}
                title="Закрытие курса"
                message="Новые участники не смогут вступить в курс."
                confirmText="Закрыть"
            />
            <ConfirmModal
                isOpen={showReopenConfirm}
                onClose={() => setShowReopenConfirm(false)}
                onConfirm={() => runCourseAction(courseService.reopenCourse, 'Курс снова открыт для новых участников', setShowReopenConfirm)}
                title="Открытие курса"
                message="Новые участники снова смогут вступить в курс."
                confirmText="Открыть"
            />
            <ConfirmModal
                isOpen={showRemoveUserConfirm}
                onClose={() => {
                    setShowRemoveUserConfirm(false);
                    setUserToRemove(null);
                }}
                onConfirm={handleRemoveUser}
                title="Удаление участника"
                message={`Удалить ${userToRemove?.name || 'этого участника'} из курса?`}
                confirmText="Удалить"
            />
        </MainLayout>
    );
};

export default CourseDetailPage;
