export const extractCollection = (payload, key) => {
    if (Array.isArray(payload?.[key]?.data)) {
        return payload[key].data;
    }

    if (Array.isArray(payload?.[key])) {
        return payload[key];
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload)) {
        return payload;
    }

    return [];
};
