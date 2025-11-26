// Lazy-loaded Prisma client to prevent build-time instantiation
let prisma: any = null

export async function getPrismaClient() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    // In development, attach to global to prevent hot reload issues
    if (process.env.NODE_ENV !== 'production') {
      const globalForPrisma = globalThis as unknown as {
        prisma: typeof prisma | undefined
      }
      if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = prisma
      }
    }
  }
  return prisma
}

// For backward compatibility - this will be lazy loaded
export const prismaPromise = getPrismaClient()