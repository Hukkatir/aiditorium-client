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
    const [userToDelete, setUserToDelete] = useState(null);
    const [deletingUser, setDeletingUser] = useState(false);

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

            if (isSelf && updateResponse.user) {
                updateUser(updateResponse.user);
            }

            showToast('success', 'Пользователь обновлен');
            setEditingUser(null);
            setEditForm({
                name: '',
                email: '',
                password: '',
                role: 'user'
            });
            await loadDashboard({ silent: true });
        } catch (error) {
            console.error(error);
            showToast('error', getApiErrorMessage(error, 'Не удалось обновить пользователя'), 5000);
        } finally {
            setSavingUser(false);
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
                {filteredCourses.map((course) => (
                    <article key={course.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{course.name || 'Курс без названия'}</h3>
                                <p className="mt-1 text-sm text-slate-500">Короткий URL: {course.slug || 'не указан'}</p>
                            </div>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                                {getStatusLabel(course.status)}
                            </span>
                        </div>
                        {course.description && (
                            <p className="mt-3 text-sm leading-6 text-slate-300">{course.description}</p>
                        )}
                        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                            <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-slate-500">Участники</p>
                                <p className="mt-1 font-semibold text-white">{course.users_count ?? course.users?.length ?? 0}</p>
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
                    </article>
                ))}
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
        </MainLayout>
    );
};

export default AdminDashboardPage;
