# Subscription page configuration security

The canonical `customLinks` contract lives in `libs/subscription-page`. Until a new
`@remnawave/subscription-page-types` package is published, the panel frontend and
subscription-page repositories keep small, backwards-compatible local adapters. Do not point
either consumer at a version that does not exist on npm. Publish this library first, then replace
the adapters and pin both consumers to that real version.

Custom-link schemes are allowlisted in `custom-links.constant.ts`. HTTP(S) values are parsed with
the platform URL parser; VPN URIs receive strict scheme, size, control-character, markup and
percent-encoding checks. Templates support only `username`, `shortUuid` and `subscriptionUrl` and
never execute code or perform server-side requests.

SVG values are sanitized during Zod parsing with DOMPurify using a narrow SVG tag/attribute set.
Scripts, event handlers, embedded HTML, external references, CSS and over-complex documents are
removed or rejected before the resulting configuration is stored. Consumers sanitize again at
the rendering boundary as defense in depth.
