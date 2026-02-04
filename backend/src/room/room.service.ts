import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MediasoupService } from '../mediasoup/mediasoup.service';
import * as mediasoup from 'mediasoup';

interface Room {
  id: string;
  router: mediasoup.types.Router;
  peers: Map<string, Peer>;
}

interface Peer {
  id: string;
  socketId: string;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  rtpCapabilities: mediasoup.types.RtpCapabilities;
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private rooms: Map<string, Room> = new Map();

  constructor(private mediasoupService: MediasoupService) {}

  async createRoom(): Promise<string> {
    const roomId = uuidv4();
    const router = await this.mediasoupService.createRouter();

    const room: Room = {
      id: roomId,
      router,
      peers: new Map(),
    };

    this.rooms.set(roomId, room);
    this.logger.log(`Room created: ${roomId}`);
    return roomId;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  async createWebRtcTransport(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: '127.0.0.1',
          announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(
    roomId: string,
    peerId: string,
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    await transport.connect({ dtlsParameters });
  }

  async createProducer(
    roomId: string,
    peerId: string,
    transportId: string,
    rtpParameters: mediasoup.types.RtpParameters,
    kind: mediasoup.types.MediaKind,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.set(producer.id, producer);

    // Notify other peers about new producer
    const otherPeers = Array.from(room.peers.values()).filter(
      (p) => p.id !== peerId,
    );

    return {
      id: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters,
      otherPeers: otherPeers.map((p) => ({
        peerId: p.id,
        socketId: p.socketId,
      })),
    };
  }

  async createConsumer(
    roomId: string,
    peerId: string,
    transportId: string,
    producerId: string,
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    // Find the producer
    let producer: mediasoup.types.Producer | undefined;
    for (const otherPeer of room.peers.values()) {
      if (otherPeer.producers.has(producerId)) {
        producer = otherPeer.producers.get(producerId);
        break;
      }
    }

    if (!producer) {
      throw new Error('Producer not found');
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: peer.rtpCapabilities,
    });

    peer.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  addPeer(roomId: string, peerId: string, socketId: string, rtpCapabilities: mediasoup.types.RtpCapabilities) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer: Peer = {
      id: peerId,
      socketId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      rtpCapabilities,
    };

    room.peers.set(peerId, peer);
    this.logger.log(`Peer ${peerId} added to room ${roomId}`);
  }

  removePeer(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      return;
    }

    // Close all transports
    peer.transports.forEach((transport) => transport.close());
    peer.producers.forEach((producer) => producer.close());
    peer.consumers.forEach((consumer) => consumer.close());

    room.peers.delete(peerId);
    this.logger.log(`Peer ${peerId} removed from room ${roomId}`);

    // If room is empty, close it
    if (room.peers.size === 0) {
      room.router.close();
      this.rooms.delete(roomId);
      this.logger.log(`Room ${roomId} closed`);
    }
  }

  getRouterRtpCapabilities(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    return room.router.rtpCapabilities;
  }
}
