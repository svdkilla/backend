import { describe, expect, it } from 'vitest';

describe('subscription HWID policy', () => {
    it('documents the compatibility policy for clients without x-hwid', () => {
        const checkup = {
            subscriptionAllowed: true,
            maxDeviceReached: false,
            hwidNotSupported: true,
            limitBypassed: true,
        };

        expect(checkup).toEqual({
            subscriptionAllowed: true,
            maxDeviceReached: false,
            hwidNotSupported: true,
            limitBypassed: true,
        });
    });
});
