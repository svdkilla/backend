import { NextFunction, Request, Response } from 'express';

const STATIC_EXTENSIONS = new Set([
    '.avif',
    '.css',
    '.gif',
    '.ico',
    '.jpeg',
    '.jpg',
    '.js',
    '.json',
    '.png',
    '.svg',
    '.webp',
    '.woff',
    '.woff2',
]);
const SENSITIVE_SEGMENTS = new Set([
    '.env',
    '.git',
    '.npmrc',
    '.ssh',
    'dockerfile',
    'node_modules',
    'package-lock.json',
    'package.json',
    'proc',
    'src',
]);

const getDecodedPath = (url: string): string | null => {
    const rawPath = url.split('?', 1)[0] ?? '/';
    try {
        const once = decodeURIComponent(rawPath);
        const twice = decodeURIComponent(once);
        if (twice !== once) return null;
        return once;
    } catch {
        return null;
    }
};

export const createPublicPanelRequestGuard = (excludedPrefixes: string[]) =>
    function publicPanelRequestGuard(req: Request, res: Response, next: NextFunction): void {
        const rawPath = req.originalUrl.split('?', 1)[0] ?? '/';
        if (
            excludedPrefixes.some(
                (prefix) => rawPath === prefix || rawPath.startsWith(`${prefix}/`),
            )
        ) {
            next();
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.status(405).json({ statusCode: 405, message: 'Method not allowed' });
            return;
        }

        const decodedPath = getDecodedPath(req.originalUrl);
        if (
            !decodedPath ||
            decodedPath.includes('\\') ||
            decodedPath.includes('\0') ||
            /(^|\/)\.\.?($|\/)/u.test(decodedPath) ||
            /(^|\/)[A-Za-z]:/u.test(decodedPath)
        ) {
            res.status(404).end();
            return;
        }

        const segments = decodedPath
            .split('/')
            .filter(Boolean)
            .map((segment) => segment.toLowerCase());
        if (
            segments.some(
                (segment) => SENSITIVE_SEGMENTS.has(segment) || segment.startsWith('.'),
            ) ||
            decodedPath.toLowerCase().endsWith('.map')
        ) {
            res.status(404).end();
            return;
        }

        const lastSegment = segments.at(-1) ?? '';
        const extensionMatch = /\.[a-z0-9]+$/iu.exec(lastSegment);
        if (extensionMatch && !STATIC_EXTENSIONS.has(extensionMatch[0].toLowerCase())) {
            res.status(404).end();
            return;
        }

        next();
    };

const parseHost = (value: string | undefined): string | null => {
    if (!value || /[\s,@/\\]/u.test(value)) return null;
    try {
        return new URL(`http://${value}`).hostname.toLowerCase();
    } catch {
        return null;
    }
};

export const createPanelHostGuard = (allowedHostsValue: string | undefined) => {
    const allowedHosts = new Set(
        (allowedHostsValue ?? '')
            .split(',')
            .map((host) => parseHost(host.trim()))
            .filter((host): host is string => Boolean(host)),
    );

    return (req: Request, res: Response, next: NextFunction): void => {
        if (allowedHosts.size === 0) {
            next();
            return;
        }
        const host = parseHost(req.headers.host);
        if (!host || !allowedHosts.has(host)) {
            res.status(400).json({ statusCode: 400, message: 'Invalid host' });
            return;
        }
        next();
    };
};
