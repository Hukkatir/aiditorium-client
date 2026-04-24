import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiArrowTopRightOnSquare,
    HiPaperClip,
    HiPencil,
    HiStar,
    HiTrash,
    HiUserCircle,
    HiXMark
} from 'react-icons/hi2';
import CommentThreadList from '../components/comments/CommentThreadList';
import RichTextContent from '../components/editor/RichTextContent';
import FileTileGrid from '../components/files/FileTileGrid';
import ConfirmModal from '../components/layout/ConfirmModal';
import EditTaskModal from '../components/tasks/EditTaskModal';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { commentService } from '../services/commentService';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { fileService } from '../services/fileService';
import { gradeService } from '../services/gradeService';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import { extractCollection } from '../utils/apiUtils';
import { getDisplayFileName, getTaskMaterials } from '../utils/fileUtils';
import { buildDisciplinePath, buildTaskPath, buildTaskSubmissionsPath } from '../utils/routeUtils';

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

const getSubmissionStatus = (deadline, latestSubmission) => {
    const deadlineTimestamp = deadline ? new Date(deadline).getTime() : null;

    if (!latestSubmission) {
        return {
            label: 'Не сдано',
            badgeClassName: deadlineTimestamp && deadlineTimestamp < Date.now()
                ? 'border-red-500/20 bg-red-500/15 text-red-200'
                : 'border-white/10 bg-white/[0.06] text-slate-300',
            hint: deadline ? `Срок сдачи: ${formatDateTime(deadline)}` : 'Работа еще не отправлена'
        };
    }

    const submittedAt = new Date(latestSubmission.created_at).getTime();
    const isLate = deadlineTimestamp && submittedAt > deadlineTimestamp;

    return isLate ? {
        label: 'Сдано с опозданием',
        badgeClassName: 'border-amber-500/20 bg-amber-500/15 text-amber-200',
        hint: `Отправлено ${formatDateTime(latestSubmission.created_at)}`
    } : {
        label: 'Сдано',
        badgeClassName: 'border-emerald-500/20 bg-emerald-500/15 text-emerald-200',
        hint: `Отправлено ${formatDateTime(latestSubmission.created_at)}`
    };
};

const emptyPaginatedResponse = { data: [] };

const TaskDetailPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [creator, setCreator] = useState(null);
    const [course, setCourse] = useState(null);
    const [discipline, setDiscipline] = useState(null);
    const [currentRole, setCurrentRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitFile, setSubmitFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [removingSubmissionId, setRemovingSubmissionId] = useState(null);
    const [ownSubmissions, setOwnSubmissions] = useState([]);
    const [taskComments, setTaskComments] = useState([]);
    const [myGrade, setMyGrade] = useState(null);

    const isTeacher = currentRole === 'teacher';
    const disciplinePath = buildDisciplinePath(
        course || { id: task?.course_id, slug: courseIdOrSlug },
        discipline || { id: task?.discipline_id, slug: disciplineIdOrSlug }
    );

    const ownSubmissionIds = useMemo(
        () => new Set(ownSubmissions.map((submission) => Number(submission.id))),
        [ownSubmissions]
    );

    const publicComments = useMemo(
        () => taskComments.filter((comment) => !comment.parent_id && !comment.file_id),
        [taskComments]
    );

    const privateComments = useMemo(
        () => taskComments.filter((comment) => !comment.parent_id && comment.file_id && ownSubmissionIds.has(Number(comment.file_id))),
        [ownSubmissionIds, taskComments]
    );

    const latestSubmission = ownSubmissions[0] || null;
    const maxTaskScore = Number(task?.scores) || 100;
    const taskMaterials = useMemo(() => getTaskMaterials(task), [task]);
    const submissionStatus = useMemo(
        () => (!isTeacher ? getSubmissionStatus(task?.deadline, latestSubmission) : null),
        [isTeacher, latestSubmission, task?.deadline]
    );

    const loadStudentData = useCallback(async (taskId, courseId, role) => {
        if (role === 'teacher' || !taskId || !courseId) {
            setOwnSubmissions([]);
            setMyGrade(null);
            return;
        }

        try {
            const [filesData, gradesData] = await Promise.all([
                fileService.getMyFiles({ per_page: 100 }).catch((error) => {
                    if (error.response?.status === 404) {
                        return { files: emptyPaginatedResponse };
                    }

                    throw error;
                }),
                gradeService.getMyGrades(courseId, 100).catch((error) => {
                    if (error.response?.status === 404) {
                        return emptyPaginatedResponse;
                    }

                    throw error;
                })
            ]);

            const submissions = extractCollection(filesData, 'files')
                .filter((file) => Number(file.task_id) === Number(taskId) && file.type === 'submission')
                .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

            const grade = extractCollection(gradesData, 'grades')
                .find((item) => Number(item.task_id) === Number(taskId)) || null;

            setOwnSubmissions(submissions);
            setMyGrade(grade);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить отправленные работы');
        }
    }, [showToast]);

    const loadTaskComments = useCallback(async (taskId, courseId, role) => {
        if (!taskId) {
            setTaskComments([]);
            return;
        }

        setCommentsLoading(true);

        try {
            const commentsData = await commentService.getTaskComments(taskId, 100);
            setTaskComments(extractCollection(commentsData));
        } catch (error) {
            if (role !== 'teacher' && courseId) {
                try {
                    const myCommentsData = await commentService.getMyComments(courseId, { per_page: 100 });
                    const ownTaskComments = extractCollection(myCommentsData)
                        .filter((comment) => Number(comment.task_id) === Number(taskId) && !comment.parent_id);

                    const commentsWithReplies = await Promise.all(
                        ownTaskComments.map(async (comment) => {
                            try {
                                const repliesData = await commentService.getReplies(comment.id);
                                return { ...comment, replies: repliesData.replies || [] };
                            } catch {
                                return { ...comment, replies: [] };
                            }
                        })
                    );

                    setTaskComments(commentsWithReplies);
                } catch (fallbackError) {
                    console.error(fallbackError);
                    setTaskComments([]);
                }
            } else if (error.response?.status === 404) {
                setTaskComments([]);
            } else {
                console.error(error);
                showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить комментарии');
                setTaskComments([]);
            }
        } finally {
            setCommentsLoading(false);
        }
    }, [showToast]);

    const fetchTaskPage = useCallback(async () => {
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
            const usersData = await courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] }));
            const users = usersData.users || usersData.data || [];
            const role = getCurrentCourseRole(courseObject, users, user);

            setTask(taskObject);
            setCourse(courseObject);
            setDiscipline(disciplineObject);
            setCurrentRole(role);

            const canonicalPath = buildTaskPath(courseObject, disciplineObject, taskObject);
            if (window.location.pathname !== canonicalPath) {
                navigate(canonicalPath, { replace: true });
            }

            const creatorFromCourse = users.find((item) => Number(item.id) === Number(taskObject.user_id));

            if (taskObject.user) {
                setCreator(taskObject.user);
            } else if (creatorFromCourse) {
                setCreator(creatorFromCourse);
            } else if (taskObject.user_id && taskObject.user_id !== user?.id) {
                try {
                    const userData = await userService.getUser(taskObject.user_id);
                    setCreator(userData.user || userData);
                } catch {
                    setCreator(null);
                }
            } else if (taskObject.user_id === user?.id) {
                setCreator(user);
            } else {
                setCreator(null);
            }

            await Promise.all([
                loadStudentData(taskObject.id, courseObject.id, role),
                loadTaskComments(taskObject.id, courseObject.id, role)
            ]);
        } catch (error) {
            console.error(error);
            setTask(null);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось загрузить задание');
        } finally {
            setLoading(false);
        }
    }, [courseIdOrSlug, disciplineIdOrSlug, loadStudentData, loadTaskComments, navigate, showToast, taskNumber, user]);

    useEffect(() => {
        fetchTaskPage();
    }, [fetchTaskPage]);

    const refreshStudentAndComments = async () => {
        if (!task || !course) {
            return;
        }

        await Promise.all([
            loadStudentData(task.id, course.id, currentRole),
            loadTaskComments(task.id, course.id, currentRole)
        ]);
    };

    const handleDelete = async () => {
        if (!task) {
            return;
        }

        try {
            await taskService.deleteTask(task.id);
            showToast('success', 'Задание удалено');
            navigate(disciplinePath);
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleMaterialDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось скачать файл');
        }
    };

    const handleSubmissionDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось скачать файл');
        }
    };

    const handleSubmitFile = async () => {
        if (!submitFile || !task || !course) {
            showToast('error', 'Выберите файл');
            return;
        }

        setSubmitting(true);

        try {
            await taskService.submitTask(task.id, submitFile);
            showToast('success', 'Работа отправлена');
            setShowSubmitModal(false);
            setSubmitFile(null);
            await refreshStudentAndComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка отправки');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveSubmission = async (file) => {
        if (!task) {
            return;
        }

        setRemovingSubmissionId(file.id);

        try {
            await taskService.unsubmitTask(task.id, file.id);
            showToast('success', 'Файл убран из отправки');
            await refreshStudentAndComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось убрать файл');
        } finally {
            setRemovingSubmissionId(null);
        }
    };

    const handleCreatePublicComment = async (body) => {
        if (!task || !course) {
            return;
        }

        try {
            await commentService.createComment({
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                body
            });

            showToast('success', 'Комментарий отправлен');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить комментарий');
        }
    };

    const handleReplyToPublicComment = async (comment, body) => {
        if (!task || !course) {
            return;
        }

        try {
            await commentService.createComment({
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                parent_id: comment.id,
                body
            });

            showToast('success', 'Ответ отправлен');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить ответ');
        }
    };

    const handleCreatePrivateComment = async (body) => {
        if (!task || !course || !latestSubmission) {
            showToast('error', 'Сначала прикрепите выполненную работу');
            return;
        }

        try {
            await commentService.createComment({
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                file_id: latestSubmission.id,
                body
            });

            showToast('success', 'Личный комментарий отправлен');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить комментарий');
        }
    };

    const handleReplyToPrivateComment = async (comment, body) => {
        if (!task || !course) {
            return;
        }

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
            await loadTaskComments(task.id, course.id, currentRole);
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

    if (!task || !course || !discipline) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Задание не найдено</p>
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="mt-4 inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Вернуться к курсам
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
                    onClick={() => navigate(disciplinePath)}
                    className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                >
                    <HiArrowLeft className="h-5 w-5" />
                    Назад к дисциплине
                </button>

                <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.14),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-4xl">
                            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-purple-200/75">
                                <span>Задание #{task.task_number}</span>
                                {discipline?.name && (
                                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 normal-case tracking-normal text-slate-300">
                                        {discipline.name}
                                    </span>
                                )}
                                {!isTeacher && submissionStatus && (
                                    <span className={`rounded-full border px-3 py-1 normal-case tracking-normal ${submissionStatus.badgeClassName}`}>
                                        {submissionStatus.label}
                                    </span>
                                )}
                            </div>

                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">{task.name}</h1>

                            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                                    Баллы: {!isTeacher && myGrade ? `${myGrade.grade}/${maxTaskScore}` : maxTaskScore}
                                </span>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                                    Материалов: {taskMaterials.length}
                                </span>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                                    Комментариев: {publicComments.length}
                                </span>
                            </div>

                            {task.deadline && (
                                <p className="mt-4 text-sm leading-7 text-slate-400">
                                    Срок сдачи: {formatDateTime(task.deadline)}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {isTeacher && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => navigate(buildTaskSubmissionsPath(course, discipline, task))}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/20 bg-purple-500/12 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/18"
                                    >
                                        <HiArrowTopRightOnSquare className="h-4 w-4" />
                                        Проверка работ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                                    >
                                        <HiPencil className="h-4 w-4" />
                                        Редактировать
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500/12 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/18"
                                    >
                                        <HiTrash className="h-4 w-4" />
                                        Удалить
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]">
                    <div className="space-y-6">
                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h2 className="text-xl font-semibold text-white">Описание задания</h2>
                                {taskMaterials.length > 0 && (
                                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                                        Материалов: {taskMaterials.length}
                                    </span>
                                )}
                            </div>

                            <RichTextContent
                                value={task.description}
                                fallback="Описание пока не заполнено."
                                className="text-slate-300"
                            />
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-white">Материалы</h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    Нажмите на файл, чтобы открыть его на отдельной странице предпросмотра.
                                </p>
                            </div>

                            <FileTileGrid
                                files={taskMaterials}
                                emptyMessage="Преподаватель пока не добавил материалы к этому заданию."
                                onDownload={handleMaterialDownload}
                            />
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                            <div className="border-b border-white/10 pb-4">
                                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Создал</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                        {creator?.avatar_url ? (
                                            <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <HiUserCircle className="h-8 w-8 text-white" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-white">{creator?.name || 'Неизвестно'}</p>
                                        <p className="text-xs text-slate-500">{formatDateTime(task.created_at)}</p>
                                    </div>
                                </div>
                            </div>

                            {!isTeacher && submissionStatus && (
                                <div className="border-b border-white/10 py-4">
                                    <div className="mb-2 text-sm text-slate-400">Статус</div>
                                    <div className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${submissionStatus.badgeClassName}`}>
                                        {submissionStatus.label}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">{submissionStatus.hint}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-slate-400">{!isTeacher && myGrade ? 'Моя оценка' : 'Максимум баллов'}</span>
                                <span className="flex items-center gap-2 font-semibold text-white">
                                    <HiStar className="h-4 w-4 text-yellow-400" />
                                    {!isTeacher && myGrade ? `${myGrade.grade}/${maxTaskScore}` : maxTaskScore}
                                </span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-slate-400">Срок сдачи</span>
                                <span className="text-right text-sm text-white">{task.deadline ? formatDateTime(task.deadline) : 'Не указан'}</span>
                            </div>

                            <div className="flex items-center justify-between py-4">
                                <span className="text-slate-400">Материалов</span>
                                <span className="text-sm font-medium text-white">{taskMaterials.length}</span>
                            </div>
                        </section>

                        {!isTeacher && (
                            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">Сдача работы</h2>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Здесь видны все отправленные версии вашей работы.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowSubmitModal(true)}
                                        className="rounded-2xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                                    >
                                        Прикрепить файл
                                    </button>
                                </div>

                                {myGrade && (
                                    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                        Текущая оценка: <span className="font-semibold">{myGrade.grade}/{maxTaskScore}</span>
                                        {myGrade.graded_at && (
                                            <span className="ml-2 text-emerald-200/70">обновлено {formatDateTime(myGrade.graded_at)}</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4">
                                    <FileTileGrid
                                        files={ownSubmissions}
                                        emptyMessage="Вы еще не отправляли файлы по этому заданию."
                                        onDownload={handleSubmissionDownload}
                                        onRemove={(file) => handleRemoveSubmission(file)}
                                    />
                                </div>

                                {removingSubmissionId && (
                                    <p className="mt-3 text-sm text-slate-500">Убираем выбранный файл из отправки...</p>
                                )}
                            </section>
                        )}

                        {!isTeacher && (
                            latestSubmission ? (
                                <CommentThreadList
                                    title="Личные комментарии"
                                    description="Эти сообщения видны только вам и преподавателю."
                                    comments={privateComments}
                                    currentUserId={user?.id}
                                    onCreate={handleCreatePrivateComment}
                                    onReply={handleReplyToPrivateComment}
                                    emptyMessage="Личная переписка по вашей работе пока не началась."
                                    createPlaceholder="Напишите личный комментарий..."
                                    createLabel="Отправить"
                                    loading={commentsLoading}
                                    variant="private"
                                    scopeLabel="Только вы и преподаватель"
                                    composerMode="toggle"
                                    composerPosition="bottom"
                                    composerTriggerLabel="Добавить личный комментарий"
                                />
                            ) : (
                                <section className="rounded-[28px] border border-dashed border-white/10 px-6 py-10 text-center text-slate-500">
                                    Прикрепите работу, чтобы открыть личные комментарии с преподавателем.
                                </section>
                            )
                        )}
                    </div>
                </div>

                <CommentThreadList
                    title="Комментарии"
                    description="Этот блок виден всем участникам курса."
                    comments={publicComments}
                    currentUserId={user?.id}
                    onCreate={handleCreatePublicComment}
                    onReply={handleReplyToPublicComment}
                    emptyMessage="Пока никто не оставил комментарий по этому заданию."
                    createPlaceholder="Напишите комментарий по заданию..."
                    createLabel="Отправить"
                    loading={commentsLoading}
                    variant="public"
                    scopeLabel="Видно всем"
                    composerMode="toggle"
                    composerPosition="bottom"
                    composerTriggerLabel="Добавить комментарий"
                />
            </div>

            {task && (
                <EditTaskModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        setShowEditModal(false);
                        fetchTaskPage();
                    }}
                    task={task}
                />
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Удаление задания"
                message="Вы уверены? Это действие необратимо."
                confirmText="Удалить"
            />

            {showSubmitModal && (
                <div
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
                    onClick={() => {
                        if (!submitting) {
                            setShowSubmitModal(false);
                            setSubmitFile(null);
                        }
                    }}
                >
                    <div
                        className="mx-auto my-6 w-full max-w-lg rounded-[30px] border border-purple-500/12 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.14),_transparent_32%),rgba(15,17,27,0.98)] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.4)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-semibold text-white">Прикрепить работу</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSubmitModal(false);
                                    setSubmitFile(null);
                                }}
                                className="rounded-2xl p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                            >
                                <HiXMark className="h-6 w-6" />
                            </button>
                        </div>

                        <p className="mt-3 text-sm leading-7 text-slate-400">
                            Файл будет отправлен как новая версия вашей работы.
                        </p>

                        <div className="mt-5 rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] p-5">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/15 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/22">
                                <HiPaperClip className="h-4 w-4" />
                                Выбрать файл
                                <input
                                    type="file"
                                    onChange={(event) => setSubmitFile(event.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>

                            {submitFile ? (
                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                                    <span className="font-medium">{submitFile.name}</span>
                                </div>
                            ) : (
                                <p className="mt-4 text-sm text-slate-500">Файл пока не выбран.</p>
                            )}
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSubmitModal(false);
                                    setSubmitFile(null);
                                }}
                                className="rounded-2xl bg-white/[0.06] px-5 py-3 font-medium text-white transition hover:bg-white/[0.1]"
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitFile}
                                disabled={submitting || !submitFile}
                                className="rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {submitting ? 'Отправляем...' : 'Отправить работу'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default TaskDetailPage;
