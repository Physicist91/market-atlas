// MOCKED — in-memory mock for Drizzle ORM
console.warn('[AI Studio] Database not connected — using mock');
const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
};

export const db: any = new Proxy(
  {},
  {
    get: (_, prop) =>
      prop === 'query' ? new Proxy({}, { get: () => noOp }) : async () => [],
  }
);

export function getDb() {
  return db;
}
