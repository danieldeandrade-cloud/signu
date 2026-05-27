"use client";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  return (
    <div style={{ height:"100vh",background:"#060f1e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"48px 40px",textAlign:"center",width:360 }}>
        <div style={{ width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#c9a84c,#8b6914)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 20px" }}>⚖</div>
        <h1 style={{ fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 6px" }}>SIGNU</h1>
        <p style={{ fontSize:12,color:"rgba(201,168,76,0.7)",margin:"0 0 6px",letterSpacing:"0.1em",textTransform:"uppercase" }}>NULEJ · TJDFT</p>
        <p style={{ fontSize:12,color:"rgba(255,255,255,0.3)",margin:"0 0 36px" }}>Sistema de Gestão de Bens</p>
        <button onClick={() => router.push("/inicio")} style={{ width:"100%",padding:"14px",background:"linear-gradient(135deg,#0078d4,#005a9e)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Entrar com conta Microsoft
        </button>
        <p style={{ fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:20 }}>Use sua conta @tjdft.jus.br</p>
      </div>
    </div>
  );
}
