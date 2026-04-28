const getNestedReplies = (comment) => {
    if (Array.isArray(comment?.replies)) {
        return comment.replies;
    }

    if (Array.isArray(comment?.replies_recursive)) {
        return comment.replies_recursive;
    }

    return [];
};

const sameId = (left, right) => Number(left) === Number(right);

const upsertComment = (comments, nextComment) => {
    const nextId = nextComment?.id;

    if (!nextId) {
        return [...comments, nextComment];
    }

    const exists = comments.some((comment) => sameId(comment.id, nextId));

    if (!exists) {
        return [...comments, nextComment];
    }

    return comments.map((comment) => (
        sameId(comment.id, nextId)
            ? { ...comment, ...nextComment, replies: nextComment.replies?.length ? nextComment.replies : getNestedReplies(comment) }
            : comment
    ));
};

const appendReply = (comments, parentId, reply) => {
    let inserted = false;

    const nextComments = comments.map((comment) => {
        if (sameId(comment.id, parentId)) {
            inserted = true;

            return {
                ...comment,
                replies: upsertComment(getNestedReplies(comment), reply)
            };
        }

        const replies = getNestedReplies(comment);

        if (replies.length === 0) {
            return comment;
        }

        const nested = appendReply(replies, parentId, reply);

        if (!nested.inserted) {
            return comment;
        }

        inserted = true;

        return {
            ...comment,
            replies: nested.comments
        };
    });

    return { comments: nextComments, inserted };
};

export const getCommentFromResponse = (response) => response?.comment || response?.data?.comment || response?.data || response;

export const normalizeCommentNode = (comment, fallback = {}, currentUser = null) => {
    const source = comment && typeof comment === 'object' ? comment : {};
    const replies = getNestedReplies(source).map((reply) => normalizeCommentNode(reply, {}, currentUser));

    return {
        ...fallback,
        ...source,
        id: source.id ?? fallback.id ?? `local-${Date.now()}`,
        body: source.body ?? fallback.body ?? '',
        course_id: source.course_id ?? fallback.course_id ?? null,
        task_id: source.task_id ?? fallback.task_id ?? null,
        discipline_id: source.discipline_id ?? fallback.discipline_id ?? null,
        file_id: source.file_id ?? fallback.file_id ?? null,
        parent_id: source.parent_id ?? fallback.parent_id ?? null,
        user_id: source.user_id ?? fallback.user_id ?? currentUser?.id ?? null,
        user: source.user || fallback.user || currentUser || null,
        created_at: source.created_at ?? fallback.created_at ?? new Date().toISOString(),
        replies
    };
};

export const addCommentToTree = (comments, comment) => {
    if (!comment?.parent_id) {
        return upsertComment(comments, comment);
    }

    const nextTree = appendReply(comments, comment.parent_id, comment);

    return nextTree.inserted ? nextTree.comments : comments;
};
