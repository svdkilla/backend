import { getCustomLinkUriError } from './custom-link.validator';
import { TSubscriptionPageCustomLink } from './subscription-page-config.schema';

const SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+.-]*):/u;

export const resolveCustomSubscriptionLinks = (
    customLinks: TSubscriptionPageCustomLink[],
    activeInternalSquadUuids: readonly string[] = [],
): string[] => {
    const seen = new Set<string>();
    const activeSquads = new Set(activeInternalSquadUuids);

    return customLinks
        .filter(
            (link) =>
                link.enabled &&
                link.mode === 'subscriptionLinks' &&
                (link.internalSquadUuids.length === 0 ||
                    link.internalSquadUuids.some((uuid) => activeSquads.has(uuid))),
        )
        .sort((left, right) => left.order - right.order)
        .flatMap((link) => {
            const uri = link.uri;
            const scheme = SCHEME_PATTERN.exec(uri)?.[1]?.toLowerCase();

            if (
                !scheme ||
                scheme === 'http' ||
                scheme === 'https' ||
                getCustomLinkUriError(uri) !== null ||
                seen.has(uri)
            ) {
                return [];
            }

            seen.add(uri);
            return [uri];
        });
};
