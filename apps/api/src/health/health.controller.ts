import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService, type DatabaseStatus } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; db: DatabaseStatus; time: string }> {
    return { status: 'ok', db: await this.prisma.status(), time: new Date().toISOString() };
  }
}
