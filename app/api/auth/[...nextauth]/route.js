// app/api/auth/[...nextauth]/route.js
// Rota do NextAuth para Next.js App Router

import NextAuth from 'next-auth';
import { authOptions } from '@/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
