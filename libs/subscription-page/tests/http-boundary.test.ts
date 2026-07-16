import express, { json } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createServer, request as httpRequest, Server } from 'node:http';
import { createConnection } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import {
    createPanelHostGuard,
    createPublicPanelRequestGuard,
} from '../../../src/common/middlewares/public-panel-request-guard.middleware';

const servers: Server[] = [];

const listen = async (app: ReturnType<typeof express>): Promise<string> => {
    const server = await new Promise<Server>((resolve) => {
        const value = app.listen(0, '127.0.0.1', () => resolve(value));
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test listener');
    return `http://127.0.0.1:${address.port}`;
};

const requestStatus = async (url: string, headers: Record<string, string>): Promise<number> =>
    new Promise((resolve, reject) => {
        const request = httpRequest(url, { headers }, (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
        });
        request.on('error', reject);
        request.end();
    });

afterEach(async () => {
    await Promise.all(
        servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
    );
});

describe('panel HTTP boundary', () => {
    it.each([
        '/.env',
        '/package.json',
        '/node_modules/test/index.js',
        '/proc/self/environ',
        '/assets/%2e%2e%2fpackage.json',
        '/assets/%252e%252e%252fpackage.json',
        '/assets/%2e%2e%5cpackage.json',
        '/assets/test.js%00.css',
        '/C:%5cWindows%5cwin.ini',
        '/assets/test.exe',
        '/assets/source.js.map',
    ])('blocks static-root probe %s', async (path) => {
        const app = express();
        app.use(createPublicPanelRequestGuard(['/api']));
        app.use((_request, response) => response.status(204).end());
        const baseUrl = await listen(app);
        const response = await fetch(baseUrl + path);
        expect(response.status).toBe(404);
    });

    it('rejects Host injection but ignores forged X-Forwarded-Host', async () => {
        const app = express();
        app.set('trust proxy', 1);
        app.use(createPanelHostGuard('panel.test'));
        app.use((_request, response) => response.status(204).end());
        const baseUrl = await listen(app);

        expect(
            await requestStatus(baseUrl, {
                Host: 'panel.test',
                'X-Forwarded-Host': 'attacker.invalid',
            }),
        ).toBe(204);
        expect(await requestStatus(baseUrl, { Host: 'attacker.invalid' })).toBe(400);
    });

    it('returns 413 for a JSON body larger than the panel limit', async () => {
        const app = express();
        app.use(json({ limit: '4mb' }));
        app.post('/api/test', (_request, response) => response.status(204).end());
        const baseUrl = await listen(app);
        const response = await fetch(`${baseUrl}/api/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marker: 'x'.repeat(4 * 1_024 * 1_024) }),
        });
        expect(response.status).toBe(413);
    });

    it('does not let forged X-Forwarded-For values bypass a trusted-IP rate key', async () => {
        const app = express();
        app.set('trust proxy', false);
        app.use(
            rateLimit({
                windowMs: 60_000,
                limit: 2,
                legacyHeaders: false,
                standardHeaders: 'draft-8',
            }),
        );
        app.get('/api/test', (_request, response) => response.status(204).end());
        const baseUrl = await listen(app);

        for (const fakeIp of ['198.51.100.1', '198.51.100.2']) {
            expect(
                (await fetch(`${baseUrl}/api/test`, { headers: { 'X-Forwarded-For': fakeIp } }))
                    .status,
            ).toBe(204);
        }
        expect(
            (
                await fetch(`${baseUrl}/api/test`, {
                    headers: { 'X-Forwarded-For': '198.51.100.3' },
                })
            ).status,
        ).toBe(429);
    });

    it('rejects conflicting Content-Length and Transfer-Encoding framing', async () => {
        let handlerCalled = false;
        const server = createServer((_request, response) => {
            handlerCalled = true;
            response.end('unexpected');
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        servers.push(server);
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Missing raw test listener');

        const response = await new Promise<string>((resolve, reject) => {
            const socket = createConnection(address.port, '127.0.0.1');
            let data = '';
            socket.setEncoding('utf8');
            socket.on('connect', () => {
                socket.write(
                    'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n',
                );
            });
            socket.on('data', (chunk) => (data += chunk));
            socket.on('end', () => resolve(data));
            socket.on('error', reject);
        });

        expect(response).toMatch(/^HTTP\/1\.1 400 /u);
        expect(handlerCalled).toBe(false);
    });
});
