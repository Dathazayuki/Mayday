import { Module } from '@nestjs/common';
import { LegacyW4Controller } from './legacy-w4.controller.js';
import { LegacyW4Repository } from './legacy-w4.repository.js';
import { LegacyW4Service } from './legacy-w4.service.js';

/** Module tương thích Tuần 4 (`departments`, `rooms`, `templates`). */
@Module({
  controllers: [LegacyW4Controller],
  providers: [LegacyW4Service, LegacyW4Repository],
})
export class LegacyW4Module {}
