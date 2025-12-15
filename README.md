# Privora12 - Secure File Sharing Platform

A Next.js application for secure file sharing with real-time notifications, built exclusively for Vercel deployment with Neon PostgreSQL database.

## 🚀 Deployment

This application is configured for **Vercel-only deployment** and is not intended to run locally. The live application is available at:

**[https://privora12-jhpk3ne82-mvogonka-christophes-projects.vercel.app](https://privora12-jhpk3ne82-mvogonka-christophes-projects.vercel.app)**

## ⚙️ Setup Instructions

### Prerequisites
- Vercel account
- Neon PostgreSQL database
- Gmail account (for email notifications)

### Environment Variables Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure Vercel Environment Variables:**
   In your Vercel dashboard, add the following environment variables:

   ```
   DATABASE_URL=postgresql://your-neon-connection-string
   NEXTAUTH_SECRET=your-secure-random-secret-here
   NEXTAUTH_URL=https://your-vercel-app-url.vercel.app
   NEXT_PUBLIC_SOCKET_URL=https://your-vercel-app-url.vercel.app
   EMAIL_FROM=noreply@yourdomain.com
   EMAIL_SMTP_HOST=smtp.gmail.com
   EMAIL_SMTP_PORT=587
   EMAIL_SMTP_USER=your-email@gmail.com
   EMAIL_SMTP_PASS=your-app-password
   EMAIL_SECURE=false
   APP_NAME=Privora12
   APP_URL=https://your-vercel-app-url.vercel.app
   ```

### Database Setup

1. **Create Neon PostgreSQL Database:**
   - Sign up at [neon.tech](https://neon.tech)
   - Create a new project
   - Copy the connection string

2. **Run Database Migrations:**
   ```bash
   npx prisma db push
   ```

### Deployment

1. **Connect to Vercel:**
   ```bash
   npx vercel --prod
   ```

2. **Set Environment Variables** in Vercel dashboard under Project Settings > Environment Variables

3. **Deploy:**
   ```bash
   npx vercel --prod
   ```

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **Real-time:** Socket.io
- **File Storage:** Vercel Blob
- **Email:** Nodemailer (Gmail SMTP)
- **Deployment:** Vercel
- **Styling:** Tailwind CSS

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
