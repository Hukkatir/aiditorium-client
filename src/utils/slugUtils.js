export const SLUG_LETTERS_ERROR = 'slug должен содержать хотя бы одну букву';

export const slugifyPreview = (value) => {
    if (!value) return '';

    const translitMap = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
        и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
        с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
        ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
    };

    const transliterated = value
        .toLowerCase()
        .split('')
        .map((char) => translitMap[char] ?? char)
        .join('');

    return transliterated
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
};

export const slugHasLetters = (value) => /[a-z]/.test(slugifyPreview(value));

export const getSlugValidationError = (value) => {
    if (!String(value || '').trim()) return '';

    return slugHasLetters(value) ? '' : SLUG_LETTERS_ERROR;
};

export const getSafeSlug = (value) => {
    const slug = String(value || '').trim();

    return slug && slugHasLetters(slug) ? slug : '';
};
