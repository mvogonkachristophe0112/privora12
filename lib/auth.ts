import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getPrismaClient } from "./prisma"

export async function getAuthOptions(): Promise<NextAuthOptions> {
  console.log('Checking environment variables...')
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL)
  console.log('NEXTAUTH_SECRET set:', !!process.env.NEXTAUTH_SECRET)
  console.log('NEXTAUTH_URL set:', !!process.env.NEXTAUTH_URL)

  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required but not set')
  }

  let prisma: any = null
  try {
    console.log('Initializing Prisma client for authentication...')
    prisma = await getPrismaClient()
    if (prisma) {
      console.log('Prisma client initialized successfully')
      // Test database connection
      try {
        await prisma.$connect()
        console.log('Database connection test successful')
      } catch (dbError) {
        console.error('Database connection test failed:', dbError)
        prisma = null // Disable if connection fails
      }
    } else {
      console.error('Prisma client initialization returned null')
    }
  } catch (error) {
    console.error('Database connection failed during auth configuration:', error)
    // Continue without adapter for environments where DB isn't available
  }

  const options: NextAuthOptions = {
    ...(prisma && { adapter: PrismaAdapter(prisma) as any }),
    providers: [
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
            try {
              console.log('Sign-in attempt for:', credentials?.email)
              if (!credentials?.email || !credentials?.password) {
                console.log('Missing credentials')
                return null
              }

              if (!prisma) {
                console.error('Database not available for authentication')
                throw new Error('Database connection not available')
              }

              console.log('Querying database for user:', credentials.email)
              const user = await prisma.user.findUnique({
                where: { email: credentials.email }
              })

              if (!user) {
                console.log('User not found in database:', credentials.email)
                // Log failed login attempt
                if (prisma) {
                  try {
                    await prisma.auditLog.create({
                      data: {
                        action: 'LOGIN_FAILED',
                        resource: 'user',
                        resourceId: null,
                        details: JSON.stringify({ email: credentials.email, reason: 'user_not_found' }),
                        ipAddress: null, // Would need to get from request
                        severity: 'LOW'
                      }
                    })
                  } catch (auditError) {
                    console.error('Failed to log audit:', auditError)
                  }
                }
                return null
              }

              if (!user.password) {
                console.log('User has no password set:', credentials.email)
                return null
              }

              console.log('Comparing password for user:', credentials.email)
              const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
              console.log('Password validation result:', isPasswordValid)

              if (!isPasswordValid) {
                console.log('Invalid password for user:', credentials.email)
                // Log failed login attempt
                try {
                  await prisma.auditLog.create({
                    data: {
                      action: 'LOGIN_FAILED',
                      resource: 'user',
                      resourceId: user.id,
                      details: JSON.stringify({ email: credentials.email, reason: 'invalid_password' }),
                      ipAddress: null,
                      severity: 'LOW'
                    }
                  })
                } catch (auditError) {
                  console.error('Failed to log audit:', auditError)
                }
                return null
              }

              console.log('Sign-in successful for:', user.email)
              // Log successful login
              try {
                await prisma.auditLog.create({
                  data: {
                    userId: user.id,
                    action: 'LOGIN_SUCCESS',
                    resource: 'user',
                    resourceId: user.id,
                    details: JSON.stringify({ email: user.email }),
                    ipAddress: null,
                    severity: 'LOW'
                  }
                })
              } catch (auditError) {
                console.error('Failed to log audit:', auditError)
              }
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              }
            } catch (error) {
              console.error('Authentication error:', error)
              throw error // Re-throw to let NextAuth handle it
            }
           }
       })
    ],
    session: {
      strategy: "jwt"
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.role = user.role
          token.email = user.email
        }
        return token
      },
      async session({ session, token }) {
        if (token) {
          session.user.id = token.sub!
          session.user.role = token.role as string
          // Ensure email is available in session
          if (token.email) {
            session.user.email = token.email
          }
        }
        return session
      },
      async signIn({ user, account, profile }) {
        // When user signs in, ensure they're marked as verified and update presence
        if (user?.email && prisma) {
          try {
            // Update user's last login time and ensure they're verified
            await prisma.user.update({
              where: { email: user.email },
              data: {
                emailVerified: new Date(),
                // You could add a lastLogin field here if you want to track it
              }
            })

            console.log(`User ${user.email} signed in and marked as verified`)
          } catch (error) {
            console.error('Error updating user on sign in:', error)
          }
        }
        return true
      }
    },
    pages: {
      signIn: "/login"
    }
  }

  return options
}
