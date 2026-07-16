import { BLOCKED_CUSTOM_LINK_SCHEMES, MAX_CUSTOM_LINK_URI_LENGTH } from '../constants';

const HTML_DELIMITERS = /[<>]/u;

const hasControlCharacters = (value: string): boolean =>
    Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
    });
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const PERCENT_ESCAPE_PATTERN = /%[0-9A-Fa-f]{2}/u;

const blockedSchemes = new Set<string>(BLOCKED_CUSTOM_LINK_SCHEMES);

const getDecodedVariants = (value: string): string[] | null => {
    const variants = [value];

    if (!value.includes('%')) return variants;

    try {
        const once = decodeURIComponent(value);
        variants.push(once);

        if (PERCENT_ESCAPE_PATTERN.test(once)) {
            const twice = decodeURIComponent(once);
            if (twice !== once) {
                return null;
            }
        }

        return variants;
    } catch {
        return null;
    }
};

const hasUnsafeCharacters = (value: string): boolean =>
    hasControlCharacters(value) || HTML_DELIMITERS.test(value);

export const getCustomLinkUriError = (rawValue: string): string | null => {
    if (rawValue.length === 0) return 'URI is required';
    if (rawValue.length > MAX_CUSTOM_LINK_URI_LENGTH) {
        return `URI must not exceed ${MAX_CUSTOM_LINK_URI_LENGTH} characters`;
    }
    if (rawValue !== rawValue.trim()) return 'URI must not have leading or trailing whitespace';

    const decodedVariants = getDecodedVariants(rawValue);
    if (!decodedVariants) return 'URI contains malformed or ambiguous percent-encoding';

    for (const variant of decodedVariants) {
        if (hasUnsafeCharacters(variant)) return 'URI contains unsafe characters or markup';
        if (/^\s+[A-Za-z][A-Za-z0-9+.-]*:/u.test(variant)) {
            return 'URI must not contain whitespace before its scheme';
        }
    }

    const schemeMatch = SCHEME_PATTERN.exec(rawValue);
    if (!schemeMatch) return 'URI must start with an explicit allowed scheme';

    const scheme = schemeMatch[1]!.toLowerCase();
    if (blockedSchemes.has(scheme)) return `URI scheme '${scheme}' is not allowed`;

    if (scheme === 'http' || scheme === 'https') {
        try {
            const parsed = new URL(rawValue);
            if (parsed.protocol !== `${scheme}:` || !parsed.hostname) {
                return 'HTTP(S) URI must contain a valid host';
            }
        } catch {
            return 'HTTP(S) URI is invalid';
        }
    } else {
        const payload = rawValue.slice(schemeMatch[0].length);
        if (!payload || /\s/u.test(payload) || hasUnsafeCharacters(payload)) {
            return 'VPN URI must contain a non-empty payload without whitespace or markup';
        }
    }

    return null;
};

export const containsHtmlMarkup = (value: string): boolean => HTML_DELIMITERS.test(value);
