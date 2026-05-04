const FINAL_GRADES_PREFIX = 'aiditorium-final-grades:';

const getStorageKey = (taskId) => `${FINAL_GRADES_PREFIX}${taskId}`;

export const loadFinalGrades = (taskId) => {
    if (!taskId || typeof window === 'undefined') {
        return {};
    }

    try {
        const rawValue = window.localStorage.getItem(getStorageKey(taskId));
        return rawValue ? JSON.parse(rawValue) : {};
    } catch (error) {
        console.error('Failed to load final grades', error);
        return {};
    }
};

export const saveFinalGrade = (taskId, studentId, grade) => {
    const previousGrades = loadFinalGrades(taskId);
    const nextGrade = {
        task_id: Number(taskId),
        user_id: Number(studentId),
        grade,
        updated_at: new Date().toISOString()
    };
    const nextGrades = {
        ...previousGrades,
        [studentId]: nextGrade
    };

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(getStorageKey(taskId), JSON.stringify(nextGrades));
    }

    return nextGrade;
};
