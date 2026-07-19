import { describe, expect, it } from 'vitest';

import { assertSafeCertificateFileReferences } from '../../../src/common/helpers/xray-config/certificate-security';
import { DEFAULT_SUBPAGE_CONFIG } from '../../../src/modules/subscription-page-configs/constants';
import { convertCustomVlessLinkToXrayJson } from '../../../src/modules/subscription-template/generators/custom-vless-xray-json.converter';
import { XrayGeneratorService } from '../../../src/modules/subscription-template/generators/xray.generator.service';
import { shouldIncludeCustomSubscriptionLinks } from '../../../src/modules/subscription/utils/should-include-custom-subscription-links';
import { USERS_STATUS } from '../../contract/constants';
import { HttpResponseHeadersSchema } from '../../contract/models/http-response-headers.schema';
import { HttpOauthUrlSchema } from '../../contract/models/remnawave-settings/oauth2-settings.schema';
import { isSafePublicHeaderRegex } from '../../contract/models/response-rules/safe-regex';
import { getButtonLinkError, getHttpUrlError } from '../models/button-link.validator';
import { getCustomLinkUriError } from '../models/custom-link.validator';
import { resolveCustomSubscriptionLinks } from '../models/custom-subscription-links.resolver';
import { sanitizeLocalizedHtml } from '../models/localized-html-sanitizer';
import { CustomLinkSchema } from '../models/subscription-page-config.schema';
import { SubscriptionPageRawConfigSchema } from '../models/subscription-page-config.schema';
import { sanitizeSvg } from '../models/svg-sanitizer';

const baseLink = {
    id: 'docs-link',
    enabled: true,
    displayName: { en: 'Documentation' },
    action: 'open' as const,
    order: 0,
    internalSquadUuids: [],
};

describe('custom link URI validation', () => {
    it.each([
        'https://example.com/help',
        'http://example.com/help',
        'vless://user@example.com:443?security=tls#Example',
        'hysteria2://secret@example.com:443',
        'hy2://secret@example.com:443',
        'wg://opaque-custom-payload#WireGuard',
        'awg://opaque-custom-payload#AmneziaWG',
        'myvpn+test://anything-the-client-understands#Custom',
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

    it('does not accept the removed personalized-template mode', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...baseLink,
                mode: 'template',
                uri: 'https://example.com/u/{{username}}?id={{shortUuid}}',
            }).success,
        ).toBe(false);
    });

    it('drops removed legacy selectors without rejecting the remaining page config', () => {
        const parsed = SubscriptionPageRawConfigSchema.parse({
            ...DEFAULT_SUBPAGE_CONFIG,
            customLinks: [
                {
                    ...baseLink,
                    mode: 'subscriptionLinks',
                    protocol: 'vless',
                    uri: 'https://',
                },
                {
                    ...baseLink,
                    id: 'website',
                    displayName: {
                        en: 'Documentation',
                        fa: 'Documentation',
                        fr: 'Documentation',
                        ru: 'Documentation',
                        zh: 'Documentation',
                    },
                    mode: 'literal',
                    order: 1,
                    uri: 'https://example.com/help',
                },
            ],
        });

        expect(parsed.customLinks).toHaveLength(1);
        expect(parsed.customLinks[0]?.id).toBe('website');
    });

    it('keeps a complete legacy connection URI and removes only its obsolete selector', () => {
        const parsed = SubscriptionPageRawConfigSchema.parse({
            ...DEFAULT_SUBPAGE_CONFIG,
            customLinks: [
                {
                    ...baseLink,
                    mode: 'subscriptionLinks',
                    protocol: 'vless',
                    uri: 'vless://test-marker@example.com:443#Legacy',
                },
            ],
        });

        expect(parsed.customLinks).toHaveLength(1);
        expect(parsed.customLinks[0]?.uri).toBe('vless://test-marker@example.com:443#Legacy');
        expect(parsed.customLinks[0]).not.toHaveProperty('protocol');
    });

    it('adds only enabled VPN links to the main subscription list', () => {
        const links = resolveCustomSubscriptionLinks([
            {
                ...baseLink,
                id: 'website',
                mode: 'literal',
                uri: 'https://example.com/help',
            },
            {
                id: 'custom-server-without-ui-metadata',
                enabled: true,
                displayName: {},
                action: 'copy',
                order: 1,
                mode: 'subscriptionLinks',
                uri: 'awg://opaque-payload#Custom-AWG',
                internalSquadUuids: [],
            },
            {
                ...baseLink,
                id: 'custom-server',
                mode: 'subscriptionLinks',
                order: 2,
                uri: 'vless://test@example.com:443#Custom',
            },
            {
                ...baseLink,
                enabled: false,
                id: 'disabled-server',
                mode: 'subscriptionLinks',
                order: 3,
                uri: 'hy2://disabled@example.com:443',
            },
        ]);

        expect(links).toEqual([
            'awg://opaque-payload#Custom-AWG',
            'vless://test@example.com:443#Custom',
        ]);
    });

    it('filters connection links by active internal squads', () => {
        const squadA = '11111111-1111-4111-8111-111111111111';
        const squadB = '22222222-2222-4222-8222-222222222222';
        const links = [
            {
                ...baseLink,
                id: 'everyone',
                mode: 'subscriptionLinks' as const,
                uri: 'vless://everyone@example.com:443#Everyone',
            },
            {
                ...baseLink,
                id: 'squad-a',
                mode: 'subscriptionLinks' as const,
                uri: 'vless://squad-a@example.com:443#A',
                internalSquadUuids: [squadA],
            },
            {
                ...baseLink,
                id: 'squad-b',
                mode: 'subscriptionLinks' as const,
                uri: 'vless://squad-b@example.com:443#B',
                internalSquadUuids: [squadB],
            },
        ];

        expect(resolveCustomSubscriptionLinks(links, [squadA])).toEqual([
            'vless://everyone@example.com:443#Everyone',
            'vless://squad-a@example.com:443#A',
        ]);
        expect(resolveCustomSubscriptionLinks(links, [])).toEqual([
            'vless://everyone@example.com:443#Everyone',
        ]);
    });

    it('appends filtered connection URIs to text and base64 Xray subscriptions', async () => {
        const generator = new XrayGeneratorService();
        const marker = 'vless://test-marker@example.com:443#Additional';

        expect(await generator.generateConfig([], false, false, [marker, marker])).toBe(marker);
        expect(
            Buffer.from(
                await generator.generateConfig([], true, false, [marker]),
                'base64',
            ).toString('utf8'),
        ).toBe(marker);
    });

    it('converts a custom VLESS URI into a valid Xray JSON subscription entry', async () => {
        const parsed = convertCustomVlessLinkToXrayJson(
            'vless://11111111-1111-4111-8111-111111111111@example.com:443?encryption=none&type=tcp&security=reality&sid=test-sid&sni=example.com&fp=chrome&flow=xtls-rprx-vision#Test-marker',
            { remarks: 'template', outbounds: [] },
        );

        expect(parsed?.remarks).toBe('Test-marker');
        expect(parsed?.outbounds[0]).toMatchObject({
            protocol: 'vless',
            settings: { vnext: [{ address: 'example.com', port: 443 }] },
            streamSettings: { security: 'reality' },
        });
        expect(
            convertCustomVlessLinkToXrayJson('myvpn+test://opaque-payload#Unsupported-by-Xray', {
                remarks: 'template',
                outbounds: [],
            }),
        ).toBeNull();
    });

    it('accepts a connection link without a display name or icon', () => {
        expect(
            CustomLinkSchema.safeParse({
                id: 'connection-only',
                enabled: true,
                uri: 'wg://opaque-payload#Name-from-fragment',
                order: 0,
                mode: 'subscriptionLinks',
            }).success,
        ).toBe(true);
    });

    it('accepts a metadata-free connection link in a complete page config', () => {
        const config = {
            ...DEFAULT_SUBPAGE_CONFIG,
            customLinks: [
                {
                    id: 'connection-only',
                    enabled: true,
                    uri: 'awg://opaque-payload#Name-from-fragment',
                    order: 0,
                    mode: 'subscriptionLinks',
                },
            ],
        };

        expect(SubscriptionPageRawConfigSchema.safeParse(config).success).toBe(true);
    });

    it('keeps header links and connection links in separate destinations', () => {
        expect(
            CustomLinkSchema.safeParse({
                ...baseLink,
                mode: 'literal',
                uri: 'vless://test@example.com:443#Wrong-destination',
            }).success,
        ).toBe(false);
        expect(
            CustomLinkSchema.safeParse({
                ...baseLink,
                mode: 'subscriptionLinks',
                uri: 'https://example.com/wrong-destination',
            }).success,
        ).toBe(false);
    });

    it('does not include custom connection links for non-active users', () => {
        expect(shouldIncludeCustomSubscriptionLinks({ status: USERS_STATUS.ACTIVE })).toBe(true);
        expect(shouldIncludeCustomSubscriptionLinks({ status: USERS_STATUS.EXPIRED })).toBe(false);
        expect(shouldIncludeCustomSubscriptionLinks({ status: USERS_STATUS.DISABLED })).toBe(false);
        expect(shouldIncludeCustomSubscriptionLinks({ status: USERS_STATUS.LIMITED })).toBe(false);
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
        ['incy://install?url={{SUBSCRIPTION_LINK}}', 'subscriptionLink'],
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
        { certificateFile: '/etc/xray/cert.pem/../secret.pem' },
        { keyFile: '/etc/xray/private.key\nTEST' },
    ])('rejects an unsafe certificate file reference without reading it: %j', (certificate) => {
        expect(() => assertSafeCertificateFileReferences([certificate])).toThrow(
            /normalized absolute POSIX paths/u,
        );
    });

    it('accepts inline material and normalized node-side certificate paths', () => {
        expect(() =>
            assertSafeCertificateFileReferences([
                { certificate: ['TEST-CERTIFICATE-MARKER'], key: ['TEST-KEY-MARKER'] },
                {
                    certificateFile: '/etc/xray/tls/certificate.pem',
                    keyFile: '/etc/xray/tls/private.key',
                },
            ]),
        ).not.toThrow();
    });

    it('validates node-side references without modifying them', () => {
        const certificateFile = '/etc/xray/tls/TEST-CERTIFICATE.pem';
        const keyFile = '/etc/xray/tls/TEST-PRIVATE.key';
        const certificates = [{ certificateFile, keyFile }];

        expect(() => assertSafeCertificateFileReferences(certificates)).not.toThrow();
        expect(certificates).toEqual([{ certificateFile, keyFile }]);
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
