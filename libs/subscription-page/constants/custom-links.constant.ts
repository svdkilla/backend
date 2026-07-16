export const CUSTOM_LINK_ACTIONS = ['open', 'copy', 'qr'] as const;
export type TCustomLinkAction = (typeof CUSTOM_LINK_ACTIONS)[number];

export const CUSTOM_LINK_MODES = ['literal', 'template', 'subscriptionLinks'] as const;
export type TCustomLinkMode = (typeof CUSTOM_LINK_MODES)[number];

export const ALLOWED_CUSTOM_LINK_SCHEMES = [
    'https',
    'http',
    'vless',
    'vmess',
    'trojan',
    'ss',
    'hysteria2',
    'hy2',
    'tuic',
    'wireguard',
    'sub',
] as const;
export type TAllowedCustomLinkScheme = (typeof ALLOWED_CUSTOM_LINK_SCHEMES)[number];

export const CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS = [
    'vless',
    'vmess',
    'trojan',
    'ss',
    'hysteria2',
    'hy2',
    'tuic',
    'wireguard',
    'sub',
] as const;
export type TCustomLinkSubscriptionProtocol = (typeof CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS)[number];

export const CUSTOM_LINK_TEMPLATE_VARIABLES = ['username', 'shortUuid', 'subscriptionUrl'] as const;
export type TCustomLinkTemplateVariable = (typeof CUSTOM_LINK_TEMPLATE_VARIABLES)[number];

export const MAX_CUSTOM_LINK_URI_LENGTH = 4096;
export const MAX_CUSTOM_LINKS = 50;
