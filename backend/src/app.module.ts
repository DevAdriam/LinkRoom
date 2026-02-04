import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomModule } from './room/room.module';
import { MediasoupModule } from './mediasoup/mediasoup.module';

@Module({
  imports: [RoomModule, MediasoupModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
