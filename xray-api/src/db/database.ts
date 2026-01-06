import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@localhost:5432/xray_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initializeDatabase(): Promise<void> {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");
    await pool.query(schema);
    console.log("DB schema initialized");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

export default pool;
