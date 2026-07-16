import { TButtonType } from '../constants';

export const MAX_BUTTON_LINK_LENGTH = 4_096;

const HTTP_SCHEMES = new Set(['http', 'https']);
const SUBSCRIPTION_APP_SCHEMES = new Set([
    ...HTTP_SCHEMES,
    'clashmeta',
    'flclashx',
    'happ',
    'hiddify',
    'incy',
    'koala-clash',
    'prizrak-box',
    'shadowrocket',
    'stash',
    'streisand',
    'v2rayng',
]);
const TEMPLATE_VALUES: Record<string, string> = {
    USERNAME: 'test-user',
    SUBSCRIPTION_LINK: 'https://subscription.invalid/test-marker',
    HAPP_CRYPT3_LINK: 'happ://crypt3/test-marker',
    HAPP_CRYPT4_LINK: 'happ://crypt4/test-marker',
};
const TEMPLATE_PATTERN = /\{\{(\w+)\}\}/gu;
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/u;

const hasUnsafeCharacters = (value: string): boolean =>
    [...value].some((character) => {
        const code = character.charCodeAt(0);
        return character === '<' || character === '>' || code <= 0x1f || code === 0x7f;
    });

const validateDecodedVariants = (value: string): boolean => {
    if (!value.includes('%')) return !hasUnsafeCharacters(value);

    try {
        const once = decodeURIComponent(value);
        if (hasUnsafeCharacters(once)) return false;
        if (/%[0-9A-Fa-f]{2}/u.test(once) && decodeURIComponent(once) !== once) return false;
        return true;
    } catch {
        return false;
    }
};

export const getButtonLinkError = (rawValue: string, type: TButtonType): string | null => {
    if (!rawValue) return 'Button URI is required';
    if (rawValue.length > MAX_BUTTON_LINK_LENGTH) return 'Button URI is too long';
    if (rawValue !== rawValue.trim()) return 'Button URI must not have surrounding whitespace';
    if (!validateDecodedVariants(rawValue)) {
        return 'Button URI contains unsafe or ambiguous encoding';
    }

    let hasUnknownTemplate = false;
    const value = rawValue.replace(TEMPLATE_PATTERN, (_match, key: string) => {
        const replacement = TEMPLATE_VALUES[key];
        if (!replacement) {
            hasUnknownTemplate = true;
            return 'invalid-template-value';
        }
        return replacement;
    });
    if (hasUnknownTemplate || value.includes('{{') || value.includes('}}')) {
        return 'Button URI contains an unsupported template variable';
    }

    const schemeMatch = SCHEME_PATTERN.exec(value);
    if (!schemeMatch) return 'Button URI must use an explicit scheme';
    const scheme = schemeMatch[1]!.toLowerCase();
    const allowedSchemes = type === 'external' ? HTTP_SCHEMES : SUBSCRIPTION_APP_SCHEMES;
    if (!allowedSchemes.has(scheme)) return `Button URI scheme '${scheme}' is not allowed`;

    if (HTTP_SCHEMES.has(scheme)) {
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== `${scheme}:` || !parsed.hostname) {
                return 'Button HTTP(S) URI must contain a valid host';
            }
        } catch {
            return 'Button HTTP(S) URI is invalid';
        }
    } else if (!value.slice(schemeMatch[0].length)) {
        return 'Button app URI must contain a non-empty payload';
    }

    return null;
};

export const getHttpUrlError = (value: string, allowEmpty = false): string | null => {
    if (allowEmpty && value === '') return null;
    if (!value || value.length > MAX_BUTTON_LINK_LENGTH || value !== value.trim()) {
        return 'URL must be a non-empty HTTP(S) URL without surrounding whitespace';
    }
    if (!validateDecodedVariants(value)) return 'URL contains unsafe or ambiguous encoding';

    try {
        const parsed = new URL(value);
        if (!HTTP_SCHEMES.has(parsed.protocol.slice(0, -1)) || !parsed.hostname) {
            return 'Only HTTP(S) URLs are allowed';
        }
    } catch {
        return 'URL is invalid';
    }
    return null;
};
