import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from '../../prisma/contract.d.ts';
import contractJson from '../../prisma/contract.json' with { type: 'json' };

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db = postgres<Contract>({
    contractJson,
  });

  async onModuleInit() {
    await this.db.connect({
      url: process.env['DATABASE_URL']!,
    });
  }

  async onModuleDestroy() {
    await this.db.close();
  }
}