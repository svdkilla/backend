import { Module } from '@nestjs/common';

import { XConnectUserPreferencesController } from './xconnect-user-preferences.controller';
import { XConnectUserPreferencesService } from './xconnect-user-preferences.service';

@Module({
    controllers: [XConnectUserPreferencesController],
    providers: [XConnectUserPreferencesService],
    exports: [XConnectUserPreferencesService],
})
export class XConnectUserPreferencesModule {}
