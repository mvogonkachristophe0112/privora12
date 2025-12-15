import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getPrismaClient } from "./prisma"

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const prisma = await getPrismaClient()

  return {
    adapter: PrismaAdapter(prisma) as any,
    providers: [
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user || !user.password) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
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
        if (user?.email) {
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
}
