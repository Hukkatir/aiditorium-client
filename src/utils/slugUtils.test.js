import { getCourseIdentifier, getDisciplineIdentifier } from './routeUtils';
import { getSlugValidationError, slugHasLetters } from './slugUtils';

test('rejects numeric-only slugs after normalization', () => {
    expect(slugHasLetters('123 456')).toBe(false);
    expect(getSlugValidationError('123 456')).toBe('slug должен содержать хотя бы одну букву');
});

test('accepts slugs that keep at least one letter after transliteration', () => {
    expect(slugHasLetters('Ремонт кухни 2026')).toBe(true);
    expect(getSlugValidationError('Ремонт кухни 2026')).toBe('');
});

test('falls back to id when stored slug is numeric-only', () => {
    expect(getCourseIdentifier({ id: 42, slug: '123' })).toBe('42');
    expect(getDisciplineIdentifier({ id: 7, slug: '456' })).toBe('7');
});
