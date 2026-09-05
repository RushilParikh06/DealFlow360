"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Boots every module together with no database. It is the one check that
// fails if the QUOTE_STATE_PORT swap, a controller registration or any
// cross-module provider breaks - all things unit tests happily miss.
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("./app.module");
const prisma_service_1 = require("./modules/shared/prisma.service");
describe('AppModule', () => {
    it('resolves the whole DI graph and registers both owners routes', async () => {
        const moduleRef = await testing_1.Test.createTestingModule({ imports: [app_module_1.AppModule] })
            .overrideProvider(prisma_service_1.PrismaService)
            .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
            .compile();
        const app = moduleRef.createNestApplication();
        await app.init();
        const router = app.getHttpAdapter().getInstance()._router;
        const routes = router.stack
            .filter((layer) => layer.route)
            .map((layer) => layer.route.path);
        // B1's own endpoints
        expect(routes).toEqual(expect.arrayContaining(['/auth/login', '/quotes', '/quotes/:id/submit', '/quotes/:id/confirm', '/orders']));
        // B2 mounts /evaluate under B1's `quotes` prefix - the merge must not drop either
        expect(routes).toEqual(expect.arrayContaining(['/quotes/:id/evaluate', '/approvals']));
        await app.close();
    });
});
//# sourceMappingURL=app.module.spec.js.map