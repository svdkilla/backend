import { z } from 'zod';

export const MAX_CUSTOM_RESPONSE_HEADERS = 64;
export const MAX_CUSTOM_RESPONSE_HEADER_VALUE_LENGTH = 8_192;

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/u;
const FORBIDDEN_RESPONSE_HEADER_NAMES = new Set([
    'connection',
    'content-length',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'set-cookie',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

const hasForbiddenHeaderValueCharacter = (value: string): boolean =>
    [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x08 || (code >= 0x0a && code <= 0x1f) || code === 0x7f;
    });

export const isSafeHttpResponseHeader = (name: string, value: string): boolean =>
    HEADER_NAME_PATTERN.test(name) &&
    !FORBIDDEN_RESPONSE_HEADER_NAMES.has(name.toLowerCase()) &&
    value.length > 0 &&
    value.length <= MAX_CUSTOM_RESPONSE_HEADER_VALUE_LENGTH &&
    !hasForbiddenHeaderValueCharacter(value);

export const HttpResponseHeaderNameSchema = z
    .string()
    .regex(HEADER_NAME_PATTERN, 'Invalid HTTP response header name')
    .refine(
        (name) => !FORBIDDEN_RESPONSE_HEADER_NAMES.has(name.toLowerCase()),
        'Hop-by-hop, framing, authentication, and cookie headers cannot be overridden',
    );

export const HttpResponseHeaderValueSchema = z
    .string()
    .min(1, 'Header value is required')
    .max(MAX_CUSTOM_RESPONSE_HEADER_VALUE_LENGTH, 'Header value is too long')
    .refine(
        (value) => !hasForbiddenHeaderValueCharacter(value),
        'Header value contains prohibited control characters',
    );

export const HttpResponseHeaderEntrySchema = z.object({
    key: HttpResponseHeaderNameSchema,
    value: HttpResponseHeaderValueSchema,
});

export const HttpResponseHeadersSchema = z
    .record(HttpResponseHeaderNameSchema, HttpResponseHeaderValueSchema)
    .refine((headers) => Object.keys(headers).length <= MAX_CUSTOM_RESPONSE_HEADERS, {
        message: `No more than ${MAX_CUSTOM_RESPONSE_HEADERS} custom response headers are allowed`,
    });

export const filterHttpResponseHeaders = (
    headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> =>
    Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string | string[]] => {
            const [name, value] = entry;
            if (value === undefined) return false;
            return Array.isArray(value)
                ? value.every((item) => isSafeHttpResponseHeader(name, item))
                : isSafeHttpResponseHeader(name, value);
        }),
    );
