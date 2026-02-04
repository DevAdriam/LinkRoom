import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { MediasoupModule } from '../mediasoup/mediasoup.module';

@Module({
  imports: [MediasoupModule],
  providers: [RoomService, RoomGateway],
  exports: [RoomService],
})
export class RoomModule {}
