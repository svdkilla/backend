import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import { Injectable, Logger } from '@nestjs/common';

export interface XConnectExtendedServerListPreference {
    enabled: boolean;
    userUuid: string;
}

@Injectable()
export class XConnectUserPreferencesService {
    private readonly logger = new Logger(XConnectUserPreferencesService.name);

    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    public async getExtendedServerListPreference(
        userUuid: string,
    ): Promise<XConnectExtendedServerListPreference | null> {
        const user = await this.prisma.tx.users.findUnique({
            where: { uuid: userUuid },
            select: { uuid: true },
        });

        if (!user) return null;

        const preference = await this.prisma.tx.xConnectUserPreferences.findUnique({
            where: { userUuid },
            select: { extendedServerListEnabled: true },
        });

        return {
            userUuid,
            enabled: preference?.extendedServerListEnabled ?? false,
        };
    }

    public async isExtendedServerListEnabled(userUuid: string): Promise<boolean> {
        try {
            const preference = await this.prisma.tx.xConnectUserPreferences.findUnique({
                where: { userUuid },
                select: { extendedServerListEnabled: true },
            });

            return preference?.extendedServerListEnabled ?? false;
        } catch (error) {
            this.logger.warn(
                `Could not load extended server preference for ${userUuid}; using safe default.`,
            );
            this.logger.debug(error);
            return false;
        }
    }

    public async setExtendedServerListPreference(
        userUuid: string,
        enabled: boolean,
    ): Promise<XConnectExtendedServerListPreference | null> {
        const user = await this.prisma.tx.users.findUnique({
            where: { uuid: userUuid },
            select: { uuid: true },
        });

        if (!user) return null;

        const preference = await this.prisma.tx.xConnectUserPreferences.upsert({
            where: { userUuid },
            create: {
                userUuid,
                extendedServerListEnabled: enabled,
            },
            update: {
                extendedServerListEnabled: enabled,
            },
            select: {
                userUuid: true,
                extendedServerListEnabled: true,
            },
        });

        return {
            userUuid: preference.userUuid,
            enabled: preference.extendedServerListEnabled,
        };
    }
}
