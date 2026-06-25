// auth.js — Configuração central do NextAuth (Google OAuth)
//
// Variáveis de ambiente necessárias (.env.local):
//   GOOGLE_CLIENT_ID       — OAuth 2.0 Client ID do GCP
//   GOOGLE_CLIENT_SECRET   — OAuth 2.0 Client Secret do GCP
//   NEXTAUTH_SECRET        — string aleatória (ex: openssl rand -base64 32)
//   NEXTAUTH_URL           — URL base da aplicação (ex: http://localhost:3000)

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    // Restringe acesso ao domínio TJDFT
    async signIn({ profile }) {
      // Para restringir apenas a @tjdft.jus.br, descomente a linha abaixo:
      // return profile?.email?.endsWith('@tjdft.jus.br') ?? false;
      return true; // Permite qualquer conta Google por enquanto
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub;
      }
      return session;
    },

    async jwt({ token, profile }) {
      if (profile) {
        token.sub = profile.sub;
      }
      return token;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
