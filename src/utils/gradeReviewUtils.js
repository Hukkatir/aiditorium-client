const normalizeType = (type = '') => String(type).trim().toLowerCase();

const getGradeTimestamp = (grade = {}) => new Date(
    grade.graded_at || grade.updated_at || grade.created_at || 0
).getTime();

const getReviewTimestamp = (review = {}) => new Date(
    review.finished_at || review.updated_at || review.created_at || 0
).getTime();

export const getNumericGrade = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

export const getGradeSourceType = (grade = {}) => {
    const type = normalizeType(grade.type);

    if (type === 'ai') {
        return 'ai';
    }

    if (type === 'student') {
        return 'peer';
    }

    return 'teacher';
};

export const buildGradeSourcesByStudent = (grades = [], taskId) => {
    const sources = new Map();

    grades
        .filter((grade) => !taskId || Number(grade.task_id) === Number(taskId))
        .forEach((grade) => {
            const userId = Number(grade.user_id);
            if (!userId) {
                return;
            }

            const entry = sources.get(userId) || {
                teacher: null,
                ai: null,
                peerGrades: []
            };
            const sourceType = getGradeSourceType(grade);

            if (sourceType === 'peer') {
                entry.peerGrades.push(grade);
            } else if (!entry[sourceType] || getGradeTimestamp(grade) >= getGradeTimestamp(entry[sourceType])) {
                entry[sourceType] = grade;
            }

            sources.set(userId, entry);
        });

    sources.forEach((entry) => {
        const peerValues = entry.peerGrades
            .map((grade) => getNumericGrade(grade.grade))
            .filter((grade) => grade !== null);

        entry.peerAverage = peerValues.length
            ? Math.round(peerValues.reduce((sum, grade) => sum + grade, 0) / peerValues.length)
            : null;
    });

    return sources;
};

export const getLatestAiReviewByStudent = (aiReviews = [], groupedSubmissions = []) => {
    const reviewsByFile = new Map();

    aiReviews.forEach((review) => {
        const fileId = Number(review.file_id || review.file?.id);
        if (!fileId) {
            return;
        }

        const existingReview = reviewsByFile.get(fileId);
        if (!existingReview || getReviewTimestamp(review) >= getReviewTimestamp(existingReview)) {
            reviewsByFile.set(fileId, review);
        }
    });

    const reviewsByStudent = new Map();

    groupedSubmissions.forEach((group) => {
        const latestReview = group.submissions
            .map((submission) => reviewsByFile.get(Number(submission.id)))
            .filter(Boolean)
            .sort((left, right) => getReviewTimestamp(right) - getReviewTimestamp(left))[0];

        if (latestReview) {
            reviewsByStudent.set(group.userId, latestReview);
        }
    });

    return reviewsByStudent;
};

export const getAiReviewScore = (review) => getNumericGrade(review?.recommended_score);

export const getSourceValues = (sources = {}, aiReview = null, peerOverride = null) => {
    const teacher = getNumericGrade(sources.teacher?.grade);
    const aiGrade = getNumericGrade(sources.ai?.grade);
    const aiReviewScore = getAiReviewScore(aiReview);

    return {
        teacher,
        ai: aiGrade ?? aiReviewScore,
        peer: getNumericGrade(peerOverride) ?? sources.peerAverage ?? null
    };
};

export const calculateAverageGrade = (values = {}) => {
    const grades = [values.teacher, values.ai, values.peer]
        .map(getNumericGrade)
        .filter((grade) => grade !== null);

    if (!grades.length) {
        return null;
    }

    return Math.round(grades.reduce((sum, grade) => sum + grade, 0) / grades.length);
};

export const formatGradeValue = (value, maxScore = 100) => {
    const numericValue = getNumericGrade(value);
    return numericValue === null ? '—' : `${numericValue}/${maxScore}`;
};
