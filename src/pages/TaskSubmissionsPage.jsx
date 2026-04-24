import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiCalendar,
    HiMagnifyingGlass,
    HiStar,
    HiUserCircle
} from 'react-icons/hi2';
import CommentThreadList from '../components/comments/CommentThreadList';
import RichTextContent from '../components/editor/RichTextContent';
import FileTileGrid from '../components/files/FileTileGrid';
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
import { getDisplayFileName, getTaskMaterials } from '../utils/fileUtils';
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

    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';

    const isTeacher = currentRole === 'teacher';
    const gradeLimit = useMemo(() => {
        const parsedScores = Number(task?.scores);
        return Number.isFinite(parsedScores) && parsedScores > 0 ? parsedScores : 100;
    }, [task]);
    const taskMaterials = useMemo(() => getTaskMaterials(task), [task]);

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

    useEffect(() => {
        setGradeInputs((previous) => {
            const next = { ...previous };

            groupedSubmissions.forEach((group) => {
                const existingGrade = gradesByStudent.get(group.userId);
                next[group.userId] = existingGrade ? String(existingGrade.grade) : (previous[group.userId] ?? '');
            });

            return next;
        });
    }, [gradesByStudent, groupedSubmissions]);

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

    const handleDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
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
            showToast('error', `Оценка должна быть числом от 0 до ${gradeLimit}`);
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
                        className="mt-4 inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
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
                    className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                >
                    <HiArrowLeft className="h-5 w-5" />
                    Назад к заданию
                </button>

                <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-4xl">
                            <div className="text-xs uppercase tracking-[0.24em] text-purple-200/70">
                                Проверка работ • Задание #{task.task_number}
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">{task.name}</h1>
                            <div className="mt-4 max-w-3xl">
                                <RichTextContent
                                    value={task.description}
                                    fallback="Описание задания не заполнено."
                                    className="text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                            <div className="flex items-center gap-2">
                                <HiCalendar className="h-4 w-4 text-slate-500" />
                                <span>Срок сдачи: {task.deadline ? formatDateTime(task.deadline) : 'не указан'}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <HiStar className="h-4 w-4 text-yellow-400" />
                                <span>Максимум: {gradeLimit} баллов</span>
                            </div>
                            <div className="mt-3 text-xs text-slate-500">
                                Студентов с работами: {groupedSubmissions.length}
                            </div>
                        </div>
                    </div>
                </section>

                {groupedSubmissions.length === 0 ? (
                    <div className="rounded-[30px] border border-dashed border-white/10 px-6 py-16 text-center text-slate-500">
                        Пока никто не сдал работу по этому заданию.
                    </div>
                ) : (
                    <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
                        <section className="self-start rounded-[30px] border border-white/10 bg-white/[0.02] p-5 xl:sticky xl:top-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold text-white">Студенты</h2>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                                    {groupedSubmissions.length}
                                </span>
                            </div>

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
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">Проверено: {gradedCount}</span>
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
                                    const commentsCount = privateCommentCounts.get(group.userId) || 0;

                                    return (
                                        <button
                                            key={group.userId}
                                            type="button"
                                            onClick={() => {
                                                startTransition(() => {
                                                    setSelectedStudentId(group.userId);
                                                });
                                            }}
                                            className={`w-full rounded-[26px] border p-4 text-left transition ${
                                                isActive
                                                    ? 'border-purple-400/35 bg-purple-500/[0.08] shadow-[0_0_0_1px_rgba(168,85,247,0.18)]'
                                                    : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-white">{group.user?.name || 'Студент'}</p>
                                                    <p className="truncate text-sm text-slate-400">{group.user?.email || 'Почта не указана'}</p>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${grade ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>
                                                    {grade ? `${grade.grade}/${gradeLimit}` : 'Без оценки'}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                                                    Версий: {group.submissions.length}
                                                </span>
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                                                    Комментариев: {commentsCount}
                                                </span>
                                            </div>

                                            <p className="mt-3 text-xs text-slate-500">
                                                Последняя сдача: {formatDateTime(group.latestSubmission.created_at)}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {selectedGroup && (
                            <div className="space-y-6">
                                <section className="rounded-[30px] border border-white/10 bg-white/[0.02] p-6">
                                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                                {selectedGroup.user?.avatar_url ? (
                                                    <img src={selectedGroup.user.avatar_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <HiUserCircle className="h-10 w-10 text-white" />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <h2 className="text-2xl font-semibold text-white">{selectedGroup.user?.name || 'Студент'}</h2>
                                                <p className="text-slate-400">{selectedGroup.user?.email || 'Почта не указана'}</p>
                                                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                                        Последняя версия: {formatDateTime(selectedGroup.latestSubmission.created_at)}
                                                    </span>
                                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                                        Всего версий: {selectedGroup.submissions.length}
                                                    </span>
                                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                                        Личных комментариев: {privateCommentCounts.get(selectedGroup.userId) || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
                                            <label className="block text-sm font-medium text-slate-300" htmlFor={`grade-${selectedGroup.userId}`}>
                                                Оценка за задание
                                            </label>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Введите балл от 0 до {gradeLimit}. Если оценка уже была, она обновится.
                                            </p>

                                            <div className="mt-4 flex gap-3">
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
                                                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveGrade(selectedGroup)}
                                                    disabled={savingGradeFor === selectedGroup.userId}
                                                    className="rounded-2xl bg-purple-600 px-4 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                                                >
                                                    {savingGradeFor === selectedGroup.userId ? '...' : 'Сохранить'}
                                                </button>
                                            </div>

                                            {selectedStudentGrade && (
                                                <p className="mt-3 text-sm text-slate-400">
                                                    Текущая оценка: <span className="text-white">{selectedStudentGrade.grade}/{gradeLimit}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {taskMaterials.length > 0 && (
                                    <section className="rounded-[30px] border border-white/10 bg-white/[0.02] p-6">
                                        <div className="mb-4">
                                            <h2 className="text-xl font-semibold text-white">Материалы задания</h2>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Здесь преподаватель видит те же материалы, которые были прикреплены к заданию.
                                            </p>
                                        </div>

                                        <FileTileGrid
                                            files={taskMaterials}
                                            emptyMessage="Материалы задания не добавлены."
                                            onDownload={handleDownload}
                                        />
                                    </section>
                                )}

                                <section className="rounded-[30px] border border-white/10 bg-white/[0.02] p-6">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-xl font-semibold text-white">Версии работы</h2>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Каждая версия открывается на отдельной странице предпросмотра. Последняя отправка уже наверху.
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">
                                            {selectedGroup.submissions.length} версий
                                        </span>
                                    </div>

                                    <FileTileGrid
                                        files={selectedGroup.submissions}
                                        emptyMessage="Студент еще не прикреплял файлы."
                                        onDownload={handleDownload}
                                    />
                                </section>

                                <CommentThreadList
                                    title="Личная переписка"
                                    description="Эта ветка видна только выбранному студенту и преподавателю."
                                    comments={selectedStudentComments}
                                    currentUserId={user?.id}
                                    onCreate={(body) => handleCreatePrivateComment(selectedGroup, body)}
                                    onReply={handleReplyToPrivateComment}
                                    emptyMessage="Личная переписка по этой работе пока не началась."
                                    createPlaceholder="Напишите комментарий студенту..."
                                    createLabel="Отправить комментарий"
                                    variant="private"
                                    scopeLabel="Только преподаватель и студент"
                                    composerMode="toggle"
                                    composerPosition="bottom"
                                    composerTriggerLabel="Добавить комментарий"
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
