const { Client } = require("pg");
async function run() {
  const client = new Client({
    host: "aws-1-us-west-1.pooler.supabase.com", port: 6543,
    user: "postgres.vebwxcezwrrbirsiyyur", password: "P2jUFAHE0ZSXT9jX",
    database: "postgres", ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const userId = 3;

  const { rows: ets } = await client.query(`SELECT COUNT(*) as c FROM "EventType" WHERE "userId"=$1`, [userId]);
  if (parseInt(ets[0].c) === 0) {
    const types = [
      { title: 'Appel découverte 15 min', slug: 'appel-15min', length: 15, desc: 'Un appel rapide pour faire connaissance.', locations: '[{"type":"integrations:google:meet"}]' },
      { title: 'Consultation 30 min', slug: 'consultation-30min', length: 30, desc: 'Consultation détaillée.', locations: '[{"type":"integrations:google:meet"}]' },
      { title: 'Réunion 1h', slug: 'reunion-1h', length: 60, desc: 'Réunion approfondie.', locations: '[{"type":"integrations:google:meet"}]' },
    ];
    for (const et of types) {
      await client.query(`INSERT INTO "EventType" ("userId", title, slug, description, length, locations, "eventName")
        VALUES ($1, $2, $3, $4, $5, $6, $2)`, [userId, et.title, et.slug, et.desc, et.length, et.locations]);
    }
    console.log("Created 3 event types");
  } else {
    console.log(ets[0].c, "event types already exist");
  }

  // Verify
  const { rows: all } = await client.query(`SELECT id, title, slug FROM "EventType" WHERE "userId"=$1`, [userId]);
  console.log("Event types:", all);

  await client.end();
}
run();
