
const { Client } = require("pg");
async function run() {
  const client = new Client({
    host: "aws-1-us-west-1.pooler.supabase.com", port: 6543,
    user: "postgres.vebwxcezwrrbirsiyyur", password: "P2jUFAHE0ZSXT9jX",
    database: "postgres", ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Check users table id type and existing Schedule data
  let { rows } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
  console.log("users columns:", JSON.stringify(rows.map(r => r.column_name + ":" + r.data_type)));

  // Check Schedule data
  rows = (await client.query(`SELECT * FROM "Schedule"`)).rows;
  console.log("Schedule rows:", JSON.stringify(rows));

  // Check Availability data
  rows = (await client.query(`SELECT * FROM "Availability"`)).rows;
  console.log("Availability rows:", JSON.stringify(rows));

  await client.end();
}
run();
