// middleware.ts — Proteção de rotas do SIGNU
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// E-mails com acesso às telas restritas de Gestão e Cadastro
const GESTORES = [
  'daniel.andrade@tjdft.jus.br',
  'carlos.amorim@tjdft.jus.br',
];

const ROTAS_GESTORES = ['/gestao', '/cadastro', '/anotacoes'];

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Já está em /login — deixa passar
  if (pathname.startsWith('/login')) return NextResponse.next();

  // Sem sessão → redireciona para /login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Rotas restritas a gestores
  const rotaRestrita = ROTAS_GESTORES.some(r => pathname.startsWith(r));
  if (rotaRestrita) {
    const email = (token.email as string || '').toLowerCase();
    if (!GESTORES.includes(email)) {
      const inicioUrl = new URL('/inicio?acesso=negado', request.url);
      return NextResponse.redirect(inicioUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|api/notificacoes|_next/static|_next/image|favicon.ico).*)',
  ],
};
