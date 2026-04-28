export const extractCollection = (payload, key) => {
    if (!payload || typeof payload !== 'object') {
        return Array.isArray(payload) ? payload : [];
    }

    if (key && Array.isArray(payload?.[key]?.data)) {
        return payload[key].data;
    }

    if (key && Array.isArray(payload?.[key])) {
        return payload[key];
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    const fallbackKeys = ['comments', 'replies', 'files', 'submissions', 'grades', 'reviews', 'tasks', 'courses', 'disciplines', 'users'];

    for (const fallbackKey of fallbackKeys) {
        if (Array.isArray(payload?.[fallbackKey]?.data)) {
            return payload[fallbackKey].data;
        }

        if (Array.isArray(payload?.[fallbackKey])) {
            return payload[fallbackKey];
        }
    }

    return [];
};
