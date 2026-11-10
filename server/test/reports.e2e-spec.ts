import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { Account } from './../src/modules/accounts/account.schema.js';
import { User } from './../src/modules/users/user.schema.js';
import { Transaction } from './../src/modules/transactions/transaction.schema.js';

const CSV_HEADER = 'date,type,description,amount,account,category,tags';

describe('ReportsController (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<User>;
  let accountModel: Model<Account>;
  let transactionModel: Model<Transaction>;
  let userId: string;
  let cookie: string;

  const email = `reports-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    accountModel = moduleFixture.get<Model<Account>>(getModelToken(Account.name));
    transactionModel = moduleFixture.get<Model<Transaction>>(
      getModelToken(Transaction.name),
    );

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name: 'Reportes' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    userId = login.body.id;
    cookie = (login.headers['set-cookie'] as unknown as string[])
      .map((value) => value.split(';')[0])
      .join('; ');

    const account = await accountModel.create({
      userId,
      name: 'Banco',
      type: 'checking',
      initialBalance: 0,
      currency: 'EUR',
    });

    await transactionModel.create({
      userId,
      type: 'expense',
      amount: 1550,
      date: new Date('2024-03-10T12:00:00.000Z'),
      description: 'Supermercado, centro',
      accountId: account._id,
      targetAccountId: null,
      categoryId: null,
      tagIds: [],
    });
  });

  afterAll(async () => {
    if (userId) {
      await transactionModel.deleteMany({ userId });
      await accountModel.deleteMany({ userId });
      await userModel.deleteOne({ _id: userId });
    }
    await app?.close();
  });

  it('GET /api/reports/monthly?format=csv devuelve CSV con BOM, cabeceras y transacciones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/monthly')
      .query({ period: '2024-03', format: 'csv' })
      .set('Cookie', cookie)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(
      'filename="reporte-2024-03.csv"',
    );

    const body = res.text;
    expect(body.charCodeAt(0)).toBe(0xfeff);

    const lines = body.slice(1).trim().split(/\r?\n/);
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '2024-03-10,expense,"Supermercado, centro",15.50,Banco,,',
    );
  });

  it('CSV de un mes sin transacciones contiene solo cabeceras', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/monthly')
      .query({ period: '2020-01', format: 'csv' })
      .set('Cookie', cookie)
      .expect(200);

    const lines = res.text.slice(1).trim().split(/\r?\n/);
    expect(lines).toEqual([CSV_HEADER]);
  });

  it('GET /api/reports/monthly?format=pdf devuelve un PDF', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/monthly')
      .query({ period: '2024-03', format: 'pdf' })
      .set('Cookie', cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(
      'filename="reporte-2024-03.pdf"',
    );
    expect((res.body as Buffer).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('rechaza peticiones sin autenticación', () => {
    return request(app.getHttpServer())
      .get('/api/reports/monthly')
      .query({ period: '2024-03', format: 'csv' })
      .expect(401);
  });
});
