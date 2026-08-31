import {
    BadRequestException,
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
    UseFilters,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '@common/decorators/roles/roles';
import { ApiScopeEndpoint, ApiScopeResource } from '@common/decorators/scopes';
import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { RolesGuard } from '@common/guards/roles';
import { ScopesGuard } from '@common/guards/scopes';
import { CONTROLLERS_INFO } from '@libs/contracts/api';
import { getEndpointDetails, ROLE } from '@libs/contracts/constants';

import { XConnectUserPreferencesService } from './xconnect-user-preferences.service';

const getExtendedServerListEndpoint = getEndpointDetails(
    '/api/xconnect/users/:uuid/extended-server-list',
    'get',
    'Get XConnect extended server list preference',
    { scope: 'xconnect-extended-server-list-read', kind: 'read' },
);

const updateExtendedServerListEndpoint = getEndpointDetails(
    '/api/xconnect/users/:uuid/extended-server-list',
    'patch',
    'Update XConnect extended server list preference',
    { scope: 'xconnect-extended-server-list-write', kind: 'write' },
);

@ApiBearerAuth('Authorization')
@ApiScopeResource(CONTROLLERS_INFO.USERS.resource)
@ApiTags('XConnect user preferences')
@Roles(ROLE.ADMIN, ROLE.API)
@UseGuards(JwtDefaultGuard, RolesGuard, ScopesGuard)
@UseFilters(HttpExceptionFilter)
@Controller('/api/xconnect/users')
export class XConnectUserPreferencesController {
    constructor(private readonly preferencesService: XConnectUserPreferencesService) {}

    @ApiOkResponse({ description: 'Extended server list preference' })
    @ApiScopeEndpoint(getExtendedServerListEndpoint)
    @Get(':uuid/extended-server-list')
    public async getExtendedServerListPreference(
        @Param('uuid', new ParseUUIDPipe()) userUuid: string,
    ) {
        const preference = await this.preferencesService.getExtendedServerListPreference(userUuid);

        if (!preference) throw new NotFoundException('User not found');

        return { response: preference };
    }

    @ApiBody({
        schema: {
            type: 'object',
            required: ['enabled'],
            properties: { enabled: { type: 'boolean' } },
        },
    })
    @ApiOkResponse({ description: 'Extended server list preference updated' })
    @ApiScopeEndpoint(updateExtendedServerListEndpoint)
    @Patch(':uuid/extended-server-list')
    public async setExtendedServerListPreference(
        @Param('uuid', new ParseUUIDPipe()) userUuid: string,
        @Body() body: { enabled?: unknown },
    ) {
        if (typeof body.enabled !== 'boolean') {
            throw new BadRequestException('enabled must be a boolean');
        }

        const preference = await this.preferencesService.setExtendedServerListPreference(
            userUuid,
            body.enabled,
        );

        if (!preference) throw new NotFoundException('User not found');

        return { response: preference };
    }
}
