import z from 'zod';

const hasControlCharacter = (value: string): boolean =>
    [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x1f || code === 0x7f;
    });

export const HttpOauthUrlSchema = z
    .string()
    .max(2_048)
    .refine((value) => {
        if (hasControlCharacter(value)) return false;
        try {
            const decoded = decodeURIComponent(value);
            if (hasControlCharacter(decoded)) return false;
            if (/%[0-9A-Fa-f]{2}/u.test(decoded) && decodeURIComponent(decoded) !== decoded) {
                return false;
            }
            const parsed = new URL(value);
            return (
                ['http:', 'https:'].includes(parsed.protocol) &&
                Boolean(parsed.hostname) &&
                !parsed.username &&
                !parsed.password
            );
        } catch {
            return false;
        }
    }, 'Must be an HTTP(S) URL without credentials or control characters');

export const Oauth2SettingsSchema = z.object({
    github: z.object({
        enabled: z.boolean(),
        clientId: z.nullable(z.string()),
        clientSecret: z.nullable(z.string()),
        allowedEmails: z.array(z.string()),
    }),
    pocketid: z.object({
        enabled: z.boolean(),
        clientId: z.nullable(z.string()),
        clientSecret: z.nullable(z.string()),
        plainDomain: z.nullable(
            z.string().refine(
                (val) => {
                    const fqdnRegex =
                        /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/;
                    if (fqdnRegex.test(val)) {
                        return true;
                    }

                    return false;
                },
                {
                    message: 'Must be a valid fully qualified domain name (FQDN), e.g. "docs.rw"',
                },
            ),
        ),
        allowedEmails: z.array(z.string()),
    }),
    yandex: z.object({
        enabled: z.boolean(),
        clientId: z.nullable(z.string()),
        clientSecret: z.nullable(z.string()),
        allowedEmails: z.array(z.string()),
    }),
    keycloak: z
        .object({
            enabled: z.boolean(),
            realm: z.nullable(z.string()),
            clientId: z.nullable(z.string()),
            clientSecret: z.nullable(z.string()),
            frontendDomain: z.nullable(
                z.string().refine(
                    (val) => {
                        const fqdnRegex =
                            /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/;
                        if (fqdnRegex.test(val)) {
                            return true;
                        }

                        return false;
                    },
                    {
                        message:
                            'Must be a valid fully qualified domain name (FQDN), e.g. "docs.rw"',
                    },
                ),
            ),
            keycloakDomain: z.nullable(
                z.string().refine(
                    (val) => {
                        const fqdnRegex =
                            /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/;
                        if (fqdnRegex.test(val)) {
                            return true;
                        }

                        return false;
                    },
                    {
                        message:
                            'Must be a valid fully qualified domain name (FQDN), e.g. "docs.rw"',
                    },
                ),
            ),
            allowedEmails: z.array(z.string()),
        })
        .default({
            enabled: false,
            realm: null,
            frontendDomain: null,
            keycloakDomain: null,
            clientId: null,
            clientSecret: null,
            allowedEmails: [],
        }),
    generic: z
        .object({
            enabled: z.boolean(),
            clientId: z.nullable(z.string()),
            clientSecret: z.nullable(z.string()),
            withPkce: z.boolean(),
            authorizationUrl: HttpOauthUrlSchema.nullable(),
            tokenUrl: HttpOauthUrlSchema.nullable(),

            frontendDomain: z.nullable(
                z.string().refine(
                    (val) => {
                        if (val.startsWith('127.0.0.1') || val.startsWith('localhost')) {
                            return true;
                        }

                        const fqdnRegex =
                            /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/;
                        if (fqdnRegex.test(val)) {
                            return true;
                        }

                        return false;
                    },
                    {
                        message:
                            'Must be a valid fully qualified domain name (FQDN), e.g. "docs.rw"',
                    },
                ),
            ),
            allowedEmails: z.array(z.string()),
        })
        .default({
            enabled: false,
            frontendDomain: null,
            tokenUrl: null,
            clientId: null,
            clientSecret: null,
            withPkce: false,
            authorizationUrl: null,
            allowedEmails: [],
        }),
    telegram: z
        .object({
            enabled: z.boolean(),
            clientId: z.nullable(z.string()),
            clientSecret: z.nullable(z.string()),
            allowedIds: z.array(z.string()),
            frontendDomain: z.nullable(
                z.string().refine(
                    (val) => {
                        const fqdnRegex =
                            /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/;
                        if (fqdnRegex.test(val)) {
                            return true;
                        }

                        return false;
                    },
                    {
                        message:
                            'Must be a valid fully qualified domain name (FQDN), e.g. "docs.rw"',
                    },
                ),
            ),
        })
        .default({
            enabled: false,
            clientId: null,
            clientSecret: null,
            allowedIds: [],
            frontendDomain: null,
        }),
});

export type TOauth2Settings = z.infer<typeof Oauth2SettingsSchema>;
