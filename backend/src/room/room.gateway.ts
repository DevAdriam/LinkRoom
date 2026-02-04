import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomService } from './room.service';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Allow localhost and network IPs
      const allowedPatterns = [
        /^http:\/\/localhost:3000$/,
        /^http:\/\/127\.0\.0\.1:3000$/,
        /^http:\/\/192\.168\.\d+\.\d+:3000$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:3000$/,
      ];
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      callback(null, isAllowed);
    },
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);
  private socketToPeerId: Map<string, string> = new Map();
  private socketToRoomId: Map<string, string> = new Map();

  constructor(private roomService: RoomService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const roomId = this.socketToRoomId.get(client.id);
    const peerId = this.socketToPeerId.get(client.id);

    if (roomId && peerId) {
      this.roomService.removePeer(roomId, peerId);
      this.socketToRoomId.delete(client.id);
      this.socketToPeerId.delete(client.id);
    }
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(@ConnectedSocket() client: Socket) {
    try {
      const roomId = await this.roomService.createRoom();
      this.logger.log(`Room created: ${roomId} by client ${client.id}`);
      client.emit('roomCreated', { roomId });
      return { roomId };
    } catch (error) {
      this.logger.error(`Error creating room: ${error.message}`);
      client.emit('error', { message: error.message });
      return { error: error.message };
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; rtpCapabilities: any },
  ) {
    try {
      const { roomId, rtpCapabilities } = data;
      const room = this.roomService.getRoom(roomId);

      if (!room) {
        return {
          event: 'error',
          data: { message: 'Room not found' },
        };
      }

      const peerId = uuidv4();
      this.socketToPeerId.set(client.id, peerId);
      this.socketToRoomId.set(client.id, roomId);

      // Add peer with rtpCapabilities (can be null initially)
      this.roomService.addPeer(roomId, peerId, client.id, rtpCapabilities || { codecs: [], headerExtensions: [] });

      const routerRtpCapabilities = this.roomService.getRouterRtpCapabilities(roomId);

      // Get existing producers in the room (from other peers)
      const existingProducers: any[] = [];
      if (room) {
        for (const otherPeer of room.peers.values()) {
          if (otherPeer.id !== peerId) {
            // Get all producers from this peer
            for (const producer of otherPeer.producers.values()) {
              existingProducers.push({
                producerId: producer.id,
                peerId: otherPeer.id,
                kind: producer.kind,
              });
            }
          }
        }
      }

      return {
        event: 'joinedRoom',
        data: {
          peerId,
          routerRtpCapabilities,
          existingProducers,
        },
      };
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('updateRtpCapabilities')
  async handleUpdateRtpCapabilities(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string; rtpCapabilities: any },
  ) {
    try {
      const { roomId, peerId, rtpCapabilities } = data;
      // Update peer's rtpCapabilities
      const room = this.roomService.getRoom(roomId);
      if (room) {
        const peer = room.peers.get(peerId);
        if (peer) {
          peer.rtpCapabilities = rtpCapabilities;
        }
      }
      return {
        event: 'rtpCapabilitiesUpdated',
        data: { success: true },
      };
    } catch (error) {
      this.logger.error(`Error updating rtpCapabilities: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('createTransport')
  async handleCreateTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; peerId: string; direction?: string },
  ) {
    try {
      const { roomId, peerId, direction } = data;
      const transport = await this.roomService.createWebRtcTransport(roomId, peerId);

      const eventName = direction ? `transportCreated:${direction}` : 'transportCreated';
      client.emit(eventName, transport);

      return {
        event: eventName,
        data: transport,
      };
    } catch (error) {
      this.logger.error(`Error creating transport: ${error.message}`);
      client.emit('error', { message: error.message });
      client.emit('transportError', { message: error.message });
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('connectTransport')
  async handleConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      peerId: string;
      transportId: string;
      dtlsParameters: any;
    },
  ) {
    try {
      const { roomId, peerId, transportId, dtlsParameters } = data;
      await this.roomService.connectTransport(roomId, peerId, transportId, dtlsParameters);

      return {
        event: 'transportConnected',
        data: { transportId },
      };
    } catch (error) {
      this.logger.error(`Error connecting transport: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('produce')
  async handleProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      peerId: string;
      transportId: string;
      kind: string;
      rtpParameters: any;
    },
  ) {
    try {
      const { roomId, peerId, transportId, kind, rtpParameters } = data;
      const result = await this.roomService.createProducer(
        roomId,
        peerId,
        transportId,
        rtpParameters,
        kind as any,
      );

      // Notify other peers about new producer
      // The result already contains otherPeers info
      if (result.otherPeers && result.otherPeers.length > 0) {
        for (const otherPeer of result.otherPeers) {
          this.server.to(otherPeer.socketId).emit('newProducer', {
            producerId: result.id,
            peerId,
            kind: result.kind,
          });
        }
      }

      return {
        event: 'produced',
        data: {
          producerId: result.id,
          kind: result.kind,
        },
      };
    } catch (error) {
      this.logger.error(`Error producing: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('consume')
  async handleConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      peerId: string;
      transportId: string;
      producerId: string;
    },
  ) {
    try {
      const { roomId, peerId, transportId, producerId } = data;
      const consumer = await this.roomService.createConsumer(
        roomId,
        peerId,
        transportId,
        producerId,
      );

      return {
        event: 'consumed',
        data: consumer,
      };
    } catch (error) {
      this.logger.error(`Error consuming: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }
}
