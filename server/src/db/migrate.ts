import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./client";

try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migraciones aplicadas.");
} finally {
    await client.end();
}