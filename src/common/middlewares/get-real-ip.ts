import { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';

morgan.token('remote-addr', (req: Request) => {
    return req.ip || req.socket.remoteAddress || '0.0.0.0';
});

export const getRealIp = function (
    req: { clientIp: string } & Request,
    res: Response,
    next: NextFunction,
) {
    req.clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';

    next();
};
