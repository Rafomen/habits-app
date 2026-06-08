import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export const getDb = cache(() => {
  const { env } = getRequestContext<{ ASSETS: Fetcher; habits_db: D1Database }>().ctx;
  const adapter = new PrismaD1(env.habits_db);
  return new PrismaClient({ adapter });
});

export default getDb;

declare function getRequestContext<T = any>(): { ctx: { env: T } };
