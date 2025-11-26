import NextAuth from "next-auth"
import { getAuthOptions } from "@/lib/auth"

const handler = async (req: any, res: any) => {
  const authOptions = await getAuthOptions()
  return NextAuth(authOptions)(req, res)
}

export { handler as GET, handler as POST }