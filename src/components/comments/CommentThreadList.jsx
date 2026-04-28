import React, { useEffect, useMemo, useState } from 'react';
import { HiChatBubbleLeftEllipsis } from 'react-icons/hi2';
import CommentComposer from './CommentComposer';

const formatCommentDate = (dateString) => {
    if (!dateString) {
        return '-';
    }

    return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getReplies = (comment) => {
    if (Array.isArray(comment?.replies)) {
        return comment.replies;
    }

    if (Array.isArray(comment?.replies_recursive)) {
        return comment.replies_recursive;
    }

    return [];
};

const sortByCreatedAt = (left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0);

const VARIANT_STYLES = {
    default: {
        section: 'border-white/10 bg-[#16161C]',
        icon: 'text-slate-500',
        composer: 'border-white/10 bg-[#1A1A1C]',
        tree: 'border-white/[0.06] bg-black/[0.08]',
        scope: 'bg-white/[0.06] text-slate-300',
        trigger: 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]',
        dot: 'bg-slate-500'
    },
    public: {
        section: 'border-white/10 bg-[#16161C]',
        icon: 'text-purple-300',
        composer: 'border-white/10 bg-[#1A1A1C]',
        tree: 'border-purple-500/[0.12] bg-purple-950/[0.08]',
        scope: 'bg-purple-500/10 text-purple-200',
        trigger: 'border-purple-500/20 bg-purple-500/[0.08] text-purple-100 hover:bg-purple-500/[0.14]',
        dot: 'bg-purple-400'
    },
    private: {
        section: 'border-white/10 bg-[#16161C]',
        icon: 'text-slate-500',
        composer: 'border-white/10 bg-[#1A1A1C]',
        tree: 'border-white/[0.06] bg-black/[0.08]',
        scope: 'bg-white/[0.06] text-slate-300',
        trigger: 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]',
        dot: 'bg-slate-400'
    }
};

const CommentItem = ({
    comment,
    currentUserId,
    onReply,
    replyEnabled,
    styles,
    depth = 0
}) => {
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const replies = useMemo(() => [...getReplies(comment)].sort(sortByCreatedAt), [comment]);
    const isOwnComment = Number(comment.user_id) === Number(currentUserId);

    return (
        <div className={depth > 0 ? 'relative ml-4 border-l border-white/10 pl-4 sm:ml-6 sm:pl-5' : ''}>
            {depth > 0 && (
                <span className="absolute -left-px top-6 h-px w-4 bg-white/10 sm:w-5" />
            )}

            <article className="group py-3">
                <div className="flex items-start gap-3">
                    <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${depth === 0 ? styles.dot : 'bg-white/20'}`} />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-medium text-white">{comment.user?.name || 'Пользователь'}</span>
                            {isOwnComment && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">Вы</span>
                            )}
                            <span className="text-xs text-slate-500">{formatCommentDate(comment.created_at)}</span>
                            {comment.is_edited && <span className="text-xs text-slate-500">изменено</span>}
                        </div>

                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                            {comment.body || comment.content}
                        </p>

                        {replyEnabled && onReply && (
                            <div className="mt-2">
                                {!isReplyOpen ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsReplyOpen(true)}
                                        className="text-xs font-medium text-slate-500 transition hover:text-purple-200"
                                    >
                                        Ответить
                                    </button>
                                ) : (
                                    <div className={`mt-3 max-w-2xl rounded-xl border p-3 ${styles.composer}`}>
                                        <CommentComposer
                                            compact
                                            placeholder="Напишите ответ..."
                                            submitLabel="Отправить"
                                            onSubmit={async (body) => {
                                                await onReply(comment, body);
                                                setIsReplyOpen(false);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </article>

            {replies.length > 0 && (
                <div className="space-y-1">
                    {replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            currentUserId={currentUserId}
                            onReply={onReply}
                            replyEnabled={replyEnabled}
                            styles={styles}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CommentThreadList = ({
    title,
    description,
    comments = [],
    currentUserId,
    onCreate,
    onReply,
    emptyMessage,
    createPlaceholder,
    createLabel,
    loading = false,
    replyEnabled = true,
    disabled = false,
    variant = 'default',
    scopeLabel = '',
    composerMode = 'always',
    composerPosition = 'top',
    composerTriggerLabel = 'Добавить комментарий',
    hideEmptyState = false
}) => {
    const sortedComments = useMemo(() => [...comments].sort(sortByCreatedAt), [comments]);
    const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
    const [isComposerOpen, setIsComposerOpen] = useState(composerMode === 'always');
    const hasComments = sortedComments.length > 0;

    useEffect(() => {
        setIsComposerOpen(composerMode === 'always');
    }, [composerMode]);

    const composerBlock = onCreate ? (
        composerMode === 'toggle' ? (
            isComposerOpen ? (
                <div className={`rounded-xl border p-4 ${styles.composer}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Новый комментарий</p>
                        <button
                            type="button"
                            onClick={() => setIsComposerOpen(false)}
                            className="text-sm text-slate-500 transition hover:text-white"
                        >
                            Скрыть
                        </button>
                    </div>
                    <CommentComposer
                        placeholder={createPlaceholder}
                        submitLabel={createLabel}
                        onSubmit={async (body) => {
                            await onCreate(body);
                            setIsComposerOpen(false);
                        }}
                        disabled={disabled}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsComposerOpen(true)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${styles.trigger}`}
                >
                    <HiChatBubbleLeftEllipsis className="h-4 w-4" />
                    {composerTriggerLabel}
                </button>
            )
        ) : (
            <div className={`rounded-xl border p-4 ${styles.composer}`}>
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Новое сообщение</p>
                <CommentComposer
                    placeholder={createPlaceholder}
                    submitLabel={createLabel}
                    onSubmit={onCreate}
                    disabled={disabled}
                />
            </div>
        )
    ) : null;

    const commentsBlock = hasComments ? (
        <div className={`rounded-xl border px-3 sm:px-4 ${styles.tree}`}>
            <div className="divide-y divide-white/[0.06]">
                {sortedComments.map((comment) => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={currentUserId}
                        onReply={onReply}
                        replyEnabled={replyEnabled}
                        styles={styles}
                    />
                ))}
            </div>
            {loading && (
                <p className="border-t border-white/[0.06] py-3 text-xs text-slate-500">Обновляем комментарии...</p>
            )}
        </div>
    ) : loading ? (
        <div className="py-6 text-center text-sm text-slate-500">Загружаем комментарии...</div>
    ) : hideEmptyState ? null : (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            {emptyMessage}
        </div>
    );

    return (
        <section className={`rounded-2xl border p-5 ${styles.section}`}>
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <HiChatBubbleLeftEllipsis className={`h-4 w-4 ${styles.icon}`} />
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                        {scopeLabel && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles.scope}`}>
                                {scopeLabel}
                            </span>
                        )}
                    </div>
                    {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
                </div>
            </div>

            <div className="space-y-4">
                {composerPosition === 'top' && composerBlock}
                {commentsBlock}
                {composerPosition === 'bottom' && composerBlock}
            </div>
        </section>
    );
};

export default CommentThreadList;
