import { Module } from '@nestjs/common';
import { WebsocketsModule } from './websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
