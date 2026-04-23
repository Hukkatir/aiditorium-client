import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiBold, HiItalic, HiStrikethrough, HiUnderline } from 'react-icons/hi2';
import { getPlainTextFromRichText, sanitizeRichText } from '../../utils/richText';

const TOOLBAR_ACTIONS = [
    { command: 'bold', label: 'Жирный', icon: HiBold },
    { command: 'italic', label: 'Курсив', icon: HiItalic },
    { command: 'underline', label: 'Подчеркнутый', icon: HiUnderline },
    { command: 'strikeThrough', label: 'Зачеркнутый', icon: HiStrikethrough }
];

const RichTextEditor = ({
    id,
    label,
    value,
    onChange,
    placeholder = 'Введите текст',
    error = '',
    minHeightClassName = 'min-h-[220px]'
}) => {
    const editorRef = useRef(null);
    const [activeCommands, setActiveCommands] = useState({});

    const plainText = useMemo(() => getPlainTextFromRichText(value), [value]);

    useEffect(() => {
        if (!editorRef.current) {
            return;
        }

        const normalizedValue = sanitizeRichText(value || '');
        if (editorRef.current.innerHTML !== normalizedValue) {
            editorRef.current.innerHTML = normalizedValue;
        }
    }, [value]);

    useEffect(() => {
        const updateToolbarState = () => {
            if (typeof document === 'undefined') {
                return;
            }

            const selection = window.getSelection();
            const root = editorRef.current;

            if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) {
                setActiveCommands({});
                return;
            }

            setActiveCommands({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strikeThrough: document.queryCommandState('strikeThrough')
            });
        };

        document.addEventListener('selectionchange', updateToolbarState);
        return () => document.removeEventListener('selectionchange', updateToolbarState);
    }, []);

    const emitChange = () => {
        if (!editorRef.current) {
            return;
        }

        onChange(sanitizeRichText(editorRef.current.innerHTML));
    };

    const handleToolbarAction = (command) => {
        if (typeof document === 'undefined') {
            return;
        }

        editorRef.current?.focus();
        document.execCommand(command, false);
        emitChange();
    };

    const handlePaste = (event) => {
        event.preventDefault();

        const plain = event.clipboardData?.getData('text/plain') || '';
        if (!plain) {
            return;
        }

        document.execCommand('insertText', false, plain);
        emitChange();
    };

    return (
        <div>
            {label && (
                <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-300">
                    {label}
                </label>
            )}

            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111522] shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
                <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/[0.04] p-3">
                    {TOOLBAR_ACTIONS.map((action) => {
                        const Icon = action.icon;
                        const isActive = Boolean(activeCommands[action.command]);

                        return (
                            <button
                                key={action.command}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleToolbarAction(action.command)}
                                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                                    isActive
                                        ? 'bg-purple-600 text-white shadow-[0_10px_24px_rgba(124,58,237,0.32)]'
                                        : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] hover:text-white'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {action.label}
                            </button>
                        );
                    })}
                </div>

                <div className={`relative ${minHeightClassName}`}>
                    {!plainText && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 px-5 py-4 text-slate-500">
                            {placeholder}
                        </div>
                    )}

                    <div
                        id={id}
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={emitChange}
                        onPaste={handlePaste}
                        className={`relative z-10 w-full px-5 py-4 text-base leading-7 text-white outline-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through ${minHeightClassName}`}
                    />
                </div>
            </div>

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
    );
};

export default RichTextEditor;
