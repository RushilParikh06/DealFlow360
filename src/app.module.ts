import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CustomersModule } from './customers/customers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [CustomersModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
