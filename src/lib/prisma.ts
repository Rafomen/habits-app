import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const getDb = cache(() => {
  const ctx = getRequestContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaD1((ctx.env as any).habits_db);
  return new PrismaClient({ adapter });
});

export default getDb;
