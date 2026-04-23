import React, { useEffect, useMemo, useState } from 'react';
import { HiChatBubbleLeftEllipsis } from 'react-icons/hi2';
import CommentComposer from './CommentComposer';

const formatCommentDate = (dateString) => {
    if (!dateString) {
        return 'вЂ”';
    }

    return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const VARIANT_STYLES = {
    default: {
        section: 'border-white/10 bg-white/[0.03]',
        icon: 'bg-white/[0.06] text-slate-300',
        composer: 'border-white/10 bg-white/[0.03]',
        card: 'border-white/10 bg-black/15',
        reply: 'border-white/10 bg-black/20',
        scope: 'bg-white/[0.06] text-slate-300',
        trigger: 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
    },
    public: {
        section: 'border-white/10 bg-white/[0.03]',
        icon: 'bg-purple-500/14 text-purple-100',
        composer: 'border-purple-500/20 bg-purple-500/[0.06]',
        card: 'border-white/10 bg-black/15',
        reply: 'border-white/10 bg-black/20',
        scope: 'bg-purple-500/14 text-purple-100',
        trigger: 'border-purple-500/20 bg-purple-500/[0.08] text-purple-100 hover:bg-purple-500/[0.14]'
    },
    private: {
        section: 'border-white/10 bg-white/[0.03]',
        icon: 'bg-white/[0.06] text-slate-300',
        composer: 'border-white/10 bg-white/[0.03]',
        card: 'border-white/10 bg-black/15',
        reply: 'border-white/10 bg-black/20',
        scope: 'bg-white/[0.06] text-slate-300',
        trigger: 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
    }
};

const CommentItem = ({ comment, currentUserId, onReply, replyEnabled, styles }) => {
    const [isReplyOpen, setIsReplyOpen] = useState(false);
    const replies = useMemo(
        () => [...(comment.replies || [])].sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
        [comment.replies]
    );

    return (
        <div className={`rounded-2xl border p-4 ${styles.card}`}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{comment.user?.name || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}</span>
                {comment.user_id === currentUserId && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">Р’С‹</span>
                )}
                <span className="text-xs text-slate-500">{formatCommentDate(comment.created_at)}</span>
                {comment.is_edited && <span className="text-xs text-slate-500">РёР·РјРµРЅРµРЅРѕ</span>}
            </div>

            <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.body}</p>

            {replyEnabled && (
                <div className="mt-4">
                    {!isReplyOpen ? (
                        <button
                            type="button"
                            onClick={() => setIsReplyOpen(true)}
                            className="text-sm text-slate-400 transition hover:text-white"
                        >
                            РћС‚РІРµС‚РёС‚СЊ
                        </button>
                    ) : (
                        <div className={`rounded-2xl border p-3 ${styles.composer}`}>
                            <CommentComposer
                                compact
                                placeholder="РќР°РїРёС€РёС‚Рµ РѕС‚РІРµС‚..."
                                submitLabel="РћС‚РїСЂР°РІРёС‚СЊ"
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
                        <div key={reply.id} className={`rounded-2xl border p-3 ${styles.reply}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-white">{reply.user?.name || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}</span>
                                {reply.user_id === currentUserId && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">Р’С‹</span>
                                )}
                                <span className="text-xs text-slate-500">{formatCommentDate(reply.created_at)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{reply.body}</p>
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
    disabled = false,
    variant = 'default',
    scopeLabel = '',
    composerMode = 'always',
    composerPosition = 'top',
    composerTriggerLabel = 'Р”РѕР±Р°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№'
}) => {
    const sortedComments = useMemo(
        () => [...comments].sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
        [comments]
    );
    const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
    const [isComposerOpen, setIsComposerOpen] = useState(composerMode === 'always');

    useEffect(() => {
        setIsComposerOpen(composerMode === 'always');
    }, [composerMode]);

    const composerBlock = onCreate ? (
        composerMode === 'toggle' ? (
            isComposerOpen ? (
                <div className={`rounded-2xl border p-4 ${styles.composer}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">РќРѕРІС‹Р№ РєРѕРјРјРµРЅС‚Р°СЂРёР№</p>
                        <button
                            type="button"
                            onClick={() => setIsComposerOpen(false)}
                            className="text-sm text-slate-400 transition hover:text-white"
                        >
                            РЎРєСЂС‹С‚СЊ
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
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${styles.trigger}`}
                >
                    <HiChatBubbleLeftEllipsis className="h-4 w-4" />
                    {composerTriggerLabel}
                </button>
            )
        ) : (
            <div className={`rounded-2xl border p-4 ${styles.composer}`}>
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">РќРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ</p>
                <CommentComposer
                    placeholder={createPlaceholder}
                    submitLabel={createLabel}
                    onSubmit={onCreate}
                    disabled={disabled}
                />
            </div>
        )
    ) : null;

    const commentsBlock = loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Р—Р°РіСЂСѓР¶Р°РµРј РєРѕРјРјРµРЅС‚Р°СЂРёРё...</div>
    ) : sortedComments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
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
                    styles={styles}
                />
            ))}
        </div>
    );

    return (
        <section className={`rounded-[28px] border p-5 ${styles.section}`}>
            <div className="mb-5 flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${styles.icon}`}>
                    <HiChatBubbleLeftEllipsis className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                        {scopeLabel && (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles.scope}`}>
                                {scopeLabel}
                            </span>
                        )}
                    </div>
                    {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
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
