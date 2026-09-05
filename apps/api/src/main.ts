// GROUP OWNED.
import 'reflect-metadata';
import { createServer } from 'node:net';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './modules/shared/all-exceptions.filter';
import { ResponseInterceptor } from './modules/shared/response.interceptor';

const logger = new Logger('Bootstrap');

/** Resolves true when nothing holds the port. Uses a throwaway server, never the app. */
function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

/**
 * `nest start --watch` spawns the replacement process before the outgoing one
 * has released the port, so the new process used to die on EADDRINUSE and take
 * the whole API down with it - silently, until someone restarted it by hand.
 * The frontend's only symptom was a sign-in button that did nothing.
 *
 * The port frees up in well under a second, so wait for it. The wait happens on
 * a probe socket rather than by retrying app.listen(), because every failed
 * listen leaves its handlers attached to the same server and Node starts
 * warning about leaked listeners.
 */
async function waitForPort(port: number): Promise<void> {
  const attempts = 24;
  const waitMs = 250;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await portIsFree(port)) return;
    if (attempt === 1) logger.warn(`Port ${port} busy (previous process shutting down), waiting...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  logger.error(
    `Port ${port} is still in use after ${(attempts * waitMs) / 1000}s. ` +
      `Another API is probably already running - stop it, or set API_PORT.`,
  );
  throw new Error(`EADDRINUSE: port ${port}`);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Release the port promptly on restart so the incoming process is not the one
  // doing the waiting.
  app.enableShutdownHooks();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
  }

  const port = Number(process.env.API_PORT ?? 3001);
  await waitForPort(port);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/${process.env.API_PREFIX ?? 'api/v1'}`);
}

void bootstrap();
