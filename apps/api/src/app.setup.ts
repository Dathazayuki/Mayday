import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@drmayday/shared';

/** Cấu hình dùng chung cho main.ts và e2e test. */
export function configureApp(app: INestApplication): void {
  const prefix = API_PREFIX.replace(/^\//, '');
  app.setGlobalPrefix(prefix);
  app.enableCors();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('DrMayDay API')
      .setDescription('Tài liệu chuẩn: docs/02-api/README.md')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${prefix}/docs`, app, document);
}
