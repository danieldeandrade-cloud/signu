'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/inicio');
    }
  }, [status, router]);

  const handleLogin = async () => {
    setCarregando(true);
    await signIn('google', { callbackUrl: '/inicio' });
  };

  if (status === 'loading') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#060f1e' }}>
        <div style={{ width:32, height:32, border:'2px solid rgba(201,168,76,0.2)', borderTop:'2px solid #c9a84c', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#060f1e',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Decoração de fundo */}
      <div style={{ position:'fixed', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-20%', left:'-10%', width:'50%', height:'50%', background:'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:'-20%', right:'-10%', width:'50%', height:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', borderRadius:'50%' }}/>
      </div>

      {/* Card de login */}
      <div style={{
        width: 380,
        background: 'linear-gradient(145deg, #0f2040 0%, #0a1628 100%)',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20,
        padding: '44px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.4s ease',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.05))',
            border: '1px solid rgba(201,168,76,0.3)',
            fontSize: 32,
            marginBottom: 20,
          }}>⚖️</div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', margin:'0 0 6px', letterSpacing:'-0.02em' }}>SIGNU</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:0 }}>NULEJ · TJDFT · Sistema de Gestão de Bens</p>
        </div>

        {/* Divisor */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }}/>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Acesso Institucional</span>
          <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }}/>
        </div>

        {/* Botão Google */}
        <button
          onClick={handleLogin}
          disabled={carregando}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: carregando ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
            color: carregando ? 'rgba(255,255,255,0.3)' : '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: carregando ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            transition: 'all 0.2s',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          onMouseEnter={e => { if (!carregando) { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; } }}
          onMouseLeave={e => { if (!carregando) { e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; } }}
        >
          {carregando ? (
            <>
              <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.15)', borderTop:'2px solid rgba(255,255,255,0.5)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
              Redirecionando…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com conta Google
            </>
          )}
        </button>

        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.2)', margin:'24px 0 0', lineHeight:1.6 }}>
          Use sua conta institucional Google.<br/>
          Acesso restrito a servidores do NULEJ/TJDFT.
        </p>
      </div>
    </div>
  );
}
