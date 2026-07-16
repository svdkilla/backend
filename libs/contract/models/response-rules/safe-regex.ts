const MAX_REGEX_LENGTH = 128;

/**
 * Deliberately conservative guard for regexes evaluated against public HTTP
 * headers. It rejects nested quantifiers, quantified alternations, lookarounds
 * and backreferences, which are the common sources of catastrophic backtracking.
 */
export const isSafePublicHeaderRegex = (pattern: string): boolean => {
    if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;

    try {
        new RegExp(pattern);
    } catch {
        return false;
    }

    const normalized = pattern.replace(/\\./gu, '').replace(/\[[^\]]*\]/gu, 'x');
    if (/\\[1-9]/u.test(pattern) || /\(\?[=!<]/u.test(normalized)) return false;
    if (/(?:\*|\+|\?|\{\d+(?:,\d*)?\})(?:\s*)(?:\*|\+|\?|\{)/u.test(normalized)) {
        return false;
    }
    if (/\([^)]*(?:\*|\+|\{\d+(?:,\d*)?\})[^)]*\)(?:\*|\+|\{)/u.test(normalized)) {
        return false;
    }
    if (/\([^)]*\|[^)]*\)(?:\*|\+|\{)/u.test(normalized)) return false;

    return true;
};
