import React, { useMemo, useState } from 'react';
import { HiChatBubbleLeftEllipsis } from 'react-icons/hi2';
import CommentComposer from './CommentComposer';

const formatCommentDate = (dateString) => {
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

const CommentItem = ({ comment, currentUserId, onReply, replyEnabled }) => {
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const replies = useMemo(
        () => [...(comment.replies || [])].sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
        [comment.replies]
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{comment.user?.name || 'Пользователь'}</span>
                {comment.user_id === currentUserId && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-200">Вы</span>
                )}
                <span className="text-xs text-gray-500">{formatCommentDate(comment.created_at)}</span>
                {comment.is_edited && <span className="text-xs text-gray-500">изменено</span>}
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-200">{comment.body}</p>

            {replyEnabled && (
                <div className="mt-4">
                    {!isReplyOpen ? (
                        <button
                            type="button"
                            onClick={() => setIsReplyOpen(true)}
                            className="text-sm text-purple-300 transition hover:text-purple-200"
                        >
                            Ответить
                        </button>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <CommentComposer
                                compact
                                placeholder="Напишите ответ..."
                                submitLabel="Отправить ответ"
                                onSubmit={async (body) => {
                                    await onReply(comment, body);
                                    setIsReplyOpen(false);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {replies.length > 0 && (
                <div className="mt-4 space-y-3 border-l border-white/10 pl-4">
                    {replies.map((reply) => (
                        <div key={reply.id} className="rounded-2xl bg-black/20 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-white">{reply.user?.name || 'Пользователь'}</span>
                                {reply.user_id === currentUserId && (
                                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-200">Вы</span>
                                )}
                                <span className="text-xs text-gray-500">{formatCommentDate(reply.created_at)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-200">{reply.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CommentThreadList = ({
    title,
    description,
    comments,
    currentUserId,
    onCreate,
    onReply,
    emptyMessage,
    createPlaceholder,
    createLabel,
    loading = false,
    replyEnabled = true,
    disabled = false
}) => {
    const sortedComments = useMemo(
        () => [...comments].sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
        [comments]
    );

    return (
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-5 flex items-start gap-3">
                <div className="rounded-2xl bg-purple-600/15 p-3 text-purple-300">
                    <HiChatBubbleLeftEllipsis className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-white">{title}</h2>
                    {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
                </div>
            </div>

            <div className="space-y-4">
                <CommentComposer
                    placeholder={createPlaceholder}
                    submitLabel={createLabel}
                    onSubmit={onCreate}
                    disabled={disabled}
                />

                {loading ? (
                    <div className="py-8 text-center text-sm text-gray-500">Загружаем комментарии...</div>
                ) : sortedComments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">
                        {emptyMessage}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sortedComments.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                currentUserId={currentUserId}
                                onReply={onReply}
                                replyEnabled={replyEnabled}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default CommentThreadList;
