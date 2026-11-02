import { getDb } from "../src/db/client.ts";

async function runMigrations() {
  console.log("Initializing JSON data store...");
  await getDb().select().from((await import("../src/db/schema.ts")).users);
  console.log("JSON data store is ready.");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
