import React, { useState } from 'react';

const CommentComposer = ({
    placeholder,
    submitLabel,
    onSubmit,
    disabled = false,
    compact = false
}) => {
    const [value, setValue] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const body = value.trim();

        if (!body || disabled || submitting) {
            return;
        }

        setSubmitting(true);

        try {
            await onSubmit(body);
            setValue('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                rows={compact ? 3 : 4}
                disabled={disabled || submitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500 focus:bg-white/[0.06] disabled:opacity-60"
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={disabled || submitting || !value.trim()}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {submitting ? 'Отправка...' : submitLabel}
                </button>
            </div>
        </form>
    );
};

export default CommentComposer;
