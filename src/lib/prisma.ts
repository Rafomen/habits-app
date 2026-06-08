import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export const getDb = cache(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = getRequestContext<any>().ctx;
  const adapter = new PrismaD1(env.habits_db);
  return new PrismaClient({ adapter });
});

export default getDb;

declare function getRequestContext<T = any>(): { ctx: { env: T } };
