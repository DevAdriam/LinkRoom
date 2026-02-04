import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mediasoup from 'mediasoup';

@Injectable()
export class MediasoupService implements OnModuleInit {
  private readonly logger = new Logger(MediasoupService.name);
  private worker: mediasoup.types.Worker;
  private workers: mediasoup.types.Worker[] = [];

  async onModuleInit() {
    await this.createWorkers();
  }

  private async createWorkers() {
    const numWorkers = 1; // You can increase this for production

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
      });

      worker.on('died', () => {
        this.logger.error('Mediasoup worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }

    this.worker = this.workers[0];
    this.logger.log(`Created ${numWorkers} mediasoup worker(s)`);
  }

  getWorker(): mediasoup.types.Worker {
    return this.worker;
  }

  async createRouter(mediaCodecs: mediasoup.types.RtpCodecCapability[] = []) {
    if (!this.worker) {
      await this.createWorkers();
    }

    const router = await this.worker.createRouter({
      mediaCodecs: mediaCodecs.length > 0 
        ? mediaCodecs 
        : [
            {
              kind: 'audio',
              mimeType: 'audio/opus',
              clockRate: 48000,
              channels: 2,
            },
            {
              kind: 'video',
              mimeType: 'video/VP8',
              clockRate: 90000,
            },
            {
              kind: 'video',
              mimeType: 'video/VP9',
              clockRate: 90000,
            },
            {
              kind: 'video',
              mimeType: 'video/H264',
              clockRate: 90000,
              parameters: {
                'packetization-mode': 1,
                'profile-level-id': '42e01f',
              },
            },
          ],
    });

    return router;
  }

  async close() {
    for (const worker of this.workers) {
      worker.close();
    }
  }
}
