import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiArrowTopRightOnSquare,
    HiCalendar,
    HiMagnifyingGlass,
    HiPaperClip,
    HiStar,
    HiUserCircle
} from 'react-icons/hi2';
import CommentThreadList from '../components/comments/CommentThreadList';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { commentService } from '../services/commentService';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { buildTaskPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

const formatDateTime = (dateString) => {
    if (!dateString) {
        return '—';
    }

    return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getDisplayFileName = (file) => {
    if (file?.name) {
        return file.name;
    }

    if (file?.original_name) {
        return file.original_name;
    }

    if (file?.path) {
        const parts = file.path.split('/');
        return parts[parts.length - 1];
    }

    return `Файл #${file?.id ?? ''}`.trim();
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

const emptyPaginatedResponse = { data: [] };

const TaskSubmissionsPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [courseUsers, setCourseUsers] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [taskComments, setTaskComments] = useState([]);
    const [grades, setGrades] = useState([]);
    const [gradeInputs, setGradeInputs] = useState({});
    const [savingGradeFor, setSavingGradeFor] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

    const currentRole = useMemo(
        () => getCurrentCourseRole(course, courseUsers, user),
        [course, courseUsers, user]
    );

    const gradeLimit = useMemo(() => {
        const parsedScores = Number(task?.scores);
        return Number.isFinite(parsedScores) && parsedScores > 0 ? parsedScores : 100;
    }, [task]);

    const groupedSubmissions = useMemo(() => {
        const groups = new Map();
        const sortedSubmissions = [...submissions].sort(
            (left, right) => new Date(right.created_at) - new Date(left.created_at)
        );

        sortedSubmissions.forEach((submission) => {
            const userId = Number(submission.user_id);
            const existingGroup = groups.get(userId);

            if (existingGroup) {
                existingGroup.submissions.push(submission);
                return;
            }

            groups.set(userId, {
                userId,
                user: submission.user,
                latestSubmission: submission,
                submissions: [submission]
            });
        });

        return Array.from(groups.values());
    }, [submissions]);

    const submissionOwners = useMemo(() => {
        const entries = submissions.map((submission) => [Number(submission.id), Number(submission.user_id)]);
        return new Map(entries);
    }, [submissions]);

    const gradesByStudent = useMemo(() => {
        const gradeEntries = grades
            .filter((grade) => Number(grade.task_id) === Number(task?.id))
            .map((grade) => [Number(grade.user_id), grade]);

        return new Map(gradeEntries);
    }, [grades, task]);

    const privateCommentCounts = useMemo(() => {
        const counts = new Map();

        taskComments
            .filter((comment) => !comment.parent_id && comment.file_id)
            .forEach((comment) => {
                const ownerId = submissionOwners.get(Number(comment.file_id));
                if (!ownerId) {
                    return;
                }

                counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
            });

        return counts;
    }, [submissionOwners, taskComments]);

    const filteredGroups = useMemo(() => {
        if (!deferredSearchQuery) {
            return groupedSubmissions;
        }

        return groupedSubmissions.filter((group) => {
            const haystack = [
                group.user?.name,
                group.user?.email,
                ...group.submissions.map((submission) => getDisplayFileName(submission))
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(deferredSearchQuery);
        });
    }, [deferredSearchQuery, groupedSubmissions]);

    const selectedGroup = useMemo(
        () => filteredGroups.find((group) => group.userId === selectedStudentId) || filteredGroups[0] || null,
        [filteredGroups, selectedStudentId]
    );

    const selectedStudentComments = useMemo(() => {
        if (!selectedGroup) {
            return [];
        }

        const fileIds = new Set(selectedGroup.submissions.map((submission) => Number(submission.id)));

        return taskComments.filter((comment) => comment.file_id && !comment.parent_id && fileIds.has(Number(comment.file_id)));
    }, [selectedGroup, taskComments]);

    const selectedStudentGrade = selectedGroup ? gradesByStudent.get(selectedGroup.userId) : null;

    const gradedCount = useMemo(
        () => groupedSubmissions.filter((group) => gradesByStudent.has(group.userId)).length,
        [gradesByStudent, groupedSubmissions]
    );

    const latestSubmittedAt = groupedSubmissions[0]?.latestSubmission?.created_at || null;

    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';

    const isTeacher = currentRole === 'teacher';

    useEffect(() => {
        setGradeInputs((previous) => {
            const next = { ...previous };

            groupedSubmissions.forEach((group) => {
                const existingGrade = gradesByStudent.get(group.userId);
                next[group.userId] = existingGrade ? String(existingGrade.grade) : (previous[group.userId] ?? '');
            });

            return next;
        });
    }, [groupedSubmissions, gradesByStudent]);

    useEffect(() => {
        if (!filteredGroups.length) {
            setSelectedStudentId(null);
            return;
        }

        if (!filteredGroups.some((group) => group.userId === selectedStudentId)) {
            setSelectedStudentId(filteredGroups[0].userId);
        }
    }, [filteredGroups, selectedStudentId]);

    const fetchPageData = useCallback(async () => {
        setLoading(true);

        try {
            const taskData = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
            const taskObject = taskData.task || taskData;

            const [courseData, disciplineData] = await Promise.all([
                courseService.getCourse(taskObject.course_id),
                disciplineService.getDiscipline(taskObject.course_id, taskObject.discipline_id)
            ]);

            const courseObject = courseData.course || courseData;
            const disciplineObject = disciplineData.discipline || disciplineData;

            const [usersData, submissionsData, gradesData, commentsData] = await Promise.all([
                courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] })),
                taskService.getTaskSubmissions(taskObject.id, 100).catch((error) => {
                    if (error.response?.status === 404) {
                        return { submissions: emptyPaginatedResponse };
                    }

                    throw error;
                }),
                gradeService.getCourseGrades(courseObject.id, 100).catch((error) => {
                    if (error.response?.status === 404) {
                        return emptyPaginatedResponse;
                    }

                    throw error;
                }),
                commentService.getTaskComments(taskObject.id, 100).catch((error) => {
                    if (error.response?.status === 404) {
                        return emptyPaginatedResponse;
                    }

                    throw error;
                })
            ]);

            const users = usersData.users || usersData.data || [];
            const role = getCurrentCourseRole(courseObject, users, user);

            if (role !== 'teacher') {
                showToast('error', 'Страница проверки доступна только преподавателю');
                navigate(buildTaskPath(courseObject, disciplineObject, taskObject), { replace: true });
                return;
            }

            setTask(taskObject);
            setCourse(courseObject);
            setDiscipline(disciplineObject);
            setCourseUsers(users);
            setSubmissions(extractCollection(submissionsData, 'submissions'));
            setGrades(extractCollection(gradesData, 'grades'));
            setTaskComments(extractCollection(commentsData));

            const canonicalPath = buildTaskSubmissionsPath(courseObject, disciplineObject, taskObject);
            if (window.location.pathname !== canonicalPath) {
                navigate(canonicalPath, { replace: true });
            }
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить сданные работы');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, navigate, showToast, taskNumber, user]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    const handleOpen = async (file) => {
        try {
            await fileService.openFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось открыть файл');
        }
    };

    const handleDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось скачать файл');
        }
    };

    const handleSaveGrade = async (group) => {
        const rawValue = gradeInputs[group.userId]?.trim();

        if (!rawValue) {
            showToast('error', 'Введите оценку');
            return;
        }

        const numericGrade = Number(rawValue);
        if (!Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > gradeLimit) {
            showToast('error', 'Оценка должна быть числом от 0 до 100');
            return;
        }

        setSavingGradeFor(group.userId);

        try {
            const existingGrade = gradesByStudent.get(group.userId);

            if (existingGrade) {
                await gradeService.updateGrade(existingGrade.id, { grade: numericGrade });
            } else {
                await gradeService.createGrade({
                    user_id: group.userId,
                    course_id: course.id,
                    task_id: task.id,
                    discipline_id: discipline?.id,
                    file_id: group.latestSubmission.id,
                    grade: numericGrade
                });
            }

            showToast('success', `Оценка для ${group.user?.name || 'студента'} сохранена`);
            await fetchPageData();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось сохранить оценку');
        } finally {
            setSavingGradeFor(null);
        }
    };

    const handleCreatePrivateComment = async (group, body) => {
        try {
            await commentService.createComment({
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                file_id: group.latestSubmission.id,
                body
            });

            showToast('success', 'Личный комментарий отправлен');
            await fetchPageData();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить комментарий');
        }
    };

    const handleReplyToPrivateComment = async (comment, body) => {
        try {
            await commentService.createComment({
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                file_id: comment.file_id,
                parent_id: comment.id,
                body
            });

            showToast('success', 'Ответ отправлен');
            await fetchPageData();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить ответ');
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

    if (!task || !course || !discipline || !isTeacher) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Страница проверки недоступна</p>
                    <button
                        type="button"
                        onClick={() => navigate(taskPath)}
                        className="mt-4 inline-flex items-center gap-2 text-purple-400 transition hover:text-purple-300"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Вернуться к заданию
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-7xl space-y-6">
                <button
                    type="button"
                    onClick={() => navigate(taskPath)}
                    className="inline-flex items-center gap-2 text-purple-400 transition hover:text-purple-300"
                >
                    <HiArrowLeft className="h-5 w-5" />
                    Назад к заданию
                </button>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-purple-300/70">Проверка работ</p>
                            <h1 className="mt-2 text-3xl font-bold text-white">{task.name}</h1>
                            <p className="mt-2 max-w-3xl text-gray-400">{task.description || 'Описание задания не заполнено.'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                                <HiCalendar className="h-4 w-4 text-gray-500" />
                                <span>Срок сдачи: {task.deadline ? formatDateTime(task.deadline) : 'не указан'}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <HiStar className="h-4 w-4 text-yellow-400" />
                                <span>Максимум: {task.scores ?? 0} баллов</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                                Студентов с работами: {groupedSubmissions.length}
                            </div>
                        </div>
                    </div>
                </div>

                {groupedSubmissions.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center text-gray-500">
                        Пока никто не сдал работу по этому заданию.
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[360px,minmax(0,1fr)] xl:grid-cols-[380px,minmax(0,1fr)]">
                        <section className="self-start rounded-[32px] border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-6">
                            <h2 className="mb-4 text-lg font-semibold text-white">Студенты</h2>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <label className="flex items-center gap-3 text-sm text-slate-300" htmlFor="student-search">
                                    <HiMagnifyingGlass className="h-4 w-4 text-slate-500" />
                                    <input
                                        id="student-search"
                                        type="text"
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Поиск по имени, почте или файлу"
                                        className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                                    />
                                </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">Сдано: {groupedSubmissions.length}</span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">Без оценки: {groupedSubmissions.length - gradedCount}</span>
                                {latestSubmittedAt && (
                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        Последняя сдача: {formatDateTime(latestSubmittedAt)}
                                    </span>
                                )}
                            </div>

                            <div className="mt-5 space-y-3">
                                {filteredGroups.length === 0 && (
                                    <div className="rounded-3xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                                        По этому запросу ничего не найдено.
                                    </div>
                                )}
                                {filteredGroups.map((group) => {
                                    const grade = gradesByStudent.get(group.userId);
                                    const isActive = selectedGroup?.userId === group.userId;
                                    const privateCommentsCount = privateCommentCounts.get(group.userId) || 0;

                                    return (
                                        <button
                                            key={group.userId}
                                            type="button"
                                            onClick={() => {
                                                startTransition(() => {
                                                    setSelectedStudentId(group.userId);
                                                });
                                            }}
                                            className={`w-full rounded-[28px] border p-4 text-left transition ${isActive ? 'border-sky-400/40 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-white">{group.user?.name || 'Студент'}</p>
                                                    <p className="truncate text-sm text-gray-400">{group.user?.email || 'Почта не указана'}</p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${grade ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                                    {grade ? `${grade.grade}/${gradeLimit}` : 'Без оценки'}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                                                    Файлов: {group.submissions.length}
                                                </span>
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-gray-300">
                                                    Последняя: {formatDateTime(group.latestSubmission.created_at)}
                                                </span>
                                                {grade && (
                                                    <span className="rounded-full bg-green-500/15 px-2 py-1 text-green-300">
                                                        Оценка: {grade.grade}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-3 text-xs text-slate-500">
                                                Комментариев: {privateCommentsCount}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {selectedGroup && (
                            <div className="space-y-5">
                                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                                {selectedGroup.user?.avatar_url ? (
                                                    <img src={selectedGroup.user.avatar_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <HiUserCircle className="h-9 w-9 text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-semibold text-white">{selectedGroup.user?.name || 'Студент'}</h2>
                                                <p className="text-gray-400">{selectedGroup.user?.email || 'Почта не указана'}</p>
                                                <p className="mt-2 text-sm text-gray-500">
                                                    Последняя версия загружена {formatDateTime(selectedGroup.latestSubmission.created_at)}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                    <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
                                                        Версий: {selectedGroup.submissions.length}
                                                    </span>
                                                    <span className="rounded-full bg-white/10 px-3 py-1 text-slate-300">
                                                        Комментариев: {privateCommentCounts.get(selectedGroup.userId) || 0}
                                                    </span>
                                                    {selectedStudentGrade && (
                                                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">
                                                            Оценка: {selectedStudentGrade.grade}/{gradeLimit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <label className="block text-sm font-medium text-gray-300" htmlFor={`grade-${selectedGroup.userId}`}>
                                                Оценка за задание
                                            </label>
                                            <div className="mt-3 flex gap-3">
                                                <input
                                                    id={`grade-${selectedGroup.userId}`}
                                                    type="number"
                                                    min="0"
                                                    max={gradeLimit}
                                                    value={gradeInputs[selectedGroup.userId] ?? ''}
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value;
                                                        setGradeInputs((previous) => ({
                                                            ...previous,
                                                            [selectedGroup.userId]: nextValue
                                                        }));
                                                    }}
                                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveGrade(selectedGroup)}
                                                    disabled={savingGradeFor === selectedGroup.userId}
                                                    className="rounded-xl bg-purple-600 px-4 py-3 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                                                >
                                                    {savingGradeFor === selectedGroup.userId ? '...' : 'Сохранить'}
                                                </button>
                                            </div>
                                            {gradesByStudent.get(selectedGroup.userId) && (
                                                <p className="mt-3 text-sm text-gray-400">
                                                    Текущая оценка: <span className="text-white">{gradesByStudent.get(selectedGroup.userId).grade}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <h2 className="text-xl font-semibold text-white">Файлы студента</h2>
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-gray-300">
                                            {selectedGroup.submissions.length} версий
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {selectedGroup.submissions.map((submission, index) => (
                                            <div key={submission.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <HiPaperClip className="h-4 w-4 text-purple-300" />
                                                            <span className="font-medium text-white">{getDisplayFileName(submission)}</span>
                                                            {index === 0 && (
                                                                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">
                                                                    Последняя версия
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-500">Загружено {formatDateTime(submission.created_at)}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpen(submission)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                                                    >
                                                        <HiArrowTopRightOnSquare className="h-4 w-4" />
                                                        Открыть
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownload(submission)}
                                                        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                                                    >
                                                        Скачать
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <CommentThreadList
                                    title="Личные комментарии"
                                    description="Эта ветка видна только этому студенту и преподавателям курса."
                                    comments={selectedStudentComments}
                                    currentUserId={user?.id}
                                    onCreate={(body) => handleCreatePrivateComment(selectedGroup, body)}
                                    onReply={handleReplyToPrivateComment}
                                    emptyMessage="Личная переписка по этой работе пока не началась."
                                    createPlaceholder="Напишите комментарий студенту..."
                                    createLabel="Отправить комментарий"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default TaskSubmissionsPage;
