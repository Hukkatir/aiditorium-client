import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    HiAcademicCap,
    HiArrowPath,
    HiCheck,
    HiDocumentText,
    HiMiniRectangleStack,
    HiPencilSquare,
    HiShieldCheck,
    HiTrash,
    HiUser,
    HiXMark
} from 'react-icons/hi2';
import MainLayout from '../components/layout/MainLayout';
import ConfirmModal from '../components/layout/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { adminService } from '../services/adminService';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import { getApiErrorMessage } from '../utils/apiUtils';
import {
    formatCourseRoleLabel,
    formatGlobalRoleLabel,
    getGlobalRoleName
} from '../utils/roleUtils';

const EMPTY_DASHBOARD = {
    stats: {},
    roles: [],
    users: [],
    courses: [],
    disciplines: [],
    tasks: [],
    files: []
};

const formatDateTime = (value) => {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getDateTimeLocalValue = (value) => {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    date.setSeconds(0, 0);
    const timezoneOffset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const formatFileSize = (size) => {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '—';
    }

    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const matchesSearch = (search, ...values) => {
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) {
        return true;
    }

    return values.some((value) => String(value || '').toLowerCase().includes(needle));
};

const getStatusLabel = (status) => {
    const value = String(status || '').toLowerCase();

    if (value === 'active') {
        return 'Активен';
    }

    if (value === 'archived') {
        return 'Архив';
    }

    return status || 'Не указан';
};

const getUserCoursesSummary = (courses = []) => {
    if (!courses.length) {
        return 'Не состоит в курсах';
    }

    return courses
        .map((course) => `${course.name || 'Курс'}: ${formatCourseRoleLabel(course.pivot?.role)}`)
        .join(', ');
};

const getRoleBadgeClass = (role) => (
    getGlobalRoleName(role) === 'admin'
        ? 'bg-purple-500/15 text-purple-100'
        : 'bg-white/10 text-slate-300'
);

const COURSE_ROLE_OPTIONS = [
    { value: 'student', label: 'Ученик' },
    { value: 'teacher', label: 'Преподаватель' }
];

const AdminDashboardPage = () => {
    const { user, updateUser } = useAuth();
    const { showToast } = useToast();

    const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('users');
    const [search, setSearch] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });
    const [savingUser, setSavingUser] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deletingUser, setDeletingUser] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [courseForm, setCourseForm] = useState({
        name: '',
        description: '',
        slug: '',
        status: 'active',
        backgroundFile: null
    });
    const [savingCourse, setSavingCourse] = useState(false);
    const [editingDiscipline, setEditingDiscipline] = useState(null);
    const [disciplineForm, setDisciplineForm] = useState({
        name: '',
        description: '',
        hours: '',
        slug: ''
    });
    const [savingDiscipline, setSavingDiscipline] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [taskForm, setTaskForm] = useState({
        name: '',
        description: '',
        scores: '',
        deadline: ''
    });
    const [savingTask, setSavingTask] = useState(false);
    const [editingFile, setEditingFile] = useState(null);
    const [fileForm, setFileForm] = useState({
        course_id: '',
        task_id: '',
        is_public: false
    });
    const [savingFile, setSavingFile] = useState(false);
    const [entityToDelete, setEntityToDelete] = useState(null);
    const [deletingEntity, setDeletingEntity] = useState(false);
    const [courseMemberForms, setCourseMemberForms] = useState({});
    const [savingCourseMemberFor, setSavingCourseMemberFor] = useState(null);
    const [memberToRemove, setMemberToRemove] = useState(null);
    const [removingCourseMember, setRemovingCourseMember] = useState(false);

    const users = useMemo(() => (Array.isArray(dashboard.users) ? dashboard.users : []), [dashboard.users]);
    const courses = useMemo(() => (Array.isArray(dashboard.courses) ? dashboard.courses : []), [dashboard.courses]);
    const disciplines = useMemo(() => (
        Array.isArray(dashboard.disciplines) ? dashboard.disciplines : []
    ), [dashboard.disciplines]);
    const tasks = useMemo(() => (Array.isArray(dashboard.tasks) ? dashboard.tasks : []), [dashboard.tasks]);
    const files = useMemo(() => (Array.isArray(dashboard.files) ? dashboard.files : []), [dashboard.files]);
    const roles = useMemo(() => (Array.isArray(dashboard.roles) ? dashboard.roles : []), [dashboard.roles]);

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const data = await adminService.getDashboard();
            setDashboard({ ...EMPTY_DASHBOARD, ...data, stats: data.stats || {} });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось загрузить админ-панель'), 5000);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const filteredUsers = useMemo(() => users.filter((item) => matchesSearch(
        search,
        item.name,
        item.email,
        formatGlobalRoleLabel(item),
        getUserCoursesSummary(item.courses || [])
    )), [search, users]);

    const filteredCourses = useMemo(() => courses.filter((course) => matchesSearch(
        search,
        course.name,
        course.slug,
        course.description,
        getStatusLabel(course.status),
        (course.users || []).map((item) => item.name).join(' ')
    )), [courses, search]);

    const filteredDisciplines = useMemo(() => disciplines.filter((discipline) => matchesSearch(
        search,
        discipline.name,
        discipline.slug,
        discipline.course?.name,
        discipline.description
    )), [disciplines, search]);

    const filteredTasks = useMemo(() => tasks.filter((task) => matchesSearch(
        search,
        task.name,
        task.description,
        task.course?.name,
        task.discipline?.name,
        task.user?.name,
        task.user?.email
    )), [search, tasks]);

    const filteredFiles = useMemo(() => files.filter((file) => matchesSearch(
        search,
        file.original_name,
        file.extension,
        file.type,
        file.owner?.name,
        file.owner?.email,
        file.course?.name,
        file.task?.name
    )), [files, search]);

    const tabs = [
        { id: 'users', label: 'Пользователи', count: users.length },
        { id: 'courses', label: 'Курсы', count: courses.length },
        { id: 'disciplines', label: 'Дисциплины', count: disciplines.length },
        { id: 'tasks', label: 'Задания', count: tasks.length },
        { id: 'files', label: 'Файлы', count: files.length }
    ];

    const stats = [
        { label: 'Пользователи', value: dashboard.stats?.users ?? users.length, icon: HiUser },
        { label: 'Курсы', value: dashboard.stats?.courses ?? courses.length, icon: HiAcademicCap },
        { label: 'Дисциплины', value: dashboard.stats?.disciplines ?? disciplines.length, icon: HiMiniRectangleStack },
        { label: 'Задания', value: dashboard.stats?.tasks ?? tasks.length, icon: HiDocumentText },
        { label: 'Файлы', value: dashboard.stats?.files ?? files.length, icon: HiDocumentText }
    ];

    const startEditUser = (targetUser) => {
        setEditingUser(targetUser);
        setEditForm({
            name: targetUser.name || '',
            email: targetUser.email || '',
            password: '',
            role: getGlobalRoleName(targetUser) || 'user'
        });
        setAvatarFile(null);
    };

    const closeEditUser = () => {
        if (savingUser) {
            return;
        }

        setEditingUser(null);
        setEditForm({
            name: '',
            email: '',
            password: '',
            role: 'user'
        });
        setAvatarFile(null);
    };

    const saveUser = async () => {
        if (!editingUser) {
            return;
        }

        const name = editForm.name.trim();
        const email = editForm.email.trim();

        if (!name || !email) {
            showToast('error', 'Заполните имя и почту пользователя');
            return;
        }

        const isSelf = Number(editingUser.id) === Number(user?.id);
        const previousRole = getGlobalRoleName(editingUser);
        const nextRole = editForm.role || previousRole || 'user';
        const updatePayload = { name, email };

        if (editForm.password.trim()) {
            updatePayload.password = editForm.password.trim();
        }

        setSavingUser(true);

        try {
            const updateResponse = await userService.updateUser(editingUser.id, updatePayload);

            if (!isSelf && nextRole !== previousRole) {
                await userService.setUserRole(editingUser.id, nextRole);
            }

            let avatarResponse = null;
            if (avatarFile) {
                avatarResponse = await userService.uploadAvatar(editingUser.id, avatarFile);
            }

            if (isSelf && updateResponse.user) {
                updateUser(avatarResponse?.user || updateResponse.user);
            }

            showToast('success', 'Пользователь обновлен');
            setEditingUser(null);
            setEditForm({
                name: '',
                email: '',
                password: '',
                role: 'user'
            });
            setAvatarFile(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить пользователя'), 5000);
        } finally {
            setSavingUser(false);
        }
    };

    const resetUserAvatar = async () => {
        if (!editingUser || savingAvatar) {
            return;
        }

        setSavingAvatar(true);

        try {
            await userService.deleteAvatar(editingUser.id);
            setAvatarFile(null);
            if (Number(editingUser.id) === Number(user?.id)) {
                updateUser({ ...user, avatar_url: null, avatar: null });
            }
            showToast('success', 'Аватар пользователя сброшен');
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось сбросить аватар'), 5000);
        } finally {
            setSavingAvatar(false);
        }
    };

    const confirmDeleteUser = async () => {
        if (deletingUser) {
            return;
        }

        if (!userToDelete) {
            return;
        }

        if (Number(userToDelete.id) === Number(user?.id)) {
            showToast('error', 'Нельзя удалить свою учетную запись');
            setUserToDelete(null);
            return;
        }

        setDeletingUser(true);

        try {
            await userService.deleteUser(userToDelete.id);
            showToast('success', 'Пользователь удален');
            setUserToDelete(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось удалить пользователя'), 5000);
        } finally {
            setDeletingUser(false);
        }
    };

    const startEditCourse = (course) => {
        setEditingCourse(course);
        setCourseForm({
            name: course.name || '',
            description: course.description || '',
            slug: course.slug || '',
            status: course.status || 'active',
            backgroundFile: null
        });
    };

    const saveCourse = async () => {
        if (!editingCourse) {
            return;
        }

        if (!courseForm.name.trim()) {
            showToast('error', 'Введите название курса');
            return;
        }

        const payload = new FormData();
        payload.append('name', courseForm.name.trim());
        payload.append('description', courseForm.description || '');
        payload.append('status', courseForm.status || 'active');
        payload.append('slug', courseForm.slug || '');
        if (courseForm.backgroundFile) {
            payload.append('background_logo', courseForm.backgroundFile);
        }

        setSavingCourse(true);

        try {
            await courseService.updateCourse(editingCourse.id, payload);
            showToast('success', 'Курс обновлен');
            setEditingCourse(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить курс'), 5000);
        } finally {
            setSavingCourse(false);
        }
    };

    const resetCourseBackground = async () => {
        if (!editingCourse || savingCourse) {
            return;
        }

        setSavingCourse(true);

        try {
            await courseService.resetCourseBackground(editingCourse.id);
            setCourseForm((previous) => ({ ...previous, backgroundFile: null }));
            showToast('success', 'Баннер курса сброшен');
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось сбросить баннер курса'), 5000);
        } finally {
            setSavingCourse(false);
        }
    };

    const getCourseMemberForm = (courseId) => (
        courseMemberForms[courseId] || { user_id: '', role: 'student' }
    );

    const updateCourseMemberForm = (courseId, updates) => {
        setCourseMemberForms((previous) => ({
            ...previous,
            [courseId]: {
                user_id: '',
                role: 'student',
                ...(previous[courseId] || {}),
                ...updates
            }
        }));
    };

    const addCourseMember = async (course) => {
        const form = getCourseMemberForm(course.id);
        const userId = Number(form.user_id);

        if (!userId) {
            showToast('error', 'Выберите пользователя для добавления в курс');
            return;
        }

        setSavingCourseMemberFor(course.id);

        try {
            await adminService.addCourseUser(course.id, userId, form.role || 'student');
            showToast('success', 'Участник курса добавлен');
            setCourseMemberForms((previous) => ({
                ...previous,
                [course.id]: { user_id: '', role: 'student' }
            }));
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось добавить участника в курс'), 5000);
        } finally {
            setSavingCourseMemberFor(null);
        }
    };

    const confirmRemoveCourseMember = async () => {
        if (!memberToRemove || removingCourseMember) {
            return;
        }

        if (Number(memberToRemove.member?.id) === Number(memberToRemove.course?.creator_id)) {
            showToast('error', 'Нельзя исключить создателя курса');
            setMemberToRemove(null);
            return;
        }

        setRemovingCourseMember(true);

        try {
            await adminService.removeCourseUser(memberToRemove.course.id, memberToRemove.member.id);
            showToast('success', 'Участник исключен из курса');
            setMemberToRemove(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось исключить участника из курса'), 5000);
        } finally {
            setRemovingCourseMember(false);
        }
    };

    const startEditDiscipline = (discipline) => {
        setEditingDiscipline(discipline);
        setDisciplineForm({
            name: discipline.name || '',
            description: discipline.description || '',
            hours: discipline.hours ?? '',
            slug: discipline.slug || ''
        });
    };

    const saveDiscipline = async () => {
        if (!editingDiscipline) {
            return;
        }

        if (!disciplineForm.name.trim()) {
            showToast('error', 'Введите название дисциплины');
            return;
        }

        setSavingDiscipline(true);

        try {
            await disciplineService.updateDiscipline(editingDiscipline.id, {
                name: disciplineForm.name.trim(),
                description: disciplineForm.description || '',
                hours: disciplineForm.hours === '' ? 0 : Number(disciplineForm.hours),
                slug: disciplineForm.slug || ''
            });
            showToast('success', 'Дисциплина обновлена');
            setEditingDiscipline(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить дисциплину'), 5000);
        } finally {
            setSavingDiscipline(false);
        }
    };

    const startEditTask = (task) => {
        setEditingTask(task);
        setTaskForm({
            name: task.name || '',
            description: task.description || '',
            scores: task.scores ?? '',
            deadline: getDateTimeLocalValue(task.deadline)
        });
    };

    const saveTask = async () => {
        if (!editingTask) {
            return;
        }

        if (!taskForm.name.trim()) {
            showToast('error', 'Введите название задания');
            return;
        }

        const payload = new FormData();
        payload.append('name', taskForm.name.trim());
        payload.append('description', taskForm.description || '');
        if (String(taskForm.scores).trim()) {
            payload.append('scores', String(Number(taskForm.scores)));
        }
        if (taskForm.deadline) {
            payload.append('deadline', taskForm.deadline);
        }

        setSavingTask(true);

        try {
            await taskService.updateTask(editingTask.id, payload);
            showToast('success', 'Задание обновлено');
            setEditingTask(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить задание'), 5000);
        } finally {
            setSavingTask(false);
        }
    };

    const startEditFile = (file) => {
        setEditingFile(file);
        setFileForm({
            course_id: file.course_id ?? '',
            task_id: file.task_id ?? '',
            is_public: Boolean(file.is_public)
        });
    };

    const saveFile = async () => {
        if (!editingFile) {
            return;
        }

        setSavingFile(true);

        try {
            await fileService.updateFile(editingFile.id, {
                course_id: fileForm.course_id === '' ? null : Number(fileForm.course_id),
                task_id: fileForm.task_id === '' ? null : Number(fileForm.task_id),
                is_public: Boolean(fileForm.is_public)
            });
            showToast('success', 'Файл обновлен');
            setEditingFile(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить файл'), 5000);
        } finally {
            setSavingFile(false);
        }
    };

    const confirmDeleteEntity = async () => {
        if (!entityToDelete || deletingEntity) {
            return;
        }

        setDeletingEntity(true);

        try {
            if (entityToDelete.type === 'course') {
                await courseService.deleteCourse(entityToDelete.item.id);
            } else if (entityToDelete.type === 'discipline') {
                await disciplineService.deleteDiscipline(entityToDelete.item.id);
            } else if (entityToDelete.type === 'task') {
                await taskService.deleteTask(entityToDelete.item.id);
            } else if (entityToDelete.type === 'file') {
                await fileService.deleteFile(entityToDelete.item.id);
            }

            showToast('success', `${entityToDelete.label} удален`);
            setEntityToDelete(null);
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, `Не удалось удалить ${entityToDelete.label.toLowerCase()}`), 5000);
        } finally {
            setDeletingEntity(false);
        }
    };

    const renderEmptyState = (label) => (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
            {label}
        </div>
    );

    const renderUsers = () => (
        filteredUsers.length === 0 ? renderEmptyState('Пользователи не найдены.') : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Пользователь</th>
                            <th className="px-4 py-3">Глобальная роль</th>
                            <th className="px-4 py-3">Курсы и роли</th>
                            <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredUsers.map((item) => {
                            const isSelf = Number(item.id) === Number(user?.id);

                            return (
                                <tr key={item.id} className="align-top">
                                    <td className="px-4 py-4">
                                        <p className="font-medium text-white">{item.name || 'Пользователь'}</p>
                                        <p className="mt-1 break-all text-xs text-slate-500">{item.email || 'Почта не указана'}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getRoleBadgeClass(item)}`}>
                                            {formatGlobalRoleLabel(item)}
                                        </span>
                                    </td>
                                    <td className="max-w-xl px-4 py-4 text-slate-300">
                                        {item.courses?.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {item.courses.map((course) => (
                                                    <span key={course.id} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs">
                                                        {course.name || 'Курс'} · {formatCourseRoleLabel(course.pivot?.role)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500">Не состоит в курсах</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => startEditUser(item)}
                                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                                            >
                                                <HiPencilSquare className="h-4 w-4" />
                                                Редактировать
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setUserToDelete(item)}
                                                disabled={isSelf}
                                                className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <HiTrash className="h-4 w-4" />
                                                Удалить
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )
    );

    const renderCourses = () => (
        filteredCourses.length === 0 ? renderEmptyState('Курсы не найдены.') : (
            <div className="grid gap-3">
                {filteredCourses.map((course) => {
                    const courseUsers = Array.isArray(course.users) ? course.users : [];
                    const enrolledUserIds = new Set(courseUsers.map((member) => Number(member.id)));
                    const availableUsers = users.filter((item) => !enrolledUserIds.has(Number(item.id)));
                    const memberForm = getCourseMemberForm(course.id);
                    const isSavingMember = Number(savingCourseMemberFor) === Number(course.id);

                    return (
                        <article key={course.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{course.name || 'Курс без названия'}</h3>
                                    <p className="mt-1 text-sm text-slate-500">Короткий URL: {course.slug || 'не указан'}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                                        {getStatusLabel(course.status)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => startEditCourse(course)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                                    >
                                        <HiPencilSquare className="h-4 w-4" />
                                        Редактировать
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEntityToDelete({ type: 'course', item: course, label: 'Курс' })}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                    >
                                        <HiTrash className="h-4 w-4" />
                                        Удалить
                                    </button>
                                </div>
                            </div>
                            {course.description && (
                                <p className="mt-3 text-sm leading-6 text-slate-300">{course.description}</p>
                            )}
                            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                                <div className="rounded-xl bg-black/20 p-3">
                                    <p className="text-slate-500">Участники</p>
                                    <p className="mt-1 font-semibold text-white">{course.users_count ?? courseUsers.length}</p>
                                </div>
                                <div className="rounded-xl bg-black/20 p-3">
                                    <p className="text-slate-500">Дисциплины</p>
                                    <p className="mt-1 font-semibold text-white">{course.disciplines_count ?? course.disciplines?.length ?? 0}</p>
                                </div>
                                <div className="rounded-xl bg-black/20 p-3">
                                    <p className="text-slate-500">Задания</p>
                                    <p className="mt-1 font-semibold text-white">{course.tasks_count ?? 0}</p>
                                </div>
                                <div className="rounded-xl bg-black/20 p-3">
                                    <p className="text-slate-500">Файлы</p>
                                    <p className="mt-1 font-semibold text-white">{course.files_count ?? 0}</p>
                                </div>
                            </div>

                            <div className="mt-5 border-t border-white/10 pt-4">
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">Участники курса</h4>
                                        <p className="mt-1 text-xs text-slate-500">Добавление пользователя напрямую с ролью в курсе.</p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_auto]">
                                        <select
                                            value={memberForm.user_id}
                                            onChange={(event) => updateCourseMemberForm(course.id, { user_id: event.target.value })}
                                            disabled={!availableUsers.length || isSavingMember}
                                            className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="" className="bg-[#1A1A1C]">
                                                {availableUsers.length ? 'Выберите пользователя' : 'Все пользователи уже в курсе'}
                                            </option>
                                            {availableUsers.map((availableUser) => (
                                                <option key={availableUser.id} value={availableUser.id} className="bg-[#1A1A1C]">
                                                    {availableUser.name || availableUser.email || `Пользователь #${availableUser.id}`}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={memberForm.role}
                                            onChange={(event) => updateCourseMemberForm(course.id, { role: event.target.value })}
                                            disabled={isSavingMember}
                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {COURSE_ROLE_OPTIONS.map((role) => (
                                                <option key={role.value} value={role.value} className="bg-[#1A1A1C]">
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => addCourseMember(course)}
                                            disabled={!memberForm.user_id || isSavingMember}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isSavingMember ? <HiArrowPath className="h-4 w-4 animate-spin" /> : <HiCheck className="h-4 w-4" />}
                                            Добавить
                                        </button>
                                    </div>
                                </div>

                                {courseUsers.length ? (
                                    <div className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
                                        {courseUsers.map((member) => {
                                            const isCreator = Number(member.id) === Number(course.creator_id);

                                            return (
                                                <div key={member.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-white">{member.name || 'Пользователь'}</p>
                                                        <p className="truncate text-xs text-slate-500">{member.email || 'Почта не указана'}</p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                                                            {formatCourseRoleLabel(member.pivot?.role)}
                                                        </span>
                                                        {isCreator && (
                                                            <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs text-purple-100">
                                                                Создатель
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setMemberToRemove({ course, member })}
                                                            disabled={isCreator || removingCourseMember}
                                                            title={isCreator ? 'Создателя курса нельзя исключить' : undefined}
                                                            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <HiTrash className="h-4 w-4" />
                                                            Исключить
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-500">
                                        В курсе пока нет участников.
                                    </p>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        )
    );

    const renderDisciplines = () => (
        filteredDisciplines.length === 0 ? renderEmptyState('Дисциплины не найдены.') : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Дисциплина</th>
                            <th className="px-4 py-3">Курс</th>
                            <th className="px-4 py-3">Номер</th>
                            <th className="px-4 py-3">Задания</th>
                            <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredDisciplines.map((discipline) => (
                            <tr key={discipline.id}>
                                <td className="px-4 py-4">
                                    <p className="font-medium text-white">{discipline.name || 'Дисциплина'}</p>
                                    <p className="mt-1 text-xs text-slate-500">Короткий URL: {discipline.slug || 'не указан'}</p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">{discipline.course?.name || 'Курс не указан'}</td>
                                <td className="px-4 py-4 text-slate-300">{discipline.discipline_number || '—'}</td>
                                <td className="px-4 py-4 text-slate-300">{discipline.tasks_count ?? 0}</td>
                                <td className="px-4 py-4">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEditDiscipline(discipline)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                                        >
                                            <HiPencilSquare className="h-4 w-4" />
                                            Редактировать
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntityToDelete({ type: 'discipline', item: discipline, label: 'Дисциплина' })}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                        >
                                            <HiTrash className="h-4 w-4" />
                                            Удалить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    );

    const renderTasks = () => (
        filteredTasks.length === 0 ? renderEmptyState('Задания не найдены.') : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Задание</th>
                            <th className="px-4 py-3">Курс</th>
                            <th className="px-4 py-3">Автор</th>
                            <th className="px-4 py-3">Срок</th>
                            <th className="px-4 py-3">Файлы</th>
                            <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredTasks.map((task) => (
                            <tr key={task.id} className="align-top">
                                <td className="px-4 py-4">
                                    <p className="font-medium text-white">{task.name || 'Задание'}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        №{task.task_number || '—'} · {task.scores ?? 0} баллов
                                    </p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">
                                    <p>{task.course?.name || 'Курс не указан'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{task.discipline?.name || 'Дисциплина не указана'}</p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">
                                    <p>{task.user?.name || 'Не указан'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{task.user?.email || ''}</p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">{formatDateTime(task.deadline)}</td>
                                <td className="px-4 py-4 text-slate-300">
                                    Вложения: {task.attachments_count ?? 0}
                                    <br />
                                    Сдачи: {task.submissions_count ?? 0}
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEditTask(task)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                                        >
                                            <HiPencilSquare className="h-4 w-4" />
                                            Редактировать
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntityToDelete({ type: 'task', item: task, label: 'Задание' })}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                        >
                                            <HiTrash className="h-4 w-4" />
                                            Удалить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    );

    const renderFiles = () => (
        filteredFiles.length === 0 ? renderEmptyState('Файлы не найдены.') : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Файл</th>
                            <th className="px-4 py-3">Владелец</th>
                            <th className="px-4 py-3">Контекст</th>
                            <th className="px-4 py-3">Размер</th>
                            <th className="px-4 py-3">Дата</th>
                            <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredFiles.map((file) => (
                            <tr key={file.id} className="align-top">
                                <td className="px-4 py-4">
                                    <p className="font-medium text-white">{file.original_name || file.path || 'Файл'}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {file.type || 'тип не указан'} · {file.extension || 'без расширения'}
                                    </p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">
                                    <p>{file.owner?.name || 'Не указан'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{file.owner?.email || ''}</p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">
                                    <p>{file.course?.name || 'Курс не указан'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{file.task?.name || 'Задание не указано'}</p>
                                </td>
                                <td className="px-4 py-4 text-slate-300">{formatFileSize(file.size_bytes)}</td>
                                <td className="px-4 py-4 text-slate-300">{formatDateTime(file.created_at)}</td>
                                <td className="px-4 py-4">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEditFile(file)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15"
                                        >
                                            <HiPencilSquare className="h-4 w-4" />
                                            Редактировать
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntityToDelete({ type: 'file', item: file, label: 'Файл' })}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                        >
                                            <HiTrash className="h-4 w-4" />
                                            Удалить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    );

    const renderActiveTab = () => {
        if (activeTab === 'courses') {
            return renderCourses();
        }

        if (activeTab === 'disciplines') {
            return renderDisciplines();
        }

        if (activeTab === 'tasks') {
            return renderTasks();
        }

        if (activeTab === 'files') {
            return renderFiles();
        }

        return renderUsers();
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex min-h-[50vh] items-center justify-center">
                    <div className="h-14 w-14 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/15 px-3 py-1.5 text-sm text-purple-100">
                                <HiShieldCheck className="h-4 w-4" />
                                Глобальная роль: {formatGlobalRoleLabel(user)}
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">Админ-панель</h1>
                            <p className="mt-3 text-sm leading-7 text-slate-300 md:text-base">
                                Управление пользователями и просмотр всех курсов, дисциплин, заданий и файлов системы.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => loadDashboard({ silent: true })}
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                        >
                            <HiArrowPath className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                            Обновить данные
                        </button>
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {stats.map((item) => {
                        const Icon = item.icon;

                        return (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-slate-500">{item.label}</p>
                                    <Icon className="h-5 w-5 text-purple-300" />
                                </div>
                                <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                            </div>
                        );
                    })}
                </section>

                <section className="rounded-[28px] border border-white/10 bg-[#16161C] p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                                        activeTab === tab.id
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                    <span className="ml-2 text-xs opacity-70">{tab.count}</span>
                                </button>
                            ))}
                        </div>

                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Поиск по текущему разделу"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500 xl:max-w-sm"
                        />
                    </div>

                    <div className="mt-5">
                        {renderActiveTab()}
                    </div>
                </section>
            </motion.div>

            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#1A1A1C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Пользователь</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Редактирование</h2>
                            </div>
                            <button
                                type="button"
                                onClick={closeEditUser}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <HiXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Имя</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Почта</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Новый пароль</label>
                                <input
                                    type="password"
                                    value={editForm.password}
                                    onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                                    placeholder="Оставьте пустым, если не меняете"
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Глобальная роль</label>
                                <select
                                    value={editForm.role}
                                    onChange={(event) => setEditForm((previous) => ({ ...previous, role: event.target.value }))}
                                    disabled={Number(editingUser.id) === Number(user?.id)}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500 disabled:opacity-50"
                                >
                                    {roles.map((role) => (
                                        <option key={role.id || role.name} value={role.name} className="bg-[#1A1A1C]">
                                            {formatGlobalRoleLabel(role)}
                                        </option>
                                    ))}
                                </select>
                                {Number(editingUser.id) === Number(user?.id) && (
                                    <p className="mt-2 text-xs text-slate-500">Свою глобальную роль изменить нельзя.</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm text-slate-400">Аватар</label>
                                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                                        className="min-w-0 flex-1 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-purple-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={resetUserAvatar}
                                        disabled={savingAvatar}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                                    >
                                        {savingAvatar ? <HiArrowPath className="h-4 w-4 animate-spin" /> : <HiTrash className="h-4 w-4" />}
                                        Сбросить аватар
                                    </button>
                                </div>
                                {avatarFile && (
                                    <p className="mt-2 text-xs text-slate-500">Будет загружен файл: {avatarFile.name}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeEditUser}
                                disabled={savingUser}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                            >
                                <HiXMark className="h-5 w-5" />
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={saveUser}
                                disabled={savingUser}
                                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingUser ? (
                                    <HiArrowPath className="h-5 w-5 animate-spin" />
                                ) : (
                                    <HiCheck className="h-5 w-5" />
                                )}
                                {savingUser ? 'Сохраняем...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#1A1A1C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Курс</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Редактирование курса</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingCourse && setEditingCourse(null)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <HiXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Название</label>
                                <input
                                    type="text"
                                    value={courseForm.name}
                                    onChange={(event) => setCourseForm((previous) => ({ ...previous, name: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Статус</label>
                                <select
                                    value={courseForm.status}
                                    onChange={(event) => setCourseForm((previous) => ({ ...previous, status: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                >
                                    <option value="active" className="bg-[#1A1A1C]">Активен</option>
                                    <option value="archived" className="bg-[#1A1A1C]">Архив</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Короткий URL</label>
                                <input
                                    type="text"
                                    value={courseForm.slug}
                                    onChange={(event) => setCourseForm((previous) => ({ ...previous, slug: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Баннер курса</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => setCourseForm((previous) => ({ ...previous, backgroundFile: event.target.files?.[0] || null }))}
                                    className="w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-purple-500"
                                />
                                {courseForm.backgroundFile && (
                                    <p className="mt-2 text-xs text-slate-500">Будет загружен файл: {courseForm.backgroundFile.name}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm text-slate-400">Описание</label>
                                <textarea
                                    rows={4}
                                    value={courseForm.description}
                                    onChange={(event) => setCourseForm((previous) => ({ ...previous, description: event.target.value }))}
                                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-between gap-3">
                            <button
                                type="button"
                                onClick={resetCourseBackground}
                                disabled={savingCourse}
                                className="inline-flex items-center gap-2 rounded-2xl bg-red-500/10 px-5 py-3 font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                                <HiTrash className="h-5 w-5" />
                                Сбросить баннер
                            </button>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => !savingCourse && setEditingCourse(null)}
                                    disabled={savingCourse}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                                >
                                    <HiXMark className="h-5 w-5" />
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={saveCourse}
                                    disabled={savingCourse}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                                >
                                    {savingCourse ? <HiArrowPath className="h-5 w-5 animate-spin" /> : <HiCheck className="h-5 w-5" />}
                                    {savingCourse ? 'Сохраняем...' : 'Сохранить'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingDiscipline && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#1A1A1C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Дисциплина</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Редактирование дисциплины</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingDiscipline && setEditingDiscipline(null)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <HiXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Название</label>
                                <input
                                    type="text"
                                    value={disciplineForm.name}
                                    onChange={(event) => setDisciplineForm((previous) => ({ ...previous, name: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Часы</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={disciplineForm.hours}
                                    onChange={(event) => setDisciplineForm((previous) => ({ ...previous, hours: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm text-slate-400">Короткий URL</label>
                                <input
                                    type="text"
                                    value={disciplineForm.slug}
                                    onChange={(event) => setDisciplineForm((previous) => ({ ...previous, slug: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm text-slate-400">Описание</label>
                                <textarea
                                    rows={4}
                                    value={disciplineForm.description}
                                    onChange={(event) => setDisciplineForm((previous) => ({ ...previous, description: event.target.value }))}
                                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => !savingDiscipline && setEditingDiscipline(null)}
                                disabled={savingDiscipline}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                            >
                                <HiXMark className="h-5 w-5" />
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={saveDiscipline}
                                disabled={savingDiscipline}
                                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingDiscipline ? <HiArrowPath className="h-5 w-5 animate-spin" /> : <HiCheck className="h-5 w-5" />}
                                {savingDiscipline ? 'Сохраняем...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#1A1A1C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Задание</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Редактирование задания</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingTask && setEditingTask(null)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <HiXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <div className="md:col-span-3">
                                <label className="mb-2 block text-sm text-slate-400">Название</label>
                                <input
                                    type="text"
                                    value={taskForm.name}
                                    onChange={(event) => setTaskForm((previous) => ({ ...previous, name: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Баллы</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={taskForm.scores}
                                    onChange={(event) => setTaskForm((previous) => ({ ...previous, scores: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm text-slate-400">Дата сдачи</label>
                                <input
                                    type="datetime-local"
                                    value={taskForm.deadline}
                                    onChange={(event) => setTaskForm((previous) => ({ ...previous, deadline: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500 [color-scheme:dark]"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="mb-2 block text-sm text-slate-400">Описание</label>
                                <textarea
                                    rows={5}
                                    value={taskForm.description}
                                    onChange={(event) => setTaskForm((previous) => ({ ...previous, description: event.target.value }))}
                                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => !savingTask && setEditingTask(null)}
                                disabled={savingTask}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                            >
                                <HiXMark className="h-5 w-5" />
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={saveTask}
                                disabled={savingTask}
                                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingTask ? <HiArrowPath className="h-5 w-5 animate-spin" /> : <HiCheck className="h-5 w-5" />}
                                {savingTask ? 'Сохраняем...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#1A1A1C] p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Файл</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Редактирование файла</h2>
                                <p className="mt-2 text-sm text-slate-500">{editingFile.original_name || editingFile.path}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => !savingFile && setEditingFile(null)}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <HiXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Курс</label>
                                <select
                                    value={fileForm.course_id}
                                    onChange={(event) => setFileForm((previous) => ({ ...previous, course_id: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                >
                                    <option value="" className="bg-[#1A1A1C]">Без курса</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id} className="bg-[#1A1A1C]">
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">Задание</label>
                                <select
                                    value={fileForm.task_id}
                                    onChange={(event) => setFileForm((previous) => ({ ...previous, task_id: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                >
                                    <option value="" className="bg-[#1A1A1C]">Без задания</option>
                                    {tasks.map((task) => (
                                        <option key={task.id} value={task.id} className="bg-[#1A1A1C]">
                                            {task.name || `Задание #${task.id}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={fileForm.is_public}
                                    onChange={(event) => setFileForm((previous) => ({ ...previous, is_public: event.target.checked }))}
                                    className="h-4 w-4 rounded border-white/10 bg-white/10 text-purple-600"
                                />
                                Публичный файл
                            </label>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => !savingFile && setEditingFile(null)}
                                disabled={savingFile}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                            >
                                <HiXMark className="h-5 w-5" />
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={saveFile}
                                disabled={savingFile}
                                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingFile ? <HiArrowPath className="h-5 w-5 animate-spin" /> : <HiCheck className="h-5 w-5" />}
                                {savingFile ? 'Сохраняем...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={Boolean(userToDelete)}
                onClose={() => {
                    if (!deletingUser) {
                        setUserToDelete(null);
                    }
                }}
                onConfirm={confirmDeleteUser}
                title="Удалить пользователя?"
                message={`Пользователь ${userToDelete?.name || userToDelete?.email || ''} будет удален из системы.`}
                confirmText={deletingUser ? 'Удаляем...' : 'Удалить'}
                cancelText="Отмена"
            />
            <ConfirmModal
                isOpen={Boolean(memberToRemove)}
                onClose={() => {
                    if (!removingCourseMember) {
                        setMemberToRemove(null);
                    }
                }}
                onConfirm={confirmRemoveCourseMember}
                title="Исключить участника?"
                message={`Пользователь ${memberToRemove?.member?.name || memberToRemove?.member?.email || ''} будет исключен из курса "${memberToRemove?.course?.name || ''}".`}
                confirmText={removingCourseMember ? 'Исключаем...' : 'Исключить'}
                cancelText="Отмена"
            />
            <ConfirmModal
                isOpen={Boolean(entityToDelete)}
                onClose={() => {
                    if (!deletingEntity) {
                        setEntityToDelete(null);
                    }
                }}
                onConfirm={confirmDeleteEntity}
                title={`Удалить ${entityToDelete?.label?.toLowerCase() || 'объект'}?`}
                message={`${entityToDelete?.label || 'Объект'} "${entityToDelete?.item?.name || entityToDelete?.item?.original_name || entityToDelete?.item?.path || ''}" будет удален из системы.`}
                confirmText={deletingEntity ? 'Удаляем...' : 'Удалить'}
                cancelText="Отмена"
            />
        </MainLayout>
    );
};

export default AdminDashboardPage;
