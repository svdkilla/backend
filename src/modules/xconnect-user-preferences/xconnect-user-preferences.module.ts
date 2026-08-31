import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { XConnectUserPreferencesController } from './xconnect-user-preferences.controller';
import { XConnectUserPreferencesService } from './xconnect-user-preferences.service';

@Module({
    imports: [CqrsModule],
    controllers: [XConnectUserPreferencesController],
    providers: [XConnectUserPreferencesService],
    exports: [XConnectUserPreferencesService],
})
export class XConnectUserPreferencesModule {}
