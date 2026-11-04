/* Apply the SQL migrations in drizzle/ to DATABASE_URL (local file or Turso).
 * The baseline migration is idempotent, so this also works on a database that
 * was created with `drizzle-kit push` before migrations existed. */
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../src/db";

migrate(db, { migrationsFolder: "drizzle" })
  .then(() => { console.log("migrations applied"); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
