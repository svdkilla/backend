import DOMPurify from 'isomorphic-dompurify';

export const MAX_LOCALIZED_HTML_LENGTH = 4_096;

const ALLOWED_LOCALIZED_HTML_TAGS = [
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'code',
    'kbd',
    'p',
    'ul',
    'ol',
    'li',
    'span',
] as const;

/**
 * Localized guide text intentionally supports a small amount of formatting.
 * Links, styles, media and all attributes are excluded so this HTML cannot
 * become an executable or navigation-capable payload.
 */
export const sanitizeLocalizedHtml = (source: string): string =>
    DOMPurify.sanitize(source, {
        ALLOWED_TAGS: [...ALLOWED_LOCALIZED_HTML_TAGS],
        ALLOWED_ATTR: [],
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: [
            'script',
            'style',
            'svg',
            'math',
            'iframe',
            'object',
            'embed',
            'form',
            'input',
            'button',
            'a',
            'img',
        ],
    });
