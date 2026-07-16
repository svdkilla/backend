import { CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS } from '../constants';
import { getCustomLinkUriError } from './custom-link.validator';
import { TSubscriptionPageCustomLink } from './subscription-page-config.schema';

const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const TEMPLATE_PATTERN = /\{\{\s*(username|shortUuid|subscriptionUrl)\s*\}\}/gu;
const subscriptionSchemes = new Set<string>(CUSTOM_LINK_SUBSCRIPTION_PROTOCOLS);

export interface CustomSubscriptionLinkTemplateValues {
    shortUuid: string;
    subscriptionUrl: string;
    username: string;
}

export const resolveCustomSubscriptionLinks = (
    customLinks: TSubscriptionPageCustomLink[],
    values: CustomSubscriptionLinkTemplateValues,
): string[] => {
    const seen = new Set<string>();

    return customLinks
        .filter((link) => link.enabled && link.mode !== 'subscriptionLinks')
        .sort((left, right) => left.order - right.order)
        .flatMap((link) => {
            const uri =
                link.mode === 'template'
                    ? link.uri.replace(
                          TEMPLATE_PATTERN,
                          (_match, key: keyof CustomSubscriptionLinkTemplateValues) => values[key],
                      )
                    : link.uri;
            const scheme = SCHEME_PATTERN.exec(uri)?.[1]?.toLowerCase();

            if (
                !scheme ||
                !subscriptionSchemes.has(scheme) ||
                getCustomLinkUriError(uri) !== null ||
                seen.has(uri)
            ) {
                return [];
            }

            seen.add(uri);
            return [uri];
        });
};
