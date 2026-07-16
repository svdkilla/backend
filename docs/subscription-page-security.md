# Subscription page configuration security

The canonical `customLinks` contract lives in `libs/subscription-page`. The panel frontend and subscription-page repository use small local adapters until a new `@remnawave/subscription-page-types` package is published. Publish this library first, then pin both consumers to the same released version and remove the adapters.

Custom-link schemes are listed in `custom-links.constant.ts`. HTTP values go through the platform URL parser. VPN URIs receive scheme, size, control-character, markup, and percent-encoding checks. Templates accept only `username`, `shortUuid`, and `subscriptionUrl`. They never execute code or trigger a server request.

SVG passes through DOMPurify during Zod parsing. The accepted tag and attribute set is small. Scripts, event handlers, embedded HTML, external references, CSS, oversized input, and deep trees are removed or rejected before storage. Consumers clean the value again where it enters the DOM.

Localized guide fields allow basic text formatting such as `strong`, `em`, lists, and line breaks. Attributes, links, images, SVG, and event handlers are stripped. Installation buttons and branding URLs follow the same URI policy at write time and again inside subscription-page.

Extended subscription information at `/api/sub/:shortUuid/info` requires a panel JWT or API token with `subscriptions:get`. The raw subscription routes remain public by design because the short UUID is the bearer credential. A subscription-page token should contain only `system:metadata`, `subscription-page-configs:list`, `subscription-page-configs:get`, `subscriptions:subpage-config`, and `subscriptions:get`. Add `users:by-username` only for Marzban legacy links.

Xray profiles cannot refer to `certificateFile` or `keyFile`. An API-supplied path could otherwise read a panel file while the profile is being validated. Certificates and keys must be provided as inline arrays. Existing profiles that still use file references need a one-time migration before this build is deployed.
