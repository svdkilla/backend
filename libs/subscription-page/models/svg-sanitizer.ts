import DOMPurify from 'isomorphic-dompurify';

export const MAX_SVG_SOURCE_LENGTH = 50_000;
const MAX_SVG_ELEMENTS = 256;
const MAX_SVG_DEPTH = 16;

const SVG_ALLOWED_TAGS = [
    'svg',
    'g',
    'path',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'rect',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
    'title',
    'desc',
] as const;

const SVG_ALLOWED_ATTRIBUTES = [
    'xmlns',
    'viewBox',
    'width',
    'height',
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-opacity',
    'opacity',
    'd',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x',
    'y',
    'x1',
    'x2',
    'y1',
    'y2',
    'points',
    'transform',
    'offset',
    'stop-color',
    'stop-opacity',
    'id',
    'clip-path',
    'mask',
    'role',
    'aria-hidden',
    'focusable',
] as const;

const assertSvgComplexity = (svg: string): void => {
    const tokens = svg.match(/<\/?[A-Za-z][^>]*>/gu) ?? [];
    if (tokens.length > MAX_SVG_ELEMENTS * 2) {
        throw new Error('SVG is too complex');
    }

    let depth = 0;
    let elements = 0;
    for (const token of tokens) {
        if (token.startsWith('</')) {
            depth = Math.max(0, depth - 1);
            continue;
        }

        elements += 1;
        if (!token.endsWith('/>')) depth += 1;
        if (elements > MAX_SVG_ELEMENTS || depth > MAX_SVG_DEPTH) {
            throw new Error('SVG is too complex');
        }
    }
};

export const sanitizeSvg = (source: string): string => {
    if (source.length === 0 || source.length > MAX_SVG_SOURCE_LENGTH) {
        throw new Error('SVG size is outside the allowed range');
    }
    if (/<!DOCTYPE|<!ENTITY/iu.test(source)) {
        throw new Error('SVG document declarations are not allowed');
    }

    const sanitized = DOMPurify.sanitize(source, {
        USE_PROFILES: { svg: true, svgFilters: false },
        ALLOWED_TAGS: [...SVG_ALLOWED_TAGS],
        ALLOWED_ATTR: [...SVG_ALLOWED_ATTRIBUTES],
        FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'style', 'image'],
        FORBID_ATTR: ['style', 'href', 'xlink:href'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: true,
    }).trim();

    if (!/^<svg(?:\s|>)/iu.test(sanitized)) {
        throw new Error('Sanitized value must have an SVG root element');
    }
    if (
        /\bon[a-z]+\s*=|javascript:|data:text\/html|url\s*\(|@import|expression\s*\(/iu.test(
            sanitized,
        )
    ) {
        throw new Error('Sanitized SVG still contains an unsafe construct');
    }

    assertSvgComplexity(sanitized);
    return sanitized;
};
