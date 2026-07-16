import { describe, expect, it } from 'vitest';

import { assertInlineCertificatesOnly } from '../../../src/common/helpers/xray-config/certificate-security';
import { HttpResponseHeadersSchema } from '../../contract/models/http-response-headers.schema';
import { HttpOauthUrlSchema } from '../../contract/models/remnawave-settings/oauth2-settings.schema';
import { isSafePublicHeaderRegex } from '../../contract/models/response-rules/safe-regex';
import { getButtonLinkError, getHttpUrlError } from '../models/button-link.validator';
import { getCustomLinkUriError } from '../models/custom-link.validator';
import { sanitizeLocalizedHtml } from '../models/localized-html-sanitizer';
import { CustomLinkSchema } from '../models/subscription-page-config.schema';
import { sanitizeSvg } from '../models/svg-sanitizer';

const baseLink = {
    id: 'docs-link',
    enabled: true,
    displayName: { en: 'Documentation' },
    action: 'open' as const,
    order: 0,
};

describe('custom link URI validation', () => {
    it.each([
        'https://example.com/help',
        'http://example.com/help',
        'vless://user@example.com:443?security=tls#Example',
        'hysteria2://secret@example.com:443',
        'hy2://secret@example.com:443',
        'wireguard://example',
    ])('accepts an allowed URI: %s', (uri) => {
        expect(getCustomLinkUriError(uri)).toBeNull();
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        ' file:///etc/passwd',
        'blob:https://example.com/id',
        'https%253A%252F%252Fevil.example',
        'https://example.com/%3Cscript%3E',
        'https://example.com\r\nX-Injected: yes',
    ])('rejects an unsafe URI without echoing it: %s', (uri) => {
        const error = getCustomLinkUriError(uri);
        expect(error).not.toBeNull();
        expect(error).not.toContain(uri);
    });

    it('allows only the explicit template variables', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...baseLink,
                mode: 'template',
                uri: 'https://example.com/u/{{username}}?id={{shortUuid}}',
            }).success,
        ).toBe(true);

        expect(
            CustomLinkSchema.safeParse({
                ...baseLink,
                mode: 'template',
                uri: 'https://example.com/{{constructor}}',
            }).success,
        ).toBe(false);
    });
});

describe('SVG sanitization', () => {
    it('removes executable elements and event handlers', () => {
        const sanitized = sanitizeSvg(
            '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0h1v1z" onclick="alert(1)" /><script>alert(1)</script><foreignObject><iframe src="https://evil.example" /></foreignObject></svg>',
        );

        expect(sanitized).toContain('<svg');
        expect(sanitized).toContain('<path');
        expect(sanitized).not.toMatch(/script|foreignObject|iframe|onload|onclick/iu);
    });

    it('removes href, xlink, style and external-resource SVG payloads', () => {
        const sanitized = sanitizeSvg(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><style>@import url(https://example.invalid/x.css)</style><image href="javascript:alert(1)" xlink:href="data:text/html,test"/><a xlink:href="https://example.invalid"><path style="fill:url(https://example.invalid/x)" d="M0 0h1v1z"/></a></svg>',
        );

        expect(sanitized).toContain('<path');
        expect(sanitized).not.toMatch(
            /style|image|href|xlink|javascript:|data:text\/html|url\s*\(/iu,
        );
    });

    it('rejects document declarations and non-SVG roots', () => {
        expect(() => sanitizeSvg('<!DOCTYPE svg><svg />')).toThrow();
        expect(() => sanitizeSvg('<div>not svg</div>')).toThrow();
    });
});

describe('localized HTML and button URI hardening', () => {
    it('keeps narrow text formatting and removes executable or navigational markup', () => {
        const sanitized = sanitizeLocalizedHtml(
            '<strong>Safe</strong><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a><svg onload=alert(1) />',
        );
        expect(sanitized).toContain('<strong>Safe</strong>');
        expect(sanitized).toContain('link');
        expect(sanitized).not.toMatch(/img|onerror|href|javascript|svg|onload/iu);
    });

    it.each([
        ['https://example.com/download', 'external'],
        ['happ://add/{{SUBSCRIPTION_LINK}}', 'subscriptionLink'],
        ['stash://install-config?url={{SUBSCRIPTION_LINK}}', 'copyButton'],
    ] as const)('accepts safe button link %s', (link, type) => {
        expect(getButtonLinkError(link, type)).toBeNull();
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'https%253A%252F%252Fevil.invalid',
        'https://example.com/%0d%0aX-Injected:%20yes',
        ' https://example.com',
        'happ://add/{{UNKNOWN_TEMPLATE}}',
    ])('rejects unsafe button URI %s', (link) => {
        expect(getButtonLinkError(link, 'subscriptionLink')).not.toBeNull();
    });

    it('accepts only HTTP(S) branding links', () => {
        expect(getHttpUrlError('https://example.com/logo.svg')).toBeNull();
        expect(getHttpUrlError('javascript:alert(1)')).not.toBeNull();
        expect(getHttpUrlError('data:image/svg+xml,<svg/>')).not.toBeNull();
        expect(getHttpUrlError('file:///etc/passwd')).not.toBeNull();
    });
});

describe('response header and public regex hardening', () => {
    it.each([
        { 'X-Test': 'ok\r\nX-Injected: yes' },
        { 'Content-Length': '1' },
        { 'Transfer-Encoding': 'chunked' },
        { Connection: 'keep-alive' },
        { 'Set-Cookie': 'session=stolen' },
    ])('rejects dangerous response headers', (headers) => {
        expect(HttpResponseHeadersSchema.safeParse(headers).success).toBe(false);
    });

    it('allows a bounded custom response header', () => {
        expect(
            HttpResponseHeadersSchema.safeParse({ 'X-Client-Notice': 'test-marker' }).success,
        ).toBe(true);
    });

    it.each(['(a+)+$', '(a|aa)+$', '(.*)*$', '(?=a+)+', 'a'.repeat(129)])(
        'rejects unsafe public regex %s',
        (pattern) => expect(isSafePublicHeaderRegex(pattern)).toBe(false),
    );

    it.each(['^Happ/', '^MyClient\\/v[0-9]+$', '^[A-Za-z0-9._/-]{1,64}$'])(
        'allows bounded public regex %s',
        (pattern) => expect(isSafePublicHeaderRegex(pattern)).toBe(true),
    );
});

describe('API-supplied Xray config filesystem isolation', () => {
    it.each([
        { certificateFile: '/proc/self/environ' },
        { keyFile: 'C:\\Windows\\win.ini' },
        { certificateFile: '../../.env' },
    ])('rejects certificate file reference without reading it: %j', (certificate) => {
        expect(() => assertInlineCertificatesOnly([certificate])).toThrow(
            /certificateFile and keyFile are not allowed/u,
        );
    });

    it('accepts inline certificate material', () => {
        expect(() =>
            assertInlineCertificatesOnly([
                { certificate: ['TEST-CERTIFICATE-MARKER'], key: ['TEST-KEY-MARKER'] },
            ]),
        ).not.toThrow();
    });
});

describe('OAuth URL scheme validation', () => {
    it.each(['https://idp.example/oauth/token', 'http://127.0.0.1:8080/token'])(
        'accepts an explicit HTTP(S) endpoint %s',
        (value) => expect(HttpOauthUrlSchema.safeParse(value).success).toBe(true),
    );

    it.each([
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'gopher://127.0.0.1:6379/_PING',
        'https://user:password@idp.example/token',
        'https://idp.example/%0d%0aX-Test:%20yes',
    ])('rejects unsafe OAuth endpoint %s', (value) => {
        expect(HttpOauthUrlSchema.safeParse(value).success).toBe(false);
    });
});
