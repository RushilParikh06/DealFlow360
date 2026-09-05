import 'dotenv/config';
import 'temporal-polyfill/global';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('B1 – Sales Core (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('Complete Sales Workflow', () => {
    let customerId: number;
    let leadId: number;
    let dealId: number;
    let activityId: number;
    const testEmail = `salescore_${Date.now()}@example.com`;

    // 1. Create Customer
    it('POST /customers - should create a new customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({
          name: 'Apex Innovations',
          email: testEmail,
          phone: '+1 555-0199',
          company: 'Apex Global',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Apex Innovations');
      expect(res.body.email).toBe(testEmail);
      customerId = res.body.id;
    });

    // 2. Fetch Customer
    it('GET /customers - should fetch list of customers', async () => {
      const res = await request(app.getHttpServer())
        .get('/customers')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((c: any) => c.id === customerId);
      expect(found).toBeDefined();
    });

    it('GET /customers/:id - should fetch specific customer', async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${customerId}`)
        .expect(200);

      expect(res.body.id).toBe(customerId);
      expect(res.body.name).toBe('Apex Innovations');
    });

    // Validation & Error Handling
    it('POST /customers - should reject invalid email with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({
          name: 'Invalid Email Customer',
          email: 'not-an-email',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('GET /customers/:id - should return 404 for non-existent customer', async () => {
      await request(app.getHttpServer())
        .get('/customers/999999')
        .expect(404);
    });

    it('POST /customers - should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/customers')
        .send({
          name: 'Duplicate Customer',
          email: testEmail,
        })
        .expect(409);
    });

    // 3. Create Lead
    it('POST /leads - should create a new lead', async () => {
      const res = await request(app.getHttpServer())
        .post('/leads')
        .send({
          title: 'Cloud Infrastructure Upgrade',
          source: 'Website',
          status: 'NEW',
          contactName: 'Sarah Connor',
          contactEmail: `sarah_${Date.now()}@apex.com`,
          contactPhone: '+1 555-0244',
          company: 'Apex Global',
          notes: 'Interested in annual enterprise subscription',
          customerId,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Cloud Infrastructure Upgrade');
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.status).toBe('NEW');
      leadId = res.body.id;
    });

    // 4. Fetch & Update Lead
    it('GET /leads/:id - should fetch lead', async () => {
      const res = await request(app.getHttpServer())
        .get(`/leads/${leadId}`)
        .expect(200);

      expect(res.body.id).toBe(leadId);
      expect(res.body.title).toBe('Cloud Infrastructure Upgrade');
    });

    it('PATCH /leads/:id - should update lead status to QUALIFIED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/leads/${leadId}`)
        .send({
          status: 'QUALIFIED',
          notes: 'Discovery call completed, budget approved.',
        })
        .expect(200);

      expect(res.body.status).toBe('QUALIFIED');
    });

    // 5. Convert Lead into Opportunity / Deal
    it('POST /leads/:id/convert - should convert qualified lead into deal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/leads/${leadId}/convert`)
        .send({
          dealTitle: 'Apex Cloud Migration Contract',
          dealValue: 75000,
          pipeline: 'Enterprise SaaS Pipeline',
          expectedCloseDate: '2026-12-31T00:00:00.000Z',
        })
        .expect(201);

      expect(res.body.message).toBe('Lead converted successfully');
      expect(res.body.lead.status).toBe('CONVERTED');
      expect(res.body.deal).toBeDefined();
      expect(res.body.deal.title).toBe('Apex Cloud Migration Contract');
      expect(res.body.deal.value).toBe(75000);
      expect(res.body.deal.customerId).toBe(customerId);
      expect(res.body.deal.leadId).toBe(leadId);
      dealId = res.body.deal.id;
    });

    // 6. Fetch Opportunity / Deal (both /deals and /opportunities)
    it('GET /deals/:id - should fetch deal by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/deals/${dealId}`)
        .expect(200);

      expect(res.body.id).toBe(dealId);
      expect(res.body.stage).toBe('QUALIFICATION');
      expect(res.body.status).toBe('OPEN');
    });

    it('GET /opportunities/:id - alias endpoint should work identically', async () => {
      const res = await request(app.getHttpServer())
        .get(`/opportunities/${dealId}`)
        .expect(200);

      expect(res.body.id).toBe(dealId);
      expect(res.body.title).toBe('Apex Cloud Migration Contract');
    });

    // 7. Update Deal Stage & Close Won
    it('PATCH /deals/:id/stage - should advance stage to CLOSED_WON and auto-set status to WON', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/deals/${dealId}/stage`)
        .send({
          stage: 'CLOSED_WON',
        })
        .expect(200);

      expect(res.body.stage).toBe('CLOSED_WON');
      expect(res.body.status).toBe('WON');
      expect(res.body.closedAt).not.toBeNull();
    });

    // 8. Create Activity / Follow-up
    it('POST /activities - should log sales follow-up activity', async () => {
      const res = await request(app.getHttpServer())
        .post('/activities')
        .send({
          type: 'CALL',
          subject: 'Contract Signing Confirmation Call',
          description: 'Confirmed signed contract and onboarding schedule',
          status: 'COMPLETED',
          customerId,
          dealId,
          leadId,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.subject).toBe('Contract Signing Confirmation Call');
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.completedAt).not.toBeNull();
      activityId = res.body.id;
    });

    // 9. Fetch Related Sales Data
    it('GET /activities - should filter activities by dealId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/activities?dealId=${dealId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((a: any) => a.id === activityId);
      expect(found).toBeDefined();
    });

    it('GET /deals - should filter deals by customerId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/deals?customerId=${customerId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((d: any) => d.id === dealId);
      expect(found).toBeDefined();
    });

    // Cleanup
    it('Clean up created test data', async () => {
      await request(app.getHttpServer()).delete(`/activities/${activityId}`).expect(200);
      await request(app.getHttpServer()).delete(`/deals/${dealId}`).expect(200);
      await request(app.getHttpServer()).delete(`/leads/${leadId}`).expect(200);
      await request(app.getHttpServer()).delete(`/customers/${customerId}`).expect(200);
    });
  });
});
