// Borra solo los datos de prueba (usuarios con los emails de prueba y sus
// datos asociados) y los vuelve a insertar. Otros usuarios no se tocan.
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;
const PASSWORD = 'Test1234!';
const BCRYPT_SALT_ROUNDS = 12;
const now = new Date();

function monthDay(monthOffset, day) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, day, 12),
  );
}

function withTimestamps(doc) {
  return { ...doc, createdAt: monthDay(-3, 1), updatedAt: now };
}

function buildPrimaryUserData(userId) {
  const accounts = {};
  const categories = {};
  const tags = {};
  const transactions = [];

  const addAccount = (key, fields) => {
    accounts[key] = withTimestamps({
      _id: new ObjectId(),
      userId,
      currency: 'EUR',
      isArchived: false,
      initialBalance: 0,
      ...fields,
    });
  };

  const addCategory = ({ key, name, type, color, icon, parent }) => {
    const doc = withTimestamps({
      _id: new ObjectId(),
      userId,
      name,
      type,
      color,
      parentId: parent ? categories[parent]._id : null,
    });
    if (icon) doc.icon = icon;
    categories[key] = doc;
  };

  const addTag = (key, name, color) => {
    tags[key] = withTimestamps({ _id: new ObjectId(), userId, name, color });
  };

  const addTransaction = ({ month, day, notes, ...t }) => {
    const date = monthDay(month, day);
    if (date > now) return;
    const doc = withTimestamps({
      _id: new ObjectId(),
      userId,
      type: t.type,
      amount: t.amount,
      date,
      description: t.description,
      accountId: accounts[t.account]._id,
      targetAccountId: t.target ? accounts[t.target]._id : null,
      categoryId: t.category ? categories[t.category]._id : null,
      tagIds: (t.tags ?? []).map((key) => tags[key]._id),
    });
    if (notes) doc.notes = notes;
    transactions.push(doc);
  };

  addAccount('checking', {
    name: 'Cuenta corriente',
    type: 'checking',
    initialBalance: 150000,
  });
  addAccount('savings', {
    name: 'Ahorros',
    type: 'savings',
    initialBalance: 500000,
  });
  addAccount('cash', { name: 'Efectivo', type: 'cash', initialBalance: 20000 });
  addAccount('card', { name: 'Tarjeta de crédito', type: 'credit_card' });
  addAccount('archived', {
    name: 'Cuenta antigua',
    type: 'checking',
    initialBalance: 30000,
    isArchived: true,
  });

  addCategory({
    key: 'nomina',
    name: 'Nómina',
    type: 'income',
    color: '#2E7D32',
    icon: 'work',
  });
  addCategory({
    key: 'otros-ingresos',
    name: 'Otros ingresos',
    type: 'income',
    color: '#66BB6A',
  });
  addCategory({
    key: 'alimentacion',
    name: 'Alimentación',
    type: 'expense',
    color: '#EF6C00',
    icon: 'restaurant',
  });
  addCategory({
    key: 'supermercado',
    name: 'Supermercado',
    type: 'expense',
    color: '#FB8C00',
    parent: 'alimentacion',
  });
  addCategory({
    key: 'restaurantes',
    name: 'Restaurantes',
    type: 'expense',
    color: '#F4511E',
    parent: 'alimentacion',
  });
  addCategory({
    key: 'vivienda',
    name: 'Vivienda',
    type: 'expense',
    color: '#6A1B9A',
    icon: 'home',
  });
  addCategory({
    key: 'alquiler',
    name: 'Alquiler',
    type: 'expense',
    color: '#8E24AA',
    parent: 'vivienda',
  });
  addCategory({
    key: 'suministros',
    name: 'Suministros',
    type: 'expense',
    color: '#AB47BC',
    parent: 'vivienda',
  });
  addCategory({
    key: 'transporte',
    name: 'Transporte',
    type: 'expense',
    color: '#1565C0',
    icon: 'directions_bus',
  });
  addCategory({
    key: 'ocio',
    name: 'Ocio',
    type: 'expense',
    color: '#AD1457',
    icon: 'movie',
  });

  addTag('imprescindible', 'Imprescindible', '#D32F2F');
  addTag('vacaciones', 'Vacaciones', '#0097A7');
  addTag('trabajo', 'Trabajo', '#455A64');
  addTag('reembolsable', 'Reembolsable', '#7B1FA2');

  const monthlyTemplates = [
    {
      type: 'income',
      amount: 250000,
      day: 25,
      description: 'Nómina mensual',
      account: 'checking',
      category: 'nomina',
      tags: ['trabajo'],
    },
    {
      type: 'expense',
      amount: 95000,
      day: 1,
      description: 'Alquiler del piso',
      account: 'checking',
      category: 'alquiler',
      tags: ['imprescindible'],
    },
    {
      type: 'expense',
      amount: 12000,
      day: 5,
      description: 'Factura de luz y agua',
      account: 'checking',
      category: 'suministros',
      tags: ['imprescindible'],
    },
    {
      type: 'expense',
      amount: 8450,
      day: 7,
      description: 'Compra semanal',
      account: 'checking',
      category: 'supermercado',
    },
    {
      type: 'expense',
      amount: 11230,
      day: 14,
      description: 'Compra semanal',
      account: 'card',
      category: 'supermercado',
      notes: 'Compra grande de la quincena',
    },
    {
      type: 'expense',
      amount: 6975,
      day: 21,
      description: 'Compra semanal',
      account: 'checking',
      category: 'supermercado',
    },
    {
      type: 'expense',
      amount: 4500,
      day: 12,
      description: 'Cena con amigos',
      account: 'card',
      category: 'restaurantes',
      tags: ['reembolsable'],
    },
    {
      type: 'expense',
      amount: 4000,
      day: 3,
      description: 'Abono de transporte',
      account: 'cash',
      category: 'transporte',
    },
    {
      type: 'expense',
      amount: 3000,
      day: 19,
      description: 'Cine',
      account: 'card',
      category: 'ocio',
    },
    {
      type: 'income',
      amount: 15000,
      day: 15,
      description: 'Venta de muebles usados',
      account: 'cash',
      category: 'otros-ingresos',
    },
    {
      type: 'transfer',
      amount: 50000,
      day: 26,
      description: 'Ahorro mensual',
      account: 'checking',
      target: 'savings',
    },
  ];
  for (const month of [-2, -1, 0]) {
    for (const template of monthlyTemplates) {
      addTransaction({ ...template, month });
    }
  }

  addTransaction({
    month: -1,
    day: 10,
    type: 'expense',
    amount: 45000,
    description: 'Billetes de avión',
    account: 'card',
    category: 'ocio',
    tags: ['vacaciones'],
    notes: 'Viaje de verano',
  });
  addTransaction({
    month: -1,
    day: 18,
    type: 'expense',
    amount: 22000,
    description: 'Hotel',
    account: 'card',
    category: 'ocio',
    tags: ['vacaciones'],
  });
  addTransaction({
    month: -1,
    day: 28,
    type: 'expense',
    amount: 3500,
    description: 'Comida del viaje',
    account: 'cash',
    category: 'restaurantes',
    tags: ['vacaciones', 'reembolsable'],
  });

  return {
    accounts: Object.values(accounts),
    categories: Object.values(categories),
    tags: Object.values(tags),
    transactions,
  };
}

function buildSecondaryUserData(userId) {
  const account = withTimestamps({
    _id: new ObjectId(),
    userId,
    name: 'Cuenta principal',
    type: 'checking',
    currency: 'EUR',
    initialBalance: 80000,
    isArchived: false,
  });
  const category = withTimestamps({
    _id: new ObjectId(),
    userId,
    name: 'Alimentación',
    type: 'expense',
    color: '#EF6C00',
    parentId: null,
  });
  const tag = withTimestamps({
    _id: new ObjectId(),
    userId,
    name: 'Trabajo',
    color: '#455A64',
  });
  const transactions = [
    withTimestamps({
      _id: new ObjectId(),
      userId,
      type: 'expense',
      amount: 6200,
      date: monthDay(-1, 3),
      description: 'Compra semanal',
      accountId: account._id,
      targetAccountId: null,
      categoryId: category._id,
      tagIds: [tag._id],
    }),
    withTimestamps({
      _id: new ObjectId(),
      userId,
      type: 'expense',
      amount: 1800,
      date: monthDay(-1, 9),
      description: 'Café',
      accountId: account._id,
      targetAccountId: null,
      categoryId: category._id,
      tagIds: [],
    }),
  ];

  return {
    accounts: [account],
    categories: [category],
    tags: [tag],
    transactions,
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed no puede ejecutarse con NODE_ENV=production');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está definida');
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

    const primaryId = new ObjectId();
    const secondaryId = new ObjectId();
    const primaryData = buildPrimaryUserData(primaryId);
    const secondaryData = buildSecondaryUserData(secondaryId);

    const users = [
      withTimestamps({
        _id: primaryId,
        email: 'prueba@finanzas.local',
        name: 'Usuario de prueba',
        passwordHash,
        refreshTokenHash: null,
      }),
      withTimestamps({
        _id: secondaryId,
        email: 'otra@finanzas.local',
        name: 'Otra usuaria',
        passwordHash,
        refreshTokenHash: null,
      }),
    ];

    const collections = {
      users,
      accounts: [...primaryData.accounts, ...secondaryData.accounts],
      categories: [...primaryData.categories, ...secondaryData.categories],
      tags: [...primaryData.tags, ...secondaryData.tags],
      transactions: [
        ...primaryData.transactions,
        ...secondaryData.transactions,
      ],
    };

    await db.collection('users').deleteMany({
      email: { $in: users.map((user) => user.email) },
    });
    const seededUserIds = users.map((user) => user._id);
    for (const [name, documents] of Object.entries(collections)) {
      if (name !== 'users') {
        await db
          .collection(name)
          .deleteMany({ userId: { $in: seededUserIds } });
      }
      await db.collection(name).insertMany(documents);
      console.log(`${name}: ${documents.length} documentos`);
    }

    console.log('\nUsuarios de prueba (misma contraseña):');
    console.log(`  prueba@finanzas.local / ${PASSWORD}`);
    console.log(`  otra@finanzas.local / ${PASSWORD}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
