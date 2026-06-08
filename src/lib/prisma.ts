import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCloudflareContext: () => { env: { habits_db: any } };
};

export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  const adapter = new PrismaD1(env.habits_db);
  return new PrismaClient({ adapter });
});

export default getDb;
