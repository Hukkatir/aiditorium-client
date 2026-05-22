import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    HiArrowLeft,
    HiArrowDownTray,
    HiCalendar,
    HiCheck,
    HiCog6Tooth,
    HiDocumentArrowDown,
    HiExclamationTriangle,
    HiMagnifyingGlass,
    HiShieldCheck,
    HiSparkles,
    HiStar,
    HiTableCells,
    HiUserGroup,
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
import { aiReviewService } from '../services/aiReviewService';
import { peerReviewService } from '../services/peerReviewService';
import { taskService } from '../services/taskService';
import { extractCollection } from '../utils/apiUtils';
import { addCommentToTree, getCommentFromResponse, normalizeCommentNode } from '../utils/commentUtils';
import { getDisplayFileName, getTaskMaterials } from '../utils/fileUtils';
import {
    buildTaskAiReviewSettingsPath,
    buildTaskPath,
    buildTaskPeerReviewSettingsPath,
    buildTaskSubmissionsPath
} from '../utils/routeUtils';
import {
    buildGradeSourcesByStudent,
    calculateAverageGrade,
    formatGradeValue,
    getAiReviewScore,
    getLatestAiReviewByStudent,
    getNumericGrade,
    getSourceValues
} from '../utils/gradeReviewUtils';
import { loadFinalGrades, saveFinalGrade } from '../utils/finalGradeUtils';
import {
    DEFAULT_PEER_REVIEW_SETTINGS,
    loadPeerReviewSettings,
    normalizePeerReviewSettings
} from '../utils/reviewSettingsUtils';
import {
    buildPeerAveragesByStudent,
    loadPeerReviewResults
} from '../utils/peerReviewUtils';
import { getAiReviewStatus } from '../utils/aiReviewPresentation';

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

const getApiMessage = (error) => error.response?.data?.error || error.response?.data?.message || '';

const isReviewPermissionError = (error) => {
    const message = getApiMessage(error);
    return error.response?.status === 403 && (
        !message
        ||
        /permission/i.test(message)
        || /review submissions/i.test(message)
        || /доступ/i.test(message)
        || /unauthorized/i.test(message)
    );
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const downloadTextFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

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
    const [reviewers, setReviewers] = useState([]);
    const [reviewerDraftIds, setReviewerDraftIds] = useState([]);
    const [grades, setGrades] = useState([]);
    const [aiReviews, setAiReviews] = useState([]);
    const [peerSettings, setPeerSettings] = useState(DEFAULT_PEER_REVIEW_SETTINGS);
    const [peerResults, setPeerResults] = useState([]);
    const [gradeInputs, setGradeInputs] = useState({});
    const [finalGrades, setFinalGrades] = useState({});
    const [finalGradeInputs, setFinalGradeInputs] = useState({});
    const [savingGradeFor, setSavingGradeFor] = useState(null);
    const [savingFinalGradeFor, setSavingFinalGradeFor] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [studentFilter, setStudentFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [savingReviewers, setSavingReviewers] = useState(false);
    const [canManageReviewers, setCanManageReviewers] = useState(false);
    const [reviewAccessDenied, setReviewAccessDenied] = useState(false);

    const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

    const currentRole = useMemo(
        () => getCurrentCourseRole(course, courseUsers, user),
        [course, courseUsers, user]
    );

    const taskPath = task && course && discipline
        ? buildTaskPath(course, discipline, task)
        : '/courses';
    const aiSettingsPath = task && course && discipline
        ? buildTaskAiReviewSettingsPath(course, discipline, task)
        : '/courses';
    const peerSettingsPath = task && course && discipline
        ? buildTaskPeerReviewSettingsPath(course, discipline, task)
        : '/courses';
    const isTeacher = currentRole === 'teacher';
    const gradeLimit = useMemo(() => {
        const parsedScores = Number(task?.scores);
        return Number.isFinite(parsedScores) && parsedScores > 0 ? parsedScores : 100;
    }, [task]);
    const taskMaterials = useMemo(() => getTaskMaterials(task), [task]);
    const teacherOptions = useMemo(
        () => courseUsers.filter((courseUser) => (
            courseUser.pivot?.role === 'teacher'
            && Number(courseUser.id) !== Number(task?.user_id)
        )),
        [courseUsers, task]
    );

    const courseStudents = useMemo(
        () => courseUsers.filter((courseUser) => {
            const role = String(courseUser.pivot?.role || '').toLowerCase();

            if (role === 'student') {
                return true;
            }

            if (role === 'teacher') {
                return false;
            }

            return Number(courseUser.id) !== Number(course?.creator_id);
        }),
        [course?.creator_id, courseUsers]
    );

    const submissionGroups = useMemo(() => {
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
                submissions: [submission],
                hasSubmission: true
            });
        });

        return Array.from(groups.values());
    }, [submissions]);

    const groupedSubmissions = useMemo(() => {
        const submittedByStudent = new Map(
            submissionGroups.map((group) => [group.userId, group])
        );
        const studentIds = new Set();

        const groups = courseStudents.map((student) => {
            const userId = Number(student.id);
            const submittedGroup = submittedByStudent.get(userId);
            studentIds.add(userId);

            if (submittedGroup) {
                return {
                    ...submittedGroup,
                    user: submittedGroup.user || student,
                    hasSubmission: true
                };
            }

            return {
                userId,
                user: student,
                latestSubmission: null,
                submissions: [],
                hasSubmission: false
            };
        });

        submissionGroups.forEach((group) => {
            if (!studentIds.has(group.userId)) {
                groups.push(group);
            }
        });

        return groups.sort((left, right) => {
            if (left.hasSubmission !== right.hasSubmission) {
                return left.hasSubmission ? -1 : 1;
            }

            if (left.hasSubmission && right.hasSubmission) {
                return new Date(right.latestSubmission?.created_at || 0) - new Date(left.latestSubmission?.created_at || 0);
            }

            const leftName = (left.user?.name || left.user?.email || '').toLowerCase();
            const rightName = (right.user?.name || right.user?.email || '').toLowerCase();
            return leftName.localeCompare(rightName, 'ru');
        });
    }, [courseStudents, submissionGroups]);

    const submissionOwners = useMemo(() => {
        const entries = submissions.map((submission) => [Number(submission.id), Number(submission.user_id)]);
        return new Map(entries);
    }, [submissions]);

    const gradeSourcesByStudent = useMemo(
        () => buildGradeSourcesByStudent(grades, task?.id),
        [grades, task?.id]
    );

    const gradesByStudent = useMemo(() => {
        const gradeEntries = Array.from(gradeSourcesByStudent.entries())
            .filter(([, sources]) => sources.teacher)
            .map(([userId, sources]) => [userId, sources.teacher]);

        return new Map(gradeEntries);
    }, [gradeSourcesByStudent]);

    const latestAiReviewByStudent = useMemo(
        () => getLatestAiReviewByStudent(aiReviews, groupedSubmissions),
        [aiReviews, groupedSubmissions]
    );

    const peerResultsByStudent = useMemo(
        () => buildPeerAveragesByStudent(peerResults, task?.id),
        [peerResults, task?.id]
    );

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
        return groupedSubmissions.filter((group) => {
            const hasTeacherGrade = gradesByStudent.has(group.userId);
            const hasSubmission = Boolean(group.hasSubmission);

            if (studentFilter === 'graded' && !hasTeacherGrade) {
                return false;
            }

            if (studentFilter === 'ungraded' && hasTeacherGrade) {
                return false;
            }

            if (studentFilter === 'submitted' && !hasSubmission) {
                return false;
            }

            if (studentFilter === 'missing' && hasSubmission) {
                return false;
            }

            if (!deferredSearchQuery) {
                return true;
            }

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
    }, [deferredSearchQuery, gradesByStudent, groupedSubmissions, studentFilter]);

    const selectedGroup = useMemo(
        () => filteredGroups.find((group) => group.userId === selectedStudentId) || filteredGroups[0] || null,
        [filteredGroups, selectedStudentId]
    );

    const selectedStudentComments = useMemo(() => {
        if (!selectedGroup?.hasSubmission) {
            return [];
        }

        const fileIds = new Set(selectedGroup.submissions.map((submission) => Number(submission.id)));
        return taskComments.filter((comment) => comment.file_id && !comment.parent_id && fileIds.has(Number(comment.file_id)));
    }, [selectedGroup, taskComments]);

    const selectedStudentGrade = selectedGroup ? gradesByStudent.get(selectedGroup.userId) : null;
    const selectedGradeSources = useMemo(
        () => (selectedGroup ? gradeSourcesByStudent.get(selectedGroup.userId) || {} : {}),
        [gradeSourcesByStudent, selectedGroup]
    );
    const selectedAiReview = selectedGroup ? latestAiReviewByStudent.get(selectedGroup.userId) : null;
    const selectedSourceValues = useMemo(
        () => getSourceValues(
            selectedGradeSources,
            selectedAiReview,
            selectedGroup ? peerResultsByStudent.get(selectedGroup.userId) : null
        ),
        [peerResultsByStudent, selectedAiReview, selectedGradeSources, selectedGroup]
    );
    const selectedAverageGrade = useMemo(
        () => calculateAverageGrade(selectedSourceValues),
        [selectedSourceValues]
    );
    const selectedFinalGrade = selectedGroup ? getNumericGrade(finalGrades[selectedGroup.userId]?.grade) : null;

    const gradedCount = useMemo(
        () => groupedSubmissions.filter((group) => gradesByStudent.has(group.userId)).length,
        [gradesByStudent, groupedSubmissions]
    );

    const submittedCount = useMemo(
        () => groupedSubmissions.filter((group) => group.hasSubmission).length,
        [groupedSubmissions]
    );
    const missingCount = groupedSubmissions.length - submittedCount;
    const ungradedCount = groupedSubmissions.length - gradedCount;
    const latestSubmittedAt = submissionGroups[0]?.latestSubmission?.created_at || null;

    const journalRows = useMemo(() => groupedSubmissions.map((group) => {
        const sources = gradeSourcesByStudent.get(group.userId) || {};
        const aiReview = latestAiReviewByStudent.get(group.userId);
        const values = getSourceValues(sources, aiReview, peerResultsByStudent.get(group.userId));
        const averageGrade = calculateAverageGrade(values);
        const finalGrade = getNumericGrade(finalGrades[group.userId]?.grade);

        return {
            studentId: group.userId,
            studentName: group.user?.name || 'Студент',
            studentEmail: group.user?.email || '',
            latestSubmissionAt: group.latestSubmission?.created_at || null,
            submissionsCount: group.submissions.length,
            submissionStatus: group.hasSubmission ? 'Сдано' : 'Не сдано',
            teacherGrade: values.teacher,
            aiGrade: values.ai,
            peerGrade: values.peer,
            averageGrade,
            finalGrade,
            aiReviewStatus: getAiReviewStatus(aiReview).label
        };
    }), [finalGrades, gradeSourcesByStudent, groupedSubmissions, latestAiReviewByStudent, peerResultsByStudent]);

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
        setFinalGradeInputs((previous) => {
            const next = { ...previous };

            groupedSubmissions.forEach((group) => {
                const savedFinalGrade = getNumericGrade(finalGrades[group.userId]?.grade);
                next[group.userId] = savedFinalGrade !== null
                    ? String(savedFinalGrade)
                    : (previous[group.userId] ?? '');
            });

            return next;
        });
    }, [finalGrades, groupedSubmissions]);

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
        setReviewAccessDenied(false);

        try {
            const taskData = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
            const taskObject = taskData.task || taskData;

            const [courseData, disciplineData] = await Promise.all([
                courseService.getCourse(taskObject.course_id),
                disciplineService.getDiscipline(taskObject.course_id, taskObject.discipline_id)
            ]);

            const courseObject = courseData.course || courseData;
            const disciplineObject = disciplineData.discipline || disciplineData;
            let hasReviewAccessError = false;

            const handleReviewScopedError = (error, fallback) => {
                if (error.response?.status === 404) {
                    return fallback;
                }

                if (isReviewPermissionError(error)) {
                    hasReviewAccessError = true;
                    return fallback;
                }

                throw error;
            };

            const handlePeerReviewScopedError = (error, fallback) => {
                console.error(error);
                return fallback;
            };

            const [usersData, reviewersData, submissionsData, gradesData, commentsData, aiReviewsData, peerSettingsData, peerResultsData] = await Promise.all([
                courseService.getCourseUsers(courseObject.id).catch(() => ({ users: [] })),
                taskService.getTaskReviewers(taskObject.id).catch(() => ({ reviewers: taskObject.reviewers || [] })),
                taskService.getTaskSubmissions(taskObject.id, 100)
                    .catch((error) => handleReviewScopedError(error, { submissions: emptyPaginatedResponse })),
                gradeService.getCourseGrades(courseObject.id, 100, taskObject.id)
                    .catch((error) => handleReviewScopedError(error, emptyPaginatedResponse)),
                commentService.getTaskComments(taskObject.id, 100)
                    .catch((error) => handleReviewScopedError(error, emptyPaginatedResponse)),
                aiReviewService.getTaskAiReviews(taskObject.id, 100)
                    .catch((error) => handleReviewScopedError(error, { reviews: emptyPaginatedResponse })),
                peerReviewService.getTaskSettings(taskObject.id)
                    .catch((error) => handlePeerReviewScopedError(error, { settings: loadPeerReviewSettings(taskObject.id) })),
                peerReviewService.getTaskResults(taskObject.id)
                    .catch((error) => handlePeerReviewScopedError(error, { results: loadPeerReviewResults(taskObject.id) }))
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
            setReviewers(reviewersData.reviewers || taskObject.reviewers || []);
            setReviewerDraftIds((reviewersData.reviewers || taskObject.reviewers || []).map((reviewer) => Number(reviewer.id)));
            setCanManageReviewers(Boolean(
                reviewersData.can_manage_reviewers
                ?? Number(taskObject.user_id) === Number(user?.id)
            ));
            setReviewAccessDenied(hasReviewAccessError);
            setSubmissions(extractCollection(submissionsData, 'submissions'));
            setGrades(extractCollection(gradesData, 'grades'));
            setTaskComments(extractCollection(commentsData));
            setAiReviews(extractCollection(aiReviewsData, 'reviews'));
            setPeerSettings(normalizePeerReviewSettings(peerSettingsData.settings || peerSettingsData));
            setPeerResults(extractCollection(peerResultsData, 'results'));
            setFinalGrades(loadFinalGrades(taskObject.id));

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

    const reloadTaskComments = useCallback(async () => {
        if (!task?.id) {
            return;
        }

        try {
            const commentsData = await commentService.getTaskComments(task.id, 100).catch((error) => {
                if (error.response?.status === 404) {
                    return emptyPaginatedResponse;
                }

                throw error;
            });

            setTaskComments(extractCollection(commentsData));
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось обновить комментарии');
        }
    }, [showToast, task?.id]);

    const pushCreatedComment = useCallback((response, fallback) => {
        const createdComment = normalizeCommentNode(getCommentFromResponse(response), fallback, user);
        setTaskComments((previousComments) => addCommentToTree(previousComments, createdComment));
    }, [user]);

    const handleToggleReviewer = (teacherId) => {
        setReviewerDraftIds((previous) => (
            previous.includes(teacherId)
                ? previous.filter((id) => id !== teacherId)
                : [...previous, teacherId]
        ));
    };

    const handleSaveReviewers = async () => {
        if (!task) {
            return;
        }

        setSavingReviewers(true);

        try {
            const data = await taskService.updateTaskReviewers(task.id, reviewerDraftIds);
            const nextReviewers = data.reviewers || [];
            setReviewers(nextReviewers);
            setReviewerDraftIds(nextReviewers.map((reviewer) => Number(reviewer.id)));
            showToast('success', 'Доступ к проверке обновлён');
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось обновить проверяющих');
        } finally {
            setSavingReviewers(false);
        }
    };

    const handleDownload = async (file) => {
        try {
            await fileService.downloadFile(file.id, getDisplayFileName(file));
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось скачать файл');
        }
    };

    const setGradeInput = (studentId, value) => {
        setGradeInputs((previous) => ({
            ...previous,
            [studentId]: value === null || value === undefined ? '' : String(value)
        }));
    };

    const setFinalGradeInput = (studentId, value) => {
        setFinalGradeInputs((previous) => ({
            ...previous,
            [studentId]: value === null || value === undefined ? '' : String(value)
        }));
    };

    const handleUseAverageFinalGrade = (group) => {
        const sources = gradeSourcesByStudent.get(group.userId) || {};
        const aiReview = latestAiReviewByStudent.get(group.userId);
        const averageGrade = calculateAverageGrade(
            getSourceValues(sources, aiReview, peerResultsByStudent.get(group.userId))
        );

        if (averageGrade === null) {
            showToast('error', 'Пока нет оценок, из которых можно посчитать среднее');
            return;
        }

        setFinalGradeInput(group.userId, averageGrade);
        showToast('success', 'Средняя оценка подставлена в итоговый балл');
    };

    const handleUseTeacherFinalGrade = (group) => {
        const teacherGrade = getNumericGrade(gradeSourcesByStudent.get(group.userId)?.teacher?.grade);

        if (teacherGrade === null) {
            showToast('error', 'Сначала сохраните оценку преподавателя');
            return;
        }

        setFinalGradeInput(group.userId, teacherGrade);
        showToast('success', 'Оценка преподавателя подставлена в итог');
    };

    const handleUseAiFinalGrade = (group) => {
        const aiReview = latestAiReviewByStudent.get(group.userId);
        const aiGrade = getAiReviewScore(aiReview);

        if (aiGrade === null) {
            showToast('error', 'AI еще не вернул оценку для этой работы');
            return;
        }

        setFinalGradeInput(group.userId, aiGrade);
        showToast('success', 'Оценка AI подставлена в итоговый балл');
    };

    const handleExportJson = () => {
        if (!journalRows.length) {
            showToast('error', 'В журнале пока нет строк для экспорта');
            return;
        }

        const payload = {
            exported_at: new Date().toISOString(),
            course: { id: course.id, name: course.name },
            discipline: { id: discipline?.id, name: discipline?.name },
            task: { id: task.id, name: task.name, max_score: gradeLimit },
            peer_review: peerSettings,
            rows: journalRows
        };

        downloadTextFile(
            `\uFEFF${JSON.stringify(payload, null, 2)}`,
            `journal-task-${task.id}.json`,
            'application/json;charset=utf-8'
        );
    };

    const handleExportExcel = () => {
        if (!journalRows.length) {
            showToast('error', 'В журнале пока нет строк для экспорта');
            return;
        }

        const rowsHtml = journalRows.map((row) => `
            <tr>
                <td>${escapeHtml(row.studentName)}</td>
                <td>${escapeHtml(row.studentEmail)}</td>
                <td>${escapeHtml(formatGradeValue(row.teacherGrade, gradeLimit))}</td>
                <td>${escapeHtml(formatGradeValue(row.aiGrade, gradeLimit))}</td>
                <td>${escapeHtml(formatGradeValue(row.peerGrade, gradeLimit))}</td>
                <td>${escapeHtml(formatGradeValue(row.averageGrade, gradeLimit))}</td>
                <td>${escapeHtml(formatGradeValue(row.finalGrade, gradeLimit))}</td>
                <td>${escapeHtml(row.aiReviewStatus)}</td>
                <td>${escapeHtml(row.submissionStatus)}</td>
                <td>${escapeHtml(formatDateTime(row.latestSubmissionAt))}</td>
                <td>${escapeHtml(row.submissionsCount)}</td>
            </tr>
        `).join('');

        const html = `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Журнал оценок</title>
                </head>
                <body>
                    <table border="1">
                        <thead>
                            <tr>
                                <th>Студент</th>
                                <th>Email</th>
                                <th>Преподаватель</th>
                                <th>AI</th>
                                <th>Взаимопроверка</th>
                                <th>Среднее</th>
                                <th>Итог</th>
                                <th>AI-статус</th>
                                <th>Статус сдачи</th>
                                <th>Последняя сдача</th>
                                <th>Версий</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
            </html>
        `;

        downloadTextFile(
            `\uFEFF${html}`,
            `journal-task-${task.id}.xls`,
            'application/vnd.ms-excel;charset=utf-8'
        );
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
                const payload = {
                    user_id: group.userId,
                    course_id: course.id,
                    task_id: task.id,
                    discipline_id: discipline?.id,
                    grade: numericGrade
                };

                if (group.latestSubmission?.id) {
                    payload.file_id = group.latestSubmission.id;
                }

                await gradeService.createGrade(payload);
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

    const handleSaveFinalGrade = (group) => {
        const rawValue = finalGradeInputs[group.userId]?.trim();

        if (!rawValue) {
            showToast('error', 'Введите итоговую оценку');
            return;
        }

        const numericGrade = Number(rawValue);
        if (!Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > gradeLimit) {
            showToast('error', `Итоговая оценка должна быть числом от 0 до ${gradeLimit}`);
            return;
        }

        setSavingFinalGradeFor(group.userId);

        try {
            const savedGrade = saveFinalGrade(task.id, group.userId, numericGrade);
            setFinalGrades((previous) => ({
                ...previous,
                [group.userId]: savedGrade
            }));
            showToast('success', 'Итоговая оценка сохранена');
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось сохранить итоговую оценку');
        } finally {
            setSavingFinalGradeFor(null);
        }
    };

    const handleCreatePrivateComment = async (group, body) => {
        if (!group.latestSubmission?.id) {
            showToast('error', 'Личную переписку можно начать после сдачи файла');
            return;
        }

        try {
            const payload = {
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                file_id: group.latestSubmission.id,
                body
            };
            const response = await commentService.createComment(payload);
            pushCreatedComment(response, payload);

            showToast('success', 'Личный комментарий отправлен');
            void reloadTaskComments();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.error || error.response?.data?.message || 'Не удалось отправить комментарий');
        }
    };

    const handleReplyToPrivateComment = async (comment, body) => {
        try {
            const payload = {
                course_id: course.id,
                task_id: task.id,
                discipline_id: discipline?.id,
                file_id: comment.file_id,
                parent_id: comment.id,
                body
            };
            const response = await commentService.createComment(payload);
            pushCreatedComment(response, payload);

            showToast('success', 'Ответ отправлен');
            void reloadTaskComments();
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

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                    <div className="max-w-4xl">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-purple-300">
                            Проверка работ
                        </div>
                        <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl">{task.name}</h1>
                        <div className="mt-4 max-w-3xl">
                            <RichTextContent
                                value={task.description}
                                fallback="Описание задания не заполнено."
                                className="text-gray-400"
                            />
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <HiCalendar className="h-4 w-4" />
                                Срок сдачи
                            </div>
                            <p className="mt-2 text-sm font-medium text-white">{task.deadline ? formatDateTime(task.deadline) : 'не указан'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <HiStar className="h-4 w-4" />
                                Максимум
                            </div>
                            <p className="mt-2 text-sm font-medium text-white">{gradeLimit} баллов</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <HiUserCircle className="h-4 w-4" />
                                Сдали
                            </div>
                            <p className="mt-2 text-sm font-medium text-white">{submittedCount} из {groupedSubmissions.length} студентов</p>
                        </div>
                    </div>
                </section>

                {reviewAccessDenied && (
                    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 md:p-6">
                        <div className="flex items-start gap-3">
                            <HiExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                            <div>
                                <h2 className="text-lg font-semibold text-amber-50">Нет доступа к проверке работ</h2>
                                <p className="mt-2 text-sm leading-6 text-amber-100/80">
                                    Вы преподаватель этого курса, но автор задания не выдал вам право проверять сдачи.
                                    Само задание можно смотреть без ошибки, а доступ к проверке должен добавить автор задания.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {!reviewAccessDenied && canManageReviewers && (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <HiShieldCheck className="h-5 w-5 text-purple-300" />
                                    <h2 className="text-xl font-semibold text-white">Доступ к проверке</h2>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    Автор задания проверяет работы всегда. Здесь можно добавить других преподавателей курса.
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                    Назначено дополнительно: {reviewers.length}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveReviewers}
                                disabled={savingReviewers}
                                className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {savingReviewers ? 'Сохраняем...' : 'Сохранить доступ'}
                            </button>
                        </div>

                        {teacherOptions.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                                В курсе пока нет других преподавателей.
                            </div>
                        ) : (
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {teacherOptions.map((teacher) => {
                                    const isSelected = reviewerDraftIds.includes(Number(teacher.id));

                                    return (
                                        <button
                                            key={teacher.id}
                                            type="button"
                                            onClick={() => handleToggleReviewer(Number(teacher.id))}
                                            className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                                                isSelected
                                                    ? 'border-purple-400/30 bg-purple-500/10'
                                                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-white">{teacher.name}</p>
                                                <p className="truncate text-xs text-slate-500">{teacher.email}</p>
                                            </div>
                                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                                isSelected ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-500'
                                            }`}>
                                                {isSelected && <HiCheck className="h-4 w-4" />}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {!reviewAccessDenied && (
                    <section className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <HiSparkles className="h-5 w-5 text-purple-300" />
                                        <h2 className="text-xl font-semibold text-white">Настройки AI-проверки</h2>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Критерии, запуск проверки и подробные результаты вынесены на отдельную страницу.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => navigate(aiSettingsPath)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                >
                                    <HiCog6Tooth className="h-4 w-4" />
                                    Открыть настройки
                                </button>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                    Работ: {submittedCount}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                    AI-проверок: {aiReviews.length}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <HiUserGroup className="h-5 w-5 text-purple-300" />
                                        <h2 className="text-xl font-semibold text-white">Настройки взаимопроверки</h2>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Режим проверки, распределение работ и ответы студентов находятся на странице взаимопроверки.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => navigate(peerSettingsPath)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                >
                                    <HiCog6Tooth className="h-4 w-4" />
                                    Открыть настройки
                                </button>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                    {peerSettings.mode === 'open' ? 'Открытая' : 'Слепая'}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                    Проверок на студента: {peerSettings.reviewsPerStudent}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                    Ответов: {peerResults.length}
                                </span>
                            </div>
                        </div>
                    </section>
                )}

                {!reviewAccessDenied && groupedSubmissions.length > 0 && (
                    <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <HiTableCells className="h-5 w-5 text-purple-300" />
                                    <h2 className="text-xl font-semibold text-white">Журнал оценок</h2>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    Здесь собраны оценки преподавателя, AI и взаимопроверки. Итогом считается оценка преподавателя,
                                    а если ее нет, показывается среднее по доступным источникам.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        Взаимопроверка: {peerSettings.mode === 'blind' ? 'слепая' : 'открытая'}
                                    </span>
                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        Проверок на студента: {peerSettings.reviewsPerStudent}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportExcel}
                                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500"
                                >
                                    <HiDocumentArrowDown className="h-4 w-4" />
                                    Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportJson}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                >
                                    <HiArrowDownTray className="h-4 w-4" />
                                    JSON
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                            <table className="min-w-full divide-y divide-white/10 text-sm">
                                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Студент</th>
                                        <th className="px-4 py-3">Преподаватель</th>
                                        <th className="px-4 py-3">AI</th>
                                        <th className="px-4 py-3">Взаимопроверка</th>
                                        <th className="px-4 py-3">Итог</th>
                                        <th className="px-4 py-3">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {journalRows.map((row) => (
                                        <tr key={row.studentId} className="text-slate-300">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-white">{row.studentName}</p>
                                                <p className="text-xs text-slate-500">{row.studentEmail || 'Почта не указана'}</p>
                                            </td>
                                            <td className="px-4 py-3">{formatGradeValue(row.teacherGrade, gradeLimit)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span>{formatGradeValue(row.aiGrade, gradeLimit)}</span>
                                                    <span className="text-xs text-slate-500">{row.aiReviewStatus}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{formatGradeValue(row.peerGrade, gradeLimit)}</td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
                                                    {formatGradeValue(row.finalGrade, gradeLimit)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                                                        row.latestSubmissionAt
                                                            ? 'bg-emerald-500/10 text-emerald-200'
                                                            : 'bg-red-500/10 text-red-200'
                                                    }`}>
                                                        {row.submissionStatus}
                                                    </span>
                                                    {row.latestSubmissionAt && (
                                                        <span className="text-xs text-slate-500">{formatDateTime(row.latestSubmissionAt)}</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {reviewAccessDenied ? null : groupedSubmissions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-slate-500">
                        В курсе пока нет студентов для проверки.
                    </div>
                ) : (
                    <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
                        <section className="self-start rounded-2xl border border-white/10 bg-white/[0.03] p-5 xl:sticky xl:top-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold text-white">Студенты</h2>
                                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                                    {groupedSubmissions.length}
                                </span>
                            </div>

                            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
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
                                <button
                                    type="button"
                                    onClick={() => setStudentFilter('all')}
                                    className={`rounded-full px-3 py-1.5 transition ${
                                        studentFilter === 'all'
                                            ? 'bg-purple-500/15 text-purple-100'
                                            : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    }`}
                                >
                                    Все: {groupedSubmissions.length}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStudentFilter(studentFilter === 'submitted' ? 'all' : 'submitted')}
                                    className={`rounded-full px-3 py-1.5 transition ${
                                        studentFilter === 'submitted'
                                            ? 'bg-emerald-500/15 text-emerald-200'
                                            : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    }`}
                                >
                                    Сдали: {submittedCount}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStudentFilter(studentFilter === 'missing' ? 'all' : 'missing')}
                                    className={`rounded-full px-3 py-1.5 transition ${
                                        studentFilter === 'missing'
                                            ? 'bg-red-500/15 text-red-200'
                                            : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    }`}
                                >
                                    Не сдали: {missingCount}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStudentFilter(studentFilter === 'graded' ? 'all' : 'graded')}
                                    className={`rounded-full px-3 py-1.5 transition ${
                                        studentFilter === 'graded'
                                            ? 'bg-emerald-500/15 text-emerald-200'
                                            : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    }`}
                                >
                                    Проверено: {gradedCount}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStudentFilter(studentFilter === 'ungraded' ? 'all' : 'ungraded')}
                                    className={`rounded-full px-3 py-1.5 transition ${
                                        studentFilter === 'ungraded'
                                            ? 'bg-red-500/15 text-red-200'
                                            : 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    }`}
                                >
                                    Без оценки: {ungradedCount}
                                </button>
                                {latestSubmittedAt && (
                                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                                        Последняя сдача: {formatDateTime(latestSubmittedAt)}
                                    </span>
                                )}
                            </div>

                            <div className="mt-5 space-y-3">
                                {filteredGroups.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                                        По этому запросу ничего не найдено.
                                    </div>
                                )}

                                {filteredGroups.map((group) => {
                                    const grade = gradesByStudent.get(group.userId);
                                    const hasSubmission = Boolean(group.hasSubmission);
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
                                            className={`w-full rounded-xl border p-4 text-left transition ${
                                                isActive
                                                    ? 'border-purple-400/30 bg-purple-500/10'
                                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
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
                                                <span className={`rounded-full px-2 py-1 ${
                                                    hasSubmission
                                                        ? 'bg-emerald-500/10 text-emerald-200'
                                                        : 'bg-red-500/10 text-red-200'
                                                }`}>
                                                    {hasSubmission ? 'Сдано' : 'Не сдано'}
                                                </span>
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                                                    Версий: {group.submissions.length}
                                                </span>
                                                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-300">
                                                    Комментариев: {commentsCount}
                                                </span>
                                            </div>

                                            <p className="mt-3 text-xs text-slate-500">
                                                {hasSubmission
                                                    ? `Последняя сдача: ${formatDateTime(group.latestSubmission.created_at)}`
                                                    : 'Файлы не прикреплены'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {selectedGroup && (
                            <div className="space-y-6">
                                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-purple-500">
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
                                                    <span className={`rounded-full px-3 py-1.5 ${
                                                        selectedGroup.hasSubmission
                                                            ? 'bg-emerald-500/10 text-emerald-200'
                                                            : 'bg-red-500/10 text-red-200'
                                                    }`}>
                                                        {selectedGroup.hasSubmission
                                                            ? `Сдано: ${formatDateTime(selectedGroup.latestSubmission.created_at)}`
                                                            : 'Работа не сдана'}
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

                                        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4">
                                            <p className="text-xs text-purple-200/80">Итоговая оценка</p>
                                            <p className="mt-1 text-2xl font-semibold text-white">
                                                {formatGradeValue(selectedFinalGrade, gradeLimit)}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-white/10 bg-[#16161C] p-5 md:p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-semibold text-white">Сводка оценок</h2>
                                            <p className="mt-2 text-sm text-slate-500">
                                                Здесь видно все источники оценивания. Итоговый балл можно поставить вручную или подставить среднее.
                                            </p>
                                        </div>
                                        {selectedFinalGrade !== null && (
                                            <span className="rounded-full bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-100">
                                                Итог сохранён: {selectedFinalGrade}/{gradeLimit}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-sm text-slate-500">Оценка преподавателя</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{formatGradeValue(selectedSourceValues.teacher, gradeLimit)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-sm text-slate-500">AI</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{formatGradeValue(selectedSourceValues.ai, gradeLimit)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-sm text-slate-500">Взаимопроверка</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{formatGradeValue(selectedSourceValues.peer, gradeLimit)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                            <p className="text-sm text-slate-500">Среднее</p>
                                            <p className="mt-2 text-2xl font-semibold text-white">{formatGradeValue(selectedAverageGrade, gradeLimit)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.07] p-4">
                                        <label className="mb-2 block text-sm font-medium text-purple-100" htmlFor={`final-grade-${selectedGroup.userId}`}>
                                            Итоговая оценка
                                        </label>
                                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto]">
                                            <input
                                                id={`final-grade-${selectedGroup.userId}`}
                                                type="number"
                                                min="0"
                                                max={gradeLimit}
                                                value={finalGradeInputs[selectedGroup.userId] ?? ''}
                                                onChange={(event) => {
                                                    setFinalGradeInput(selectedGroup.userId, event.target.value);
                                                }}
                                                placeholder={`0-${gradeLimit}`}
                                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSaveFinalGrade(selectedGroup)}
                                                disabled={savingFinalGradeFor === selectedGroup.userId}
                                                className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                                            >
                                                {savingFinalGradeFor === selectedGroup.userId ? 'Сохраняем...' : 'Сохранить итог'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUseAverageFinalGrade(selectedGroup)}
                                            disabled={selectedAverageGrade === null}
                                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Подставить среднее: {formatGradeValue(selectedAverageGrade, gradeLimit)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUseTeacherFinalGrade(selectedGroup)}
                                            disabled={selectedSourceValues.teacher === null}
                                            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Взять оценку преподавателя
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUseAiFinalGrade(selectedGroup)}
                                            disabled={selectedSourceValues.ai === null}
                                            className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Взять AI
                                        </button>
                                    </div>
                                </section>

                                {taskMaterials.length > 0 && (
                                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
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

                                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-xl font-semibold text-white">Версии работы</h2>
                                            <p className="mt-2 text-sm text-slate-500">
                                                {selectedGroup.hasSubmission
                                                    ? 'Каждая версия открывается на отдельной странице предпросмотра. Последняя отправка уже наверху.'
                                                    : 'Студент пока не прикреплял файл, но оценку преподавателя можно поставить вручную.'}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">
                                            {selectedGroup.submissions.length} версий
                                        </span>
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-[minmax(260px,520px),300px] xl:items-start">
                                        <div className="min-w-0">
                                            <FileTileGrid
                                                files={selectedGroup.submissions}
                                                emptyMessage="Студент еще не прикреплял файлы."
                                                onDownload={handleDownload}
                                                compact
                                            />
                                        </div>

                                        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-medium text-purple-100">Оценка преподавателя</p>
                                                {selectedStudentGrade && (
                                                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                                                        {selectedStudentGrade.grade}/{gradeLimit}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                                Это ваша отдельная оценка за работу. Итог сверху можно оставить другим.
                                            </p>

                                            <div className="mt-4 space-y-3">
                                                <input
                                                    id={`grade-${selectedGroup.userId}`}
                                                    type="number"
                                                    min="0"
                                                    max={gradeLimit}
                                                    value={gradeInputs[selectedGroup.userId] ?? ''}
                                                    onChange={(event) => setGradeInput(selectedGroup.userId, event.target.value)}
                                                    placeholder={`0-${gradeLimit}`}
                                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveGrade(selectedGroup)}
                                                    disabled={savingGradeFor === selectedGroup.userId}
                                                    className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                                                >
                                                    {savingGradeFor === selectedGroup.userId ? 'Сохраняем...' : 'Сохранить оценку'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {selectedGroup.hasSubmission ? (
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
                                ) : (
                                    <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:p-6">
                                        Личная переписка появится после того, как студент прикрепит файл. Оценку можно поставить уже сейчас.
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default TaskSubmissionsPage;
