import dns from "node:dns";
import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dns.setDefaultResultOrder("ipv6first");
dotenv.config();

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
