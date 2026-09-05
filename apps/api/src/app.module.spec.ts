// Boots every module together with no database. It is the one check that
// fails if the QUOTE_STATE_PORT swap, a controller registration or any
// cross-module provider breaks - all things unit tests happily miss.
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './modules/shared/prisma.service';

describe('AppModule', () => {
  it('resolves the whole DI graph and registers every owner’s routes', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const router = app.getHttpAdapter().getInstance()._router;
    const routes: string[] = router.stack
      .filter((layer: { route?: unknown }) => layer.route)
      .map((layer: { route: { path: string } }) => layer.route.path);

    // B1's own endpoints
    expect(routes).toEqual(expect.arrayContaining(['/auth/login', '/quotes', '/quotes/:id/submit', '/quotes/:id/confirm', '/orders']));
    // B2 mounts /evaluate under B1's `quotes` prefix - the merge must not drop either
    expect(routes).toEqual(expect.arrayContaining(['/quotes/:id/evaluate', '/approvals']));
    // B3's operations + billing
    expect(routes).toEqual(
      expect.arrayContaining(['/inventory', '/fulfillments', '/invoices', '/invoices/:id/payments', '/subscriptions']),
    );
    // Three owners declare an `orders` controller. Nest must merge them, not
    // let the last one registered win.
    expect(routes).toEqual(
      expect.arrayContaining(['/orders', '/orders/:id/allocation-plan', '/orders/:id/invoices']),
    );

    await app.close();
  });
});
