import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const allowedEmails = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase())
  : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    signIn({ user }) {
      if (allowedEmails.length === 0) return true;
      return allowedEmails.includes(user.email?.toLowerCase() ?? '');
    },
  },
});
