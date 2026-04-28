import apiClient from './apiClient';

const getCollection = (payload) => {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== 'object') {
        return [];
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.comments?.data)) {
        return payload.comments.data;
    }

    if (Array.isArray(payload?.comments)) {
        return payload.comments;
    }

    if (Array.isArray(payload?.replies?.data)) {
        return payload.replies.data;
    }

    if (Array.isArray(payload?.replies)) {
        return payload.replies;
    }

    return [];
};

const asDataResponse = (payload, items) => ({
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
    data: items
});

const asRepliesResponse = (payload, items) => ({
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
    replies: items
});

const hasReplyField = (comment) => (
    comment
    && typeof comment === 'object'
    && (
    Object.prototype.hasOwnProperty.call(comment, 'replies')
    || Object.prototype.hasOwnProperty.call(comment, 'replies_recursive')
    )
);

const normalizeComment = (comment) => {
    const replies = getCollection(comment.replies ?? comment.replies_recursive ?? []);
    const rest = { ...comment };
    delete rest.replies_recursive;

    return {
        ...rest,
        replies
    };
};

const upsertReply = (replies, reply) => {
    if (!reply?.id) {
        return [...replies, reply];
    }

    const exists = replies.some((item) => Number(item.id) === Number(reply.id));

    if (!exists) {
        return [...replies, reply];
    }

    return replies.map((item) => (
        Number(item.id) === Number(reply.id)
            ? { ...item, ...reply, replies: reply.replies?.length ? reply.replies : item.replies }
            : item
    ));
};

const buildCommentTree = (comments) => {
    const normalizedComments = getCollection(comments).map((comment) => ({
        ...normalizeComment(comment),
        __repliesLoaded: hasReplyField(comment)
    }));
    const commentsById = new Map();

    normalizedComments.forEach((comment) => {
        commentsById.set(Number(comment.id), {
            ...comment,
            replies: getCollection(comment.replies),
            __repliesLoaded: comment.__repliesLoaded
        });
    });

    const roots = [];

    normalizedComments.forEach((comment) => {
        const node = commentsById.get(Number(comment.id));
        const parentId = Number(node?.parent_id);
        const parent = parentId ? commentsById.get(parentId) : null;

        if (parent) {
            parent.__repliesLoaded = true;
            parent.replies = upsertReply(getCollection(parent.replies), node);
            return;
        }

        roots.push(node);
    });

    return roots;
};

const hasLoadedReplies = (comment) => (
    comment.__repliesLoaded === true
    || (
        comment.__repliesLoaded !== false
        && (
            (Object.prototype.hasOwnProperty.call(comment, 'replies') && comment.replies != null)
            || (Object.prototype.hasOwnProperty.call(comment, 'replies_recursive') && comment.replies_recursive != null)
        )
    )
);

const fetchDirectReplies = async (commentId) => {
    const response = await apiClient.get(`/comment/${commentId}/replies`);
    return buildCommentTree(getCollection(response.data));
};

const hydrateCommentTree = async (comments, visited = new Set(), depth = 0) => {
    const list = Array.isArray(comments) ? comments : getCollection(comments);

    if (depth > 20) {
        return list.map(normalizeComment);
    }

    return Promise.all(list.map(async (comment) => {
        const normalized = normalizeComment(comment);
        const commentId = Number(normalized.id);

        if (!commentId || visited.has(commentId)) {
            return normalized;
        }

        const nextVisited = new Set(visited);
        nextVisited.add(commentId);

        let replies = normalized.replies;

        if (!hasLoadedReplies(comment)) {
            try {
                replies = await fetchDirectReplies(commentId);
            } catch {
                replies = [];
            }
        }

        return {
            ...normalized,
            replies: await hydrateCommentTree(replies, nextVisited, depth + 1)
        };
    }));
};

export const commentService = {
    async createComment(payload) {
        const response = await apiClient.post('/comment', payload);
        return response.data;
    },

    async getTaskComments(taskId, perPage = 100) {
        const response = await apiClient.post('/comment/viewTask', {
            task_id: taskId,
            per_page: perPage
        });
        const comments = await hydrateCommentTree(buildCommentTree(getCollection(response.data)));

        return asDataResponse(response.data, comments);
    },

    async getMyComments(courseId, params = {}) {
        const response = await apiClient.get('/comment/my', {
            params: {
                course_id: courseId,
                per_page: 100,
                ...params
            }
        });
        return response.data;
    },

    async getReplies(commentId) {
        const response = await apiClient.get(`/comment/${commentId}/replies`);
        const replies = await hydrateCommentTree(buildCommentTree(getCollection(response.data)));

        return asRepliesResponse(response.data, replies);
    }
};
