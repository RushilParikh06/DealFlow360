// B2 OWNED. Exports AIProviderService to every AI feature service in this module.

import { Module } from '@nestjs/common';
import { AIProviderService } from './ai-provider.service';

@Module({
  providers: [AIProviderService],
  exports: [AIProviderService],
})
export class AIModule {}
