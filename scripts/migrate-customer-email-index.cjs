// Run without --apply to inspect the change. This migration never edits customers.
require('dotenv/config');
const { MongoClient } = require('mongodb');

async function main() {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    throw new Error('Configure MONGODB_URI and MONGODB_DB before running.');
  }
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DB);
    const { version } = await database.admin().command({ buildInfo: 1 });
    if (Number(version.split('.')[0]) < 5) {
      throw new Error('This migration requires MongoDB 5 or later.');
    }
    const collection = database.collection('customers');
    const indexes = await collection.indexes();
    const emailIndexes = indexes.filter(
      (index) => Object.keys(index.key).length === 1 && index.key.email === 1,
    );
    const legacy = emailIndexes.filter(
      (index) =>
        index.unique && !index.sparse && !index.partialFilterExpression,
    );
    const existingSparse = emailIndexes.find(
      (index) => index.unique && index.sparse,
    );
    const name = existingSparse?.name || 'IDX_CUSTOMER_EMAIL_UNIQUE';
    console.log(
      JSON.stringify(
        {
          mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
          createUniqueSparseIndex: name,
          removeLegacyIndexes: legacy.map((index) => index.name),
        },
        null,
        2,
      ),
    );
    if (!process.argv.includes('--apply')) return;

    // Build the replacement first: email uniqueness is protected throughout.
    await collection.createIndex(
      { email: 1 },
      {
        name,
        unique: true,
        sparse: true,
        ...(legacy[0]?.collation ? { collation: legacy[0].collation } : {}),
      },
    );
    for (const index of legacy) await collection.dropIndex(index.name);
    console.log(
      'Customer email index migrated; no customer documents changed.',
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  // Do not print connection strings or credential-bearing messages.
  console.error('Migration failed:', error.name, error.code ?? '');
  process.exitCode = 1;
});
