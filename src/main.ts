import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { inspect } from 'util';

async function bootstrap() {
  inspect.defaultOptions.depth = null;
  // filter out noisy getAllRoutes console logs
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    // Only allow Nest framework logs and main startup logs
    if (
      message.startsWith('[Nest') ||
      message.startsWith('[Main]') ||
      message.startsWith('Bootstrap error') ||
      message.startsWith('[ExceptionsHandler]')
    ) {
      originalConsoleLog(...args);
    }
    // Other console.log calls are suppressed
  };
  // Enable NestJS logger for errors and warnings
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Set HTTP server timeout settings to prevent premature connection resets
  // const httpServer: any = app.getHttpServer();
  // httpServer.keepAliveTimeout = 30000; // 30 seconds
  // httpServer.headersTimeout = 65000; // 65 seconds
  // console.log(
  //   '[Main] HTTP server keepAliveTimeout:',
  //   httpServer.keepAliveTimeout,
  // );
  // console.log('[Main] HTTP server headersTimeout:', httpServer.headersTimeout);
  await app.listen(process.env.PORT ?? 3000);
  console.log('[Main] Application listening on port', process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
