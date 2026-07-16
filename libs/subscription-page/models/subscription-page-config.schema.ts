import { z } from 'zod';

import {
    SUBSCRIPTION_PAGE_CONFIG_VERSION,
    SUBSCRIPTION_PAGE_CONFIG_PLATFORM_TYPES,
    SUBSCRIPTION_INFO_BLOCK_VARIANTS,
    INSTALLATION_GUIDE_BLOCKS_VARIANTS,
    BUTTON_TYPES,
    CUSTOM_LINK_ACTIONS,
    CUSTOM_LINK_MODES,
    MAX_CUSTOM_LINKS,
    LANGUAGE_CODES,
} from '../constants';
import { getButtonLinkError, getHttpUrlError } from './button-link.validator';
import { getCustomLinkUriError, containsHtmlMarkup } from './custom-link.validator';
import { MAX_LOCALIZED_HTML_LENGTH, sanitizeLocalizedHtml } from './localized-html-sanitizer';
import {
    validateLocalizedTexts,
    validateSvgReferences,
} from './subscription-page-config.validator';
import { MAX_SVG_SOURCE_LENGTH, sanitizeSvg } from './svg-sanitizer';

const LocalizedTextSchema = z
    .record(
        z.string().regex(/^[a-z]{2}$/, 'Language code must be 2 lowercase letters'),
        z.string().max(MAX_LOCALIZED_HTML_LENGTH).transform(sanitizeLocalizedHtml),
    )
    .refine((obj) => Object.keys(obj).length > 0, {
        message: 'At least one language must be specified',
    });

const SvgLibrarySchema = z.record(
    z.string().regex(/^[A-Za-z]+$/, {
        message: 'Only latin characters, no spaces allowed',
    }),
    z
        .string()
        .max(MAX_SVG_SOURCE_LENGTH)
        .transform((value, ctx) => {
            try {
                return sanitizeSvg(value);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error instanceof Error ? error.message : 'SVG is invalid',
                });
                return z.NEVER;
            }
        }),
);

const CustomLinkDisplayNameSchema = z.record(
    z.string().regex(/^[a-z]{2}$/, 'Language code must be 2 lowercase letters'),
    z
        .string()
        .trim()
        .min(1, 'Display name is required')
        .max(100, 'Display name must be 100 characters or fewer')
        .refine((value) => !containsHtmlMarkup(value), 'Display name must not contain HTML'),
);

const isHeaderCustomLink = (link: { mode: string }): boolean => link.mode === 'literal';

export const CustomLinkSchema = z
    .object({
        id: z
            .string()
            .min(1)
            .max(64)
            .regex(
                /^[A-Za-z0-9_-]+$/,
                'ID may only contain letters, numbers, underscores and dashes',
            ),
        enabled: z.boolean().default(true),
        displayName: CustomLinkDisplayNameSchema.optional().default({}),
        uri: z.string().default(''),
        action: z.enum(CUSTOM_LINK_ACTIONS).default('copy'),
        iconKey: z.string().optional(),
        order: z.number().int().min(0).max(10_000),
        mode: z.enum(CUSTOM_LINK_MODES).default('literal'),
    })
    .superRefine((value, ctx) => {
        const error = getCustomLinkUriError(value.uri);
        if (error) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: ['uri'],
            });
            return;
        }

        const usesHttp = /^https?:/iu.test(value.uri);
        if (value.mode === 'literal' && !usesHttp) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Header link must use HTTP(S)',
                path: ['uri'],
            });
        }
        if (value.mode === 'subscriptionLinks' && usesHttp) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Connection link must use a non-HTTP URI scheme',
                path: ['uri'],
            });
        }
    });

const ButtonSchema = z
    .object({
        link: z.string(),
        type: z.nativeEnum(BUTTON_TYPES),
        text: LocalizedTextSchema,
        svgIconKey: z.string(),
    })
    .superRefine((value, ctx) => {
        const error = getButtonLinkError(value.link, value.type);
        if (error) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ['link'] });
        }
    });

const BlockSchema = z.object({
    svgIconKey: z.string(),
    svgIconColor: z
        .string()
        .refine(
            (value) =>
                [
                    'blue',
                    'cyan',
                    'dark',
                    'grape',
                    'gray',
                    'green',
                    'indigo',
                    'lime',
                    'orange',
                    'pink',
                    'red',
                    'teal',
                    'violet',
                    'yellow',
                ].includes(value) || /^#[0-9a-fA-F]{3,8}$/.test(value),
            {
                message:
                    'svgIconColor must be one of the predefined colors or a hex color beginning with #',
            },
        ),
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
    buttons: z.array(ButtonSchema),
});

const PlatformAppSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    svgIconKey: z.optional(z.string()),
    featured: z.boolean(),
    blocks: z.array(BlockSchema),
});

const PlatformSchema = z.object({
    displayName: LocalizedTextSchema,
    svgIconKey: z.string(),
    apps: z.array(PlatformAppSchema),
});

const BrandingSettingsSchema = z.object({
    title: z.string().max(256),
    logoUrl: z.string().refine((value) => !getHttpUrlError(value, true), {
        message: 'Logo URL must be empty or use HTTP(S)',
    }),
    supportUrl: z.string().refine((value) => !getHttpUrlError(value), {
        message: 'Support URL must use HTTP(S)',
    }),
});

const UiConfigSchema = z.object({
    subscriptionInfoBlockType: z.nativeEnum(SUBSCRIPTION_INFO_BLOCK_VARIANTS),
    installationGuidesBlockType: z.nativeEnum(INSTALLATION_GUIDE_BLOCKS_VARIANTS),
});

const SubscriptionPageTranslateKeysSchema = z.object({
    installationGuideHeader: LocalizedTextSchema,
    connectionKeysHeader: LocalizedTextSchema,
    linkCopied: LocalizedTextSchema,
    linkCopiedToClipboard: LocalizedTextSchema,
    getLink: LocalizedTextSchema,
    scanQrCode: LocalizedTextSchema,
    scanQrCodeDescription: LocalizedTextSchema,
    copyLink: LocalizedTextSchema,
    name: LocalizedTextSchema,
    status: LocalizedTextSchema,
    active: LocalizedTextSchema,
    inactive: LocalizedTextSchema,
    expires: LocalizedTextSchema,
    bandwidth: LocalizedTextSchema,
    scanToImport: LocalizedTextSchema,
    expiresIn: LocalizedTextSchema,
    expired: LocalizedTextSchema,
    unknown: LocalizedTextSchema,
    indefinitely: LocalizedTextSchema,
});

const BaseSettingsSchema = z
    .object({
        metaTitle: z.string().max(256).default('Subscription'),
        metaDescription: z.string().max(1_024).default('Subscription'),
        showConnectionKeys: z.boolean().default(false),
        hideGetLinkButton: z.boolean().default(false),
    })
    .default({
        metaTitle: 'Subscription',
        metaDescription: 'Subscription',
        showConnectionKeys: false,
        hideGetLinkButton: false,
    });

export const SubscriptionPageRawConfigSchema = z
    .object({
        version: z.nativeEnum(SUBSCRIPTION_PAGE_CONFIG_VERSION),
        locales: z.array(z.enum(LANGUAGE_CODES)).min(1, 'At least one locale must be specified'),
        brandingSettings: BrandingSettingsSchema,
        uiConfig: UiConfigSchema,
        baseSettings: BaseSettingsSchema,
        baseTranslations: SubscriptionPageTranslateKeysSchema,
        svgLibrary: SvgLibrarySchema,
        platforms: z.record(z.nativeEnum(SUBSCRIPTION_PAGE_CONFIG_PLATFORM_TYPES), PlatformSchema),
        customLinks: z.array(CustomLinkSchema).max(MAX_CUSTOM_LINKS).default([]),
    })
    .superRefine((data, ctx) => {
        validateLocalizedTexts(data, data.locales, ctx);
        validateSvgReferences(data, ctx);

        const ids = new Set<string>();
        data.customLinks.forEach((link, index) => {
            if (ids.has(link.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Duplicate custom link ID '${link.id}'`,
                    path: ['customLinks', index, 'id'],
                });
            }
            ids.add(link.id);

            if (isHeaderCustomLink(link)) {
                for (const locale of data.locales) {
                    if (!link.displayName[locale]) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Missing required locale '${locale}'`,
                            path: ['customLinks', index, 'displayName', locale],
                        });
                    }
                }
            }

            if (link.iconKey && !Object.hasOwn(data.svgLibrary, link.iconKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Unknown icon key',
                    path: ['customLinks', index, 'iconKey'],
                });
            }
        });
    });

export type TSubscriptionPageSvgLibrary = z.infer<typeof SvgLibrarySchema>;
export type TSubscriptionPageRawConfig = z.infer<typeof SubscriptionPageRawConfigSchema>;
export type TSubscriptionPageBrandingSettings = z.infer<typeof BrandingSettingsSchema>;
export type TSubscriptionPagePlatformSchema = z.infer<typeof PlatformSchema>;
export type TSubscriptionPagePlatformKey = keyof TSubscriptionPageRawConfig['platforms'];
export type TSubscriptionPageAppConfig = z.infer<typeof PlatformAppSchema>;
export type TSubscriptionPageBlockConfig = z.infer<typeof BlockSchema>;
export type TSubscriptionPageButtonConfig = z.infer<typeof ButtonSchema>;
export type TSubscriptionPageLocalizedText = z.infer<typeof LocalizedTextSchema>;
export type TSubscriptionPageUiConfig = z.infer<typeof UiConfigSchema>;
export type TSubscriptionPageTranslateKeys = z.infer<typeof SubscriptionPageTranslateKeysSchema>;
export type TSubscriptionPageBaseTranslationKeys = keyof TSubscriptionPageTranslateKeys;
export type TSubscriptionPageCustomLink = z.infer<typeof CustomLinkSchema>;
