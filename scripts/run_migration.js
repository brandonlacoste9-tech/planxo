const { Client } = require("pg");

async function run() {
  const client = new Client({
    host: "aws-1-us-west-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.vebwxcezwrrbirsiyyur",
    password: "P2jUFAHE0ZSXT9jX",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  // Add tax columns to Booking
  for (const col of [
    ["basePriceCents", "INTEGER NOT NULL DEFAULT 0"],
    ["tpsCents", "INTEGER NOT NULL DEFAULT 0"],
    ["tvqCents", "INTEGER NOT NULL DEFAULT 0"],
    ["totalCents", "INTEGER NOT NULL DEFAULT 0"],
  ]) {
    try {
      await client.query(`ALTER TABLE "Booking" ADD COLUMN "${col[0]}" ${col[1]}`);
      console.log(`Added Booking.${col[0]}`);
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log(`Booking.${col[0]} already exists, skipping`);
      } else throw err;
    }
  }

  // Add dataRegion to users
  try {
    await client.query(`ALTER TABLE "users" ADD COLUMN "dataRegion" TEXT NOT NULL DEFAULT 'ca-central-1'`);
    console.log("Added users.dataRegion");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("users.dataRegion already exists, skipping");
    } else throw err;
  }

  console.log("DONE");
  await client.end();
}

run();
