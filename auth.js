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
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase() ?? '';
      // Contas institucionais
      if (email.endsWith('@tjdft.jus.br')) return true;
      // Contas pessoais autorizadas (testes / acesso externo)
      const PERMITIDOS = [
        'carcae@gmail.com',              // Carlos Caetano — teste servidor
        'amandalobojunqueira@gmail.com', // Amanda Junqueira — teste servidor
        'danieldeandrade@icloud.com', // Daniel — gestor
      ];
      return PERMITIDOS.includes(email);
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
