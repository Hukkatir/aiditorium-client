import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiCalendar,
    HiPaperClip,
    HiPencil,
    HiStar,
    HiTrash,
    HiUserCircle,
    HiXMark
} from 'react-icons/hi2';
import CommentThreadList from '../components/comments/CommentThreadList';
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

const getDisplayFileName = (file) => {
    if (file?.name) return file.name;
    if (file?.original_name) return file.original_name;
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
    const canManage = isTeacher;

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
        [taskComments, ownSubmissionIds]
    );

    const latestSubmission = ownSubmissions[0] || null;

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
    }, [courseIdOrSlug, disciplineIdOrSlug, taskNumber, loadStudentData, loadTaskComments, navigate, showToast, user]);

    useEffect(() => {
        fetchTaskPage();
    }, [fetchTaskPage]);

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

    const handleTaskAttachmentDownload = async () => {
        if (!task?.attachment_id) {
            return;
        }

        try {
            await fileService.downloadFile(task.attachment_id, `${task.name || 'task'}-attachment`);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось скачать вложение');
        }
    };

    const handleSubmissionDownload = async (submission) => {
        try {
            await fileService.downloadFile(submission.id, getDisplayFileName(submission));
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось скачать файл');
        }
    };

    const refreshStudentAndComments = async () => {
        if (!task || !course) {
            return;
        }

        await Promise.all([
            loadStudentData(task.id, course.id, currentRole),
            loadTaskComments(task.id, course.id, currentRole)
        ]);
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

    const handleRemoveSubmission = async (submission) => {
        if (!task) {
            return;
        }

        setRemovingSubmissionId(submission.id);

        try {
            await taskService.unsubmitTask(task.id, submission.id);
            showToast('success', 'Файл удалён из отправки');
            await refreshStudentAndComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось удалить файл');
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
            showToast('error', 'Сначала прикрепите файл с выполненным заданием');
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
        if (!task || !course || !comment.file_id) {
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

    if (!task) {
        return (
            <MainLayout>
                <div className="py-20 text-center">
                    <p className="text-xl text-gray-400">Задание не найдено</p>
                    <button
                        type="button"
                        onClick={() => navigate(disciplinePath)}
                        className="mt-4 inline-flex items-center gap-2 text-purple-400 transition hover:text-purple-300"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Назад
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => navigate(disciplinePath)} className="text-purple-400 transition hover:text-purple-300">
                            <HiArrowLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{task.name}</h1>
                            <p className="mt-1 text-sm text-gray-400">Дисциплина: {discipline?.name || '—'}</p>
                        </div>
                    </div>

                    {canManage && (
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(buildTaskSubmissionsPath(course, discipline, task))}
                                className="rounded-xl bg-blue-600/20 px-4 py-2 font-medium text-blue-200 transition hover:bg-blue-600/30"
                            >
                                Проверить работы
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(true)}
                                className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20"
                            >
                                <HiPencil className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="rounded-xl bg-red-600/20 p-2 text-red-300 transition hover:bg-red-600/30"
                            >
                                <HiTrash className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),360px]">
                    <div className="space-y-6">
                        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                            <h2 className="text-xl font-semibold text-white">Описание задания</h2>
                            <p className="mt-4 whitespace-pre-wrap leading-7 text-gray-300">
                                {task.description || 'Описание пока не заполнено.'}
                            </p>
                        </section>

                        <CommentThreadList
                            title="Общие комментарии"
                            description="Эта ветка видна всем участникам курса. Здесь можно задавать общие вопросы по заданию."
                            comments={publicComments}
                            currentUserId={user?.id}
                            onCreate={handleCreatePublicComment}
                            onReply={handleReplyToPublicComment}
                            emptyMessage="Обсуждение задания пока не началось."
                            createPlaceholder="Напишите общий комментарий по заданию..."
                            createLabel="Отправить комментарий"
                            loading={commentsLoading}
                        />

                        {!isTeacher && (
                            latestSubmission ? (
                                <CommentThreadList
                                    title="Личные комментарии"
                                    description="Эта ветка видна только вам и преподавателям курса. Новое сообщение привяжется к последней загруженной версии работы."
                                    comments={privateComments}
                                    currentUserId={user?.id}
                                    onCreate={handleCreatePrivateComment}
                                    onReply={handleReplyToPrivateComment}
                                    emptyMessage="Личная переписка по вашему файлу пока не началась."
                                    createPlaceholder="Напишите личный комментарий для преподавателя..."
                                    createLabel="Отправить лично"
                                    loading={commentsLoading}
                                />
                            ) : (
                                <section className="rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center text-gray-500">
                                    Прикрепите файл с выполненным заданием, чтобы открыть личные комментарии с преподавателем.
                                </section>
                            )
                        )}
                    </div>

                    <div className="space-y-4">
                        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                            <div className="border-b border-white/10 pb-4">
                                <div className="mb-2 text-sm text-gray-400">Создано</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                        {creator?.avatar_url ? (
                                            <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <HiUserCircle className="h-8 w-8 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{creator?.name || 'Неизвестно'}</p>
                                        <p className="text-xs text-gray-500">{formatDateTime(task.created_at)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-gray-400">Баллы</span>
                                <span className="flex items-center gap-2 font-semibold text-white">
                                    <HiStar className="h-4 w-4 text-yellow-400" />
                                    {task.scores ?? 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-gray-400">Срок сдачи</span>
                                <span className="text-right text-sm text-white">{task.deadline ? formatDateTime(task.deadline) : 'Не указан'}</span>
                            </div>

                            {task.attachment_id && (
                                <div className="pt-4">
                                    <div className="mb-2 text-sm text-gray-400">Материалы задания</div>
                                    <button
                                        type="button"
                                        onClick={handleTaskAttachmentDownload}
                                        className="inline-flex items-center gap-2 text-left text-sm text-purple-300 transition hover:text-purple-200"
                                    >
                                        <HiPaperClip className="h-4 w-4" />
                                        Скачать вложение
                                    </button>
                                </div>
                            )}
                        </section>

                        {!isTeacher && (
                            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">Мои отправки</h2>
                                        <p className="mt-1 text-sm text-gray-400">Здесь можно прикрепить файл с выполненным заданием.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowSubmitModal(true)}
                                        className="rounded-xl bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700"
                                    >
                                        Прикрепить файл
                                    </button>
                                </div>

                                {myGrade && (
                                    <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                                        Текущая оценка: <span className="font-semibold">{myGrade.grade}</span>
                                        {myGrade.graded_at && (
                                            <span className="ml-2 text-green-200/70">обновлено {formatDateTime(myGrade.graded_at)}</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 space-y-3">
                                    {ownSubmissions.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">
                                            Вы ещё не прикрепляли файлы к этому заданию.
                                        </div>
                                    ) : (
                                        ownSubmissions.map((submission) => (
                                            <div key={submission.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 text-white">
                                                            <HiPaperClip className="h-4 w-4 text-purple-300" />
                                                            <span className="font-medium">{getDisplayFileName(submission)}</span>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                                            <HiCalendar className="h-3.5 w-3.5" />
                                                            {formatDateTime(submission.created_at)}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSubmissionDownload(submission)}
                                                            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                                                        >
                                                            Скачать
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSubmission(submission)}
                                                            disabled={removingSubmissionId === submission.id}
                                                            className="rounded-xl bg-red-600/20 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-600/30 disabled:opacity-50"
                                                        >
                                                            {removingSubmissionId === submission.id ? 'Удаляем...' : 'Убрать'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1A1C] p-6">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold text-white">Прикрепить файл</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSubmitModal(false);
                                    setSubmitFile(null);
                                }}
                                className="text-gray-400 transition hover:text-white"
                            >
                                <HiXMark className="h-6 w-6" />
                            </button>
                        </div>

                        <p className="mt-3 text-sm text-gray-400">
                            Файл будет прикреплён к заданию и появится у преподавателя на странице проверки работ.
                        </p>

                        <div className="mt-5">
                            <input
                                type="file"
                                onChange={(event) => setSubmitFile(event.target.files?.[0] || null)}
                                className="w-full text-white file:mr-4 file:rounded-xl file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-white hover:file:bg-purple-700"
                            />
                            {submitFile && <p className="mt-2 text-sm text-gray-400">Выбран файл: {submitFile.name}</p>}
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                type="button"
                                onClick={handleSubmitFile}
                                disabled={submitting || !submitFile}
                                className="flex-1 rounded-xl bg-purple-600 py-3 font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
                            >
                                {submitting ? 'Отправка...' : 'Отправить'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSubmitModal(false);
                                    setSubmitFile(null);
                                }}
                                className="flex-1 rounded-xl bg-white/10 py-3 font-bold text-white transition hover:bg-white/20"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default TaskDetailPage;
