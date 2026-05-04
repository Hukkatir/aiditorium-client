const ASSIGNMENTS_PREFIX = 'aiditorium-peer-review-assignments:';
const RESULTS_PREFIX = 'aiditorium-peer-review-results:';

const safeJsonParse = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.error('Failed to parse peer review data', error);
        return fallback;
    }
};

const getStorageItemsByPrefix = (prefix) => {
    if (typeof window === 'undefined') {
        return [];
    }

    return Object.keys(window.localStorage)
        .filter((key) => key.startsWith(prefix))
        .flatMap((key) => safeJsonParse(window.localStorage.getItem(key), []));
};

export const getPeerAssignmentsKey = (taskId) => `${ASSIGNMENTS_PREFIX}${taskId}`;

export const getPeerResultsKey = (taskId) => `${RESULTS_PREFIX}${taskId}`;

export const loadPeerReviewAssignments = (taskId) => {
    if (!taskId || typeof window === 'undefined') {
        return [];
    }

    return safeJsonParse(window.localStorage.getItem(getPeerAssignmentsKey(taskId)), []);
};

export const savePeerReviewAssignments = (taskId, assignments) => {
    if (!taskId || typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(getPeerAssignmentsKey(taskId), JSON.stringify(assignments));
};

export const loadAllPeerReviewAssignments = () => getStorageItemsByPrefix(ASSIGNMENTS_PREFIX);

export const loadPeerReviewResults = (taskId) => {
    if (!taskId || typeof window === 'undefined') {
        return [];
    }

    return safeJsonParse(window.localStorage.getItem(getPeerResultsKey(taskId)), []);
};

export const loadAllPeerReviewResults = () => getStorageItemsByPrefix(RESULTS_PREFIX);

export const savePeerReviewResult = (result) => {
    if (!result?.task_id || typeof window === 'undefined') {
        return [];
    }

    const results = loadPeerReviewResults(result.task_id);
    const nextResult = {
        ...result,
        grade: result.grade === '' || result.grade === null || result.grade === undefined ? null : Number(result.grade),
        updated_at: new Date().toISOString(),
        created_at: result.created_at || new Date().toISOString()
    };
    const resultIndex = results.findIndex((item) => item.assignment_id === nextResult.assignment_id);
    const nextResults = resultIndex >= 0
        ? results.map((item, index) => (index === resultIndex ? nextResult : item))
        : [...results, nextResult];

    window.localStorage.setItem(getPeerResultsKey(result.task_id), JSON.stringify(nextResults));
    return nextResults;
};

export const generatePeerReviewAssignments = ({
    task,
    course,
    discipline,
    groups = [],
    settings = {}
}) => {
    const reviewers = groups
        .filter((group) => group?.latestSubmission?.id && group?.userId)
        .map((group) => ({
            userId: Number(group.userId),
            userName: group.user?.name || 'Студент',
            userEmail: group.user?.email || '',
            submission: group.latestSubmission
        }));

    if (reviewers.length < 2) {
        return [];
    }

    const reviewsPerStudent = Math.max(1, Number(settings.reviewsPerStudent) || 1);
    const assignments = [];

    reviewers.forEach((reviewer, reviewerIndex) => {
        const targets = reviewers.filter((candidate) => candidate.userId !== reviewer.userId);

        for (let index = 0; index < Math.min(reviewsPerStudent, targets.length); index += 1) {
            const target = targets[(reviewerIndex + index) % targets.length];
            const assignmentId = [
                task.id,
                reviewer.userId,
                target.userId,
                target.submission.id,
                index
            ].join(':');

            assignments.push({
                id: assignmentId,
                task_id: Number(task.id),
                course_id: Number(course.id),
                discipline_id: Number(discipline.id),
                reviewer_id: reviewer.userId,
                reviewer_name: reviewer.userName,
                target_user_id: target.userId,
                target_user_name: target.userName,
                target_user_email: target.userEmail,
                file_id: Number(target.submission.id),
                file_name: target.submission.original_name || target.submission.name || target.submission.path || 'Файл',
                task_name: task.name,
                max_score: Number(task.scores) || 100,
                course_name: course.name,
                discipline_name: discipline.name,
                course_identifier: course.slug || course.id,
                discipline_identifier: discipline.slug || discipline.id,
                task_number: task.task_number ?? task.id,
                blind: settings.mode !== 'open',
                allow_score: settings.allowScore !== false,
                instructions: settings.instructions || '',
                created_at: new Date().toISOString()
            });
        }
    });

    return assignments;
};

export const buildPeerAveragesByStudent = (results = [], taskId = null) => {
    const buckets = new Map();

    results
        .filter((result) => !taskId || Number(result.task_id) === Number(taskId))
        .forEach((result) => {
            const targetUserId = Number(result.target_user_id);
            const grade = Number(result.grade);

            if (!targetUserId || !Number.isFinite(grade)) {
                return;
            }

            const values = buckets.get(targetUserId) || [];
            values.push(grade);
            buckets.set(targetUserId, values);
        });

    const averages = new Map();
    buckets.forEach((values, targetUserId) => {
        averages.set(targetUserId, Math.round(values.reduce((sum, grade) => sum + grade, 0) / values.length));
    });

    return averages;
};
