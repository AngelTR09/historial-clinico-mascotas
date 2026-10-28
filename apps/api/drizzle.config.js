import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

loadDotenv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "./src/db/schema.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
