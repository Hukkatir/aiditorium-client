const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI']);

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeNode = (documentRef, node) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return documentRef.createTextNode(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return documentRef.createDocumentFragment();
    }

    const tagName = node.tagName.toUpperCase();

    if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = documentRef.createDocumentFragment();
        Array.from(node.childNodes).forEach((child) => {
            fragment.appendChild(sanitizeNode(documentRef, child));
        });
        return fragment;
    }

    if (tagName === 'BR') {
        return documentRef.createElement('br');
    }

    const normalizedTag = tagName === 'B' ? 'strong'
        : tagName === 'I' ? 'em'
            : tagName === 'STRIKE' ? 's'
                : tagName.toLowerCase();

    const cleanElement = documentRef.createElement(normalizedTag);

    Array.from(node.childNodes).forEach((child) => {
        cleanElement.appendChild(sanitizeNode(documentRef, child));
    });

    return cleanElement;
};

export const sanitizeRichText = (html = '') => {
    if (!html) {
        return '';
    }

    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return escapeHtml(html);
    }

    const parser = new DOMParser();
    const documentRef = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const sourceRoot = documentRef.body.firstElementChild;
    const cleanContainer = documentRef.createElement('div');

    Array.from(sourceRoot?.childNodes || []).forEach((child) => {
        cleanContainer.appendChild(sanitizeNode(documentRef, child));
    });

    return cleanContainer.innerHTML
        .replace(/(<(div|p)><br><\/(div|p)>)/g, '<p><br></p>')
        .trim();
};

export const getPlainTextFromRichText = (html = '') => {
    if (!html) {
        return '';
    }

    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
        return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const parser = new DOMParser();
    const documentRef = parser.parseFromString(sanitizeRichText(html), 'text/html');

    return (documentRef.body.textContent || '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

export const hasRichTextContent = (html = '') => Boolean(getPlainTextFromRichText(html));

export const getRichTextExcerpt = (html = '', maxLength = 180) => {
    const plainText = getPlainTextFromRichText(html);

    if (plainText.length <= maxLength) {
        return plainText;
    }

    return `${plainText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};
