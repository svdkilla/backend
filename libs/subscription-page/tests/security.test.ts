import { describe, expect, it } from 'vitest';

import { getCustomLinkUriError } from '../models/custom-link.validator';
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

    it('rejects document declarations and non-SVG roots', () => {
        expect(() => sanitizeSvg('<!DOCTYPE svg><svg />')).toThrow();
        expect(() => sanitizeSvg('<div>not svg</div>')).toThrow();
    });
});
