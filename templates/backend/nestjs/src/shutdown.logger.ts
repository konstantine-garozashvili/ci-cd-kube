import { Injectable, OnApplicationShutdown } from '@nestjs/common';

/**
 * Reports that the shutdown sequence actually ran.
 *
 * `app.enableShutdownHooks()` alone is silent, so a container that dies on
 * SIGTERM looks identical whether it drained cleanly or was killed outright.
 * This provider makes the difference visible in the logs, and matches what the
 * Express and Hono templates print.
 *
 * Nest re-raises the signal after closing, so the container's exit code is 143
 * (128 + SIGTERM) rather than 0. That is the conventional code for a process
 * terminated by a signal and is what Kubernetes expects.
 */
@Injectable()
export class ShutdownLogger implements OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void {
    console.log(`\n🛑 Received ${signal ?? 'shutdown'}, draining connections...`);
    console.log('✅ HTTP server closed and database disconnected.');
  }
}
