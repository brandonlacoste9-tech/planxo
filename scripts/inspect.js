
const { Client } = require("pg");
async function run() {
  const client = new Client({
    host: "aws-1-us-west-1.pooler.supabase.com", port: 6543,
    user: "postgres.vebwxcezwrrbirsiyyur", password: "P2jUFAHE0ZSXT9jX",
    database: "postgres", ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  
  // EventType columns
  let { rows } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'EventType' ORDER BY ordinal_position`);
  console.log("EventType columns:", JSON.stringify(rows.map(r => r.column_name + ":" + r.data_type)));
  
  // Existing event types for userId=3
  rows = (await client.query(`SELECT id, title, slug, "isActive", length, price FROM "EventType" WHERE "userId" = 3`)).rows;
  console.log("EventTypes for user 3:", JSON.stringify(rows));
  
  // Booking columns
  rows = (await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Booking' ORDER BY ordinal_position`)).rows;
  console.log("Booking columns:", JSON.stringify(rows.map(r => r.column_name + ":" + r.data_type)));
  
  await client.end();
}
run();
