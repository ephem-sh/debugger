import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { initDebugger, DebuggerMiddleware } from '@ephem-sh/debugger/nest';

initDebugger({ port: 3000 });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const debuggerMiddleware = new DebuggerMiddleware();
  app.use((req: unknown, res: unknown, next: () => void) => {
    debuggerMiddleware.use(req as never, res as never, next);
  });

  await app.listen(3000);
}
bootstrap();
