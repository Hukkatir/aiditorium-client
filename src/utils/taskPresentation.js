export const formatTaskDate = (dateString, withTime = false) => {
    if (!dateString) {
        return withTime ? 'Не указано' : 'Без срока сдачи';
    }

    const options = withTime
        ? {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
        : {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };

    return new Date(dateString).toLocaleString('ru-RU', options);
};

export const getTaskCreatorName = (task, users = []) => {
    if (task?.user?.name) {
        return task.user.name;
    }

    return users.find((item) => Number(item.id) === Number(task?.user_id))?.name || 'Неизвестно';
};

export const getTaskSubmissionStatus = (deadline, latestSubmission) => {
    if (!latestSubmission) {
        return {
            key: 'not_submitted',
            label: 'Не сдано',
            className: 'bg-red-500/10 text-red-300'
        };
    }

    const deadlineTimestamp = deadline ? new Date(deadline).getTime() : null;
    const submittedAt = new Date(latestSubmission.created_at).getTime();
    const isLate = deadlineTimestamp && submittedAt > deadlineTimestamp;

    if (isLate) {
        return {
            key: 'late',
            label: 'Сдано с опозданием',
            className: 'bg-amber-500/10 text-amber-200'
        };
    }

    return {
        key: 'submitted',
        label: 'Сдано',
        className: 'bg-emerald-500/10 text-emerald-200'
    };
};

export const matchesTaskStatusFilter = (status, filter) => {
    if (filter === 'all') {
        return true;
    }

    if (!status) {
        return filter !== 'submitted';
    }

    if (filter === 'submitted') {
        return status.key === 'submitted' || status.key === 'late';
    }

    if (filter === 'not_submitted') {
        return status.key === 'not_submitted';
    }

    return true;
};
