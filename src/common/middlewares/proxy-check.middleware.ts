import { NextFunction, Request, Response } from 'express';

import { Logger } from '@nestjs/common';

import { isDevelopment } from '@common/utils/startup-app';

const logger = new Logger('ProxyCheckMiddleware');

export function proxyCheckMiddleware(req: Request, res: Response, next: NextFunction) {
    if (isDevelopment()) {
        return next();
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isProxy =
        typeof forwardedFor === 'string' && forwardedFor.length > 0 && forwardedFor.length <= 1_024;
    const isHttps = req.secure && forwardedProto === 'https';

    if (!isHttps || !isProxy) {
        res.status(400).json({ statusCode: 400, message: 'Invalid proxy request' });
        logger.error('Reverse proxy and HTTPS are required.');
        return;
    }

    return next();
}
