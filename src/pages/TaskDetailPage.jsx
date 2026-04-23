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
        return 'вЂ”';
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
            label: 'РќРµ СЃРґР°РЅРѕ',
            badgeClassName: deadlineTimestamp && deadlineTimestamp < Date.now()
                ? 'border-red-500/20 bg-red-500/15 text-red-200'
                : 'border-white/10 bg-white/[0.06] text-slate-300',
            hint: deadline ? `РЎСЂРѕРє СЃРґР°С‡Рё: ${formatDateTime(deadline)}` : 'Р Р°Р±РѕС‚Р° РµС‰С‘ РЅРµ РѕС‚РїСЂР°РІР»РµРЅР°'
        };
    }

    const submittedAt = new Date(latestSubmission.created_at).getTime();
    const isLate = deadlineTimestamp && submittedAt > deadlineTimestamp;

    return isLate ? {
        label: 'РЎРґР°РЅРѕ СЃ РѕРїРѕР·РґР°РЅРёРµРј',
        badgeClassName: 'border-amber-500/20 bg-amber-500/15 text-amber-200',
        hint: `РћС‚РїСЂР°РІР»РµРЅРѕ ${formatDateTime(latestSubmission.created_at)}`
    } : {
        label: 'РЎРґР°РЅРѕ',
        badgeClassName: 'border-emerald-500/20 bg-emerald-500/15 text-emerald-200',
        hint: `РћС‚РїСЂР°РІР»РµРЅРѕ ${formatDateTime(latestSubmission.created_at)}`
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
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РѕС‚РїСЂР°РІР»РµРЅРЅС‹Рµ СЂР°Р±РѕС‚С‹');
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
                showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёРё');
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
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°РґР°РЅРёРµ');
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
            showToast('success', 'Р—Р°РґР°РЅРёРµ СѓРґР°Р»РµРЅРѕ');
            navigate(disciplinePath);
        } catch (error) {
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleMaterialDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С„Р°Р№Р»');
        }
    };

    const handleSubmissionDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРєР°С‡Р°С‚СЊ С„Р°Р№Р»');
        }
    };

    const handleSubmitFile = async () => {
        if (!submitFile || !task || !course) {
            showToast('error', 'Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р»');
            return;
        }

        setSubmitting(true);

        try {
            await taskService.submitTask(task.id, submitFile);
            showToast('success', 'Р Р°Р±РѕС‚Р° РѕС‚РїСЂР°РІР»РµРЅР°');
            setShowSubmitModal(false);
            setSubmitFile(null);
            await refreshStudentAndComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё');
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
            showToast('success', 'Р¤Р°Р№Р» СѓР±СЂР°РЅ РёР· РѕС‚РїСЂР°РІРєРё');
            await refreshStudentAndComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓР±СЂР°С‚СЊ С„Р°Р№Р»');
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

            showToast('success', 'РљРѕРјРјРµРЅС‚Р°СЂРёР№ РѕС‚РїСЂР°РІР»РµРЅ');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№');
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

            showToast('success', 'РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РѕС‚РІРµС‚');
        }
    };

    const handleCreatePrivateComment = async (body) => {
        if (!task || !course || !latestSubmission) {
            showToast('error', 'РЎРЅР°С‡Р°Р»Р° РїСЂРёРєСЂРµРїРёС‚Рµ РІС‹РїРѕР»РЅРµРЅРЅСѓСЋ СЂР°Р±РѕС‚Сѓ');
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

            showToast('success', 'Р›РёС‡РЅС‹Р№ РєРѕРјРјРµРЅС‚Р°СЂРёР№ РѕС‚РїСЂР°РІР»РµРЅ');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№');
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

            showToast('success', 'РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ');
            await loadTaskComments(task.id, course.id, currentRole);
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РѕС‚РІРµС‚');
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
                    <p className="text-xl text-gray-400">Р—Р°РґР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ</p>
                    <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="mt-4 inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
                    >
                        <HiArrowLeft className="h-5 w-5" />
                        Р’РµСЂРЅСѓС‚СЊСЃСЏ Рє РєСѓСЂСЃР°Рј
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
                    РќР°Р·Р°Рґ Рє РґРёСЃС†РёРїР»РёРЅРµ
                </button>

                <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.14),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-4xl">
                            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-purple-200/75">
                                <span>Р—Р°РґР°РЅРёРµ #{task.task_number}</span>
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
                                    Р‘Р°Р»Р»С‹: {!isTeacher && myGrade ? `${myGrade.grade}/${maxTaskScore}` : maxTaskScore}
                                </span>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                                    РњР°С‚РµСЂРёР°Р»РѕРІ: {taskMaterials.length}
                                </span>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1.5">
                                    РљРѕРјРјРµРЅС‚Р°СЂРёРµРІ: {publicComments.length}
                                </span>
                            </div>

                            {task.deadline && (
                                <p className="mt-4 text-sm leading-7 text-slate-400">
                                    РЎСЂРѕРє СЃРґР°С‡Рё: {formatDateTime(task.deadline)}
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
                                        РџСЂРѕРІРµСЂРєР° СЂР°Р±РѕС‚
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                                    >
                                        <HiPencil className="h-4 w-4" />
                                        Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500/12 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/18"
                                    >
                                        <HiTrash className="h-4 w-4" />
                                        РЈРґР°Р»РёС‚СЊ
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
                                <h2 className="text-xl font-semibold text-white">РћРїРёСЃР°РЅРёРµ Р·Р°РґР°РЅРёСЏ</h2>
                                {taskMaterials.length > 0 && (
                                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                                        РњР°С‚РµСЂРёР°Р»РѕРІ: {taskMaterials.length}
                                    </span>
                                )}
                            </div>

                            <RichTextContent
                                value={task.description}
                                fallback="РћРїРёСЃР°РЅРёРµ РїРѕРєР° РЅРµ Р·Р°РїРѕР»РЅРµРЅРѕ."
                                className="text-slate-300"
                            />
                        </section>

                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-white">РњР°С‚РµСЂРёР°Р»С‹</h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    РџСЂРё РЅР°Р¶Р°С‚РёРё С„Р°Р№Р» РѕС‚РєСЂРѕРµС‚СЃСЏ РЅР° РѕС‚РґРµР»СЊРЅРѕР№ СЃС‚СЂР°РЅРёС†Рµ РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂР°.
                                </p>
                            </div>

                            <FileTileGrid
                                files={taskMaterials}
                                emptyMessage="РџСЂРµРїРѕРґР°РІР°С‚РµР»СЊ РїРѕРєР° РЅРµ РґРѕР±Р°РІРёР» РјР°С‚РµСЂРёР°Р»С‹ Рє СЌС‚РѕРјСѓ Р·Р°РґР°РЅРёСЋ."
                                onDownload={handleMaterialDownload}
                            />
                        </section>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                            <div className="border-b border-white/10 pb-4">
                                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">РЎРѕР·РґР°Р»</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600">
                                        {creator?.avatar_url ? (
                                            <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <HiUserCircle className="h-8 w-8 text-white" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-white">{creator?.name || 'РќРµРёР·РІРµСЃС‚РЅРѕ'}</p>
                                        <p className="text-xs text-slate-500">{formatDateTime(task.created_at)}</p>
                                    </div>
                                </div>
                            </div>

                            {!isTeacher && submissionStatus && (
                                <div className="border-b border-white/10 py-4">
                                    <div className="mb-2 text-sm text-slate-400">РЎС‚Р°С‚СѓСЃ</div>
                                    <div className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${submissionStatus.badgeClassName}`}>
                                        {submissionStatus.label}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">{submissionStatus.hint}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-slate-400">{!isTeacher && myGrade ? 'РњРѕСЏ РѕС†РµРЅРєР°' : 'РњР°РєСЃРёРјСѓРј Р±Р°Р»Р»РѕРІ'}</span>
                                <span className="flex items-center gap-2 font-semibold text-white">
                                    <HiStar className="h-4 w-4 text-yellow-400" />
                                    {!isTeacher && myGrade ? `${myGrade.grade}/${maxTaskScore}` : maxTaskScore}
                                </span>
                            </div>

                            <div className="flex items-center justify-between border-b border-white/10 py-4">
                                <span className="text-slate-400">РЎСЂРѕРє СЃРґР°С‡Рё</span>
                                <span className="text-right text-sm text-white">{task.deadline ? formatDateTime(task.deadline) : 'РќРµ СѓРєР°Р·Р°РЅ'}</span>
                            </div>

                            <div className="flex items-center justify-between py-4">
                                <span className="text-slate-400">РњР°С‚РµСЂРёР°Р»РѕРІ</span>
                                <span className="text-sm font-medium text-white">{taskMaterials.length}</span>
                            </div>
                        </section>

                        {!isTeacher && (
                            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">РЎРґР°С‡Р° СЂР°Р±РѕС‚С‹</h2>
                                        <p className="mt-2 text-sm text-slate-500">
                                            Р—РґРµСЃСЊ РІРёРґРЅС‹ РІСЃРµ РІР°С€Рё РѕС‚РїСЂР°РІР»РµРЅРЅС‹Рµ РІРµСЂСЃРёРё.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowSubmitModal(true)}
                                        className="rounded-2xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                                    >
                                        РџСЂРёРєСЂРµРїРёС‚СЊ С„Р°Р№Р»
                                    </button>
                                </div>

                                {myGrade && (
                                    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                        РўРµРєСѓС‰Р°СЏ РѕС†РµРЅРєР°: <span className="font-semibold">{myGrade.grade}/{maxTaskScore}</span>
                                        {myGrade.graded_at && (
                                            <span className="ml-2 text-emerald-200/70">РѕР±РЅРѕРІР»РµРЅРѕ {formatDateTime(myGrade.graded_at)}</span>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4">
                                    <FileTileGrid
                                        files={ownSubmissions}
                                        emptyMessage="Р’С‹ РµС‰Рµ РЅРµ РѕС‚РїСЂР°РІР»СЏР»Рё С„Р°Р№Р»С‹ РїРѕ СЌС‚РѕРјСѓ Р·Р°РґР°РЅРёСЋ."
                                        onDownload={handleSubmissionDownload}
                                        onRemove={(file) => handleRemoveSubmission(file)}
                                    />
                                </div>

                                {removingSubmissionId && (
                                    <p className="mt-3 text-sm text-slate-500">РЈР±РёСЂР°РµРј РІС‹Р±СЂР°РЅРЅС‹Р№ С„Р°Р№Р» РёР· РѕС‚РїСЂР°РІРєРё...</p>
                                )}
                            </section>
                        )}

                        {!isTeacher && (
                            latestSubmission ? (
                                <CommentThreadList
                                    title="Р›РёС‡РЅС‹Рµ РєРѕРјРјРµРЅС‚Р°СЂРёРё"
                                    description="Р’РёРґРЅС‹ С‚РѕР»СЊРєРѕ РІР°Рј Рё РїСЂРµРїРѕРґР°РІР°С‚РµР»СЋ."
                                    comments={privateComments}
                                    currentUserId={user?.id}
                                    onCreate={handleCreatePrivateComment}
                                    onReply={handleReplyToPrivateComment}
                                    emptyMessage="Р›РёС‡РЅР°СЏ РїРµСЂРµРїРёСЃРєР° РїРѕ РІР°С€РµР№ СЂР°Р±РѕС‚Рµ РїРѕРєР° РЅРµ РЅР°С‡Р°Р»Р°СЃСЊ."
                                    createPlaceholder="РќР°РїРёС€РёС‚Рµ Р»РёС‡РЅС‹Р№ РєРѕРјРјРµРЅС‚Р°СЂРёР№..."
                                    createLabel="РћС‚РїСЂР°РІРёС‚СЊ"
                                    loading={commentsLoading}
                                    variant="private"
                                    scopeLabel="РўРѕР»СЊРєРѕ РІС‹ Рё РїСЂРµРїРѕРґР°РІР°С‚РµР»СЊ"
                                    composerMode="toggle"
                                    composerPosition="bottom"
                                    composerTriggerLabel="Р”РѕР±Р°РІРёС‚СЊ Р»РёС‡РЅС‹Р№ РєРѕРјРјРµРЅС‚Р°СЂРёР№"
                                />
                            ) : (
                                <section className="rounded-[28px] border border-dashed border-white/10 px-6 py-10 text-center text-slate-500">
                                    РџСЂРёРєСЂРµРїРёС‚Рµ СЂР°Р±РѕС‚Сѓ, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚СЊ Р»РёС‡РЅСѓСЋ РїРµСЂРµРїРёСЃРєСѓ СЃ РїСЂРµРїРѕРґР°РІР°С‚РµР»РµРј.
                                </section>
                            )
                        )}
                    </div>
                </div>

                <CommentThreadList
                    title="РљРѕРјРјРµРЅС‚Р°СЂРёРё"
                    description="Р’РёРґРЅС‹ РІСЃРµРј СѓС‡Р°СЃС‚РЅРёРєР°Рј РєСѓСЂСЃР°."
                    comments={publicComments}
                    currentUserId={user?.id}
                    onCreate={handleCreatePublicComment}
                    onReply={handleReplyToPublicComment}
                    emptyMessage="РџРѕРєР° РЅРёРєС‚Рѕ РЅРµ РѕСЃС‚Р°РІРёР» РєРѕРјРјРµРЅС‚Р°СЂРёР№ РїРѕ СЌС‚РѕРјСѓ Р·Р°РґР°РЅРёСЋ."
                    createPlaceholder="РќР°РїРёС€РёС‚Рµ РєРѕРјРјРµРЅС‚Р°СЂРёР№ РїРѕ Р·Р°РґР°РЅРёСЋ..."
                    createLabel="РћС‚РїСЂР°РІРёС‚СЊ"
                    loading={commentsLoading}
                    variant="public"
                    scopeLabel="Р’РёРґРЅРѕ РІСЃРµРј"
                    composerMode="toggle"
                    composerPosition="bottom"
                    composerTriggerLabel="Р”РѕР±Р°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№"
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
                title="РЈРґР°Р»РµРЅРёРµ Р·Р°РґР°РЅРёСЏ"
                message="Р’С‹ СѓРІРµСЂРµРЅС‹? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ."
                confirmText="РЈРґР°Р»РёС‚СЊ"
            />

            {showSubmitModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={() => {
                    if (!submitting) {
                        setShowSubmitModal(false);
                        setSubmitFile(null);
                    }
                }}>
                    <div
                        className="mx-auto my-6 w-full max-w-lg rounded-[30px] border border-purple-500/12 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.14),_transparent_32%),rgba(15,17,27,0.98)] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.4)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-semibold text-white">РџСЂРёРєСЂРµРїРёС‚СЊ СЂР°Р±РѕС‚Сѓ</h2>
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
                            Р¤Р°Р№Р» Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»РµРЅ РєР°Рє РЅРѕРІР°СЏ РІРµСЂСЃРёСЏ РІР°С€РµР№ СЂР°Р±РѕС‚С‹.
                        </p>

                        <div className="mt-5 rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] p-5">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/15 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/22">
                                <HiPaperClip className="h-4 w-4" />
                                Р’С‹Р±СЂР°С‚СЊ С„Р°Р№Р»
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
                                <p className="mt-4 text-sm text-slate-500">Р¤Р°Р№Р» РїРѕРєР° РЅРµ РІС‹Р±СЂР°РЅ.</p>
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
                                РћС‚РјРµРЅР°
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitFile}
                                disabled={submitting || !submitFile}
                                className="rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {submitting ? 'РћС‚РїСЂР°РІР»СЏРµРј...' : 'РћС‚РїСЂР°РІРёС‚СЊ СЂР°Р±РѕС‚Сѓ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default TaskDetailPage;
