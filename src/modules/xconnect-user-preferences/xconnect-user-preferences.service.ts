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
        const [user] = await this.prisma.tx.$queryRaw<Array<{ uuid: string }>>`
            SELECT "uuid"
            FROM "users"
            WHERE "uuid" = ${userUuid}::uuid
            LIMIT 1
        `;

        if (!user) return null;

        const [preference] = await this.prisma.tx.$queryRaw<Array<{ enabled: boolean }>>`
            SELECT "extended_server_list_enabled" AS "enabled"
            FROM "xconnect_user_preferences"
            WHERE "user_uuid" = ${userUuid}::uuid
            LIMIT 1
        `;

        return {
            userUuid,
            enabled: preference?.enabled ?? false,
        };
    }

    public async isExtendedServerListEnabled(userUuid: string): Promise<boolean> {
        try {
            const [preference] = await this.prisma.tx.$queryRaw<Array<{ enabled: boolean }>>`
                SELECT "extended_server_list_enabled" AS "enabled"
                FROM "xconnect_user_preferences"
                WHERE "user_uuid" = ${userUuid}::uuid
                LIMIT 1
            `;

            return preference?.enabled ?? false;
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
        const [user] = await this.prisma.tx.$queryRaw<Array<{ uuid: string }>>`
            SELECT "uuid"
            FROM "users"
            WHERE "uuid" = ${userUuid}::uuid
            LIMIT 1
        `;

        if (!user) return null;

        const [preference] = await this.prisma.tx.$queryRaw<
            Array<{ enabled: boolean; userUuid: string }>
        >`
            INSERT INTO "xconnect_user_preferences" (
                "user_uuid",
                "extended_server_list_enabled",
                "updated_at"
            )
            VALUES (${userUuid}::uuid, ${enabled}, CURRENT_TIMESTAMP)
            ON CONFLICT ("user_uuid") DO UPDATE SET
                "extended_server_list_enabled" = EXCLUDED."extended_server_list_enabled",
                "updated_at" = CURRENT_TIMESTAMP
            RETURNING
                "user_uuid" AS "userUuid",
                "extended_server_list_enabled" AS "enabled"
        `;

        if (!preference) return null;

        return {
            userUuid: preference.userUuid,
            enabled: preference.enabled,
        };
    }
}
