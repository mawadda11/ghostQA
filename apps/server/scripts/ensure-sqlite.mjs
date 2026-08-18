import { open } from "node:fs/promises";
import { URL, fileURLToPath } from "node:url";

const databasePath = fileURLToPath(
  new URL("../prisma/dev.db", import.meta.url),
);

// Opening in append mode creates a missing SQLite file without truncating an
// existing developer database. Prisma remains responsible for every schema
// change through the checked-in migrations.
const database = await open(databasePath, "a");
await database.close();
