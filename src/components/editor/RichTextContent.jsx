import React, { useMemo } from 'react';
import { hasRichTextContent, sanitizeRichText } from '../../utils/richText';

const CONTENT_CLASS_NAME = [
    'text-slate-200',
    'leading-7',
    '[&_p]:mb-4',
    '[&_p:last-child]:mb-0',
    '[&_strong]:font-semibold',
    '[&_em]:italic',
    '[&_u]:underline',
    '[&_s]:line-through',
    '[&_ul]:mb-4',
    '[&_ol]:mb-4',
    '[&_ul]:pl-5',
    '[&_ol]:pl-5',
    '[&_li]:mb-2',
    '[&_ul>li]:list-disc',
    '[&_ol>li]:list-decimal'
].join(' ');

const RichTextContent = ({
    value,
    fallback = 'Текст пока не заполнен.',
    className = ''
}) => {
    const safeHtml = useMemo(() => sanitizeRichText(value || ''), [value]);

    if (!hasRichTextContent(safeHtml)) {
        return <p className={className}>{fallback}</p>;
    }

    return (
        <div
            className={`${CONTENT_CLASS_NAME} ${className}`.trim()}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
    );
};

export default RichTextContent;
