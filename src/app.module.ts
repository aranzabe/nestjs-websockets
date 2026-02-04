import { Module } from '@nestjs/common';
import { WebsocketsModule } from './websockets/websockets.module';
import { WebsocketsService } from './websockets/websockets.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [WebsocketsModule,
            ConfigModule.forRoot({
                      isGlobal: true, // Esto carga automáticamente el .env usando dotenv por dentro. Disponible en toda la app
                  }),
            MongooseModule.forRoot(`mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,)
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class AppModule {}
