"use client";
import { useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { useRouter } from "next/navigation";

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: "0d32bd8c-25f9-4f3b-8fda-97c377d70602",
    authority: "https://login.microsoftonline.com/dc420092-2247-4330-8f15-f9d13eebeda4",
    redirectUri: "http://localhost:3000",
  },
  cache: { cacheLocation: "sessionStorage" },
});

export default function LoginPage() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setErro("");
    try {
      await msalInstance.initialize();
      const result = await msalInstance.loginPopup({
        scopes: ["User.Read"],
      });
      if (result?.account) {
        sessionStorage.setItem("signu_user", JSON.stringify({
          displayName: result.account.name,
          email: result.account.username,
        }));
        router.push("/inicio");
      }
    } catch (e) {
      console.error(e);
      setErro(e?.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height:"100vh",background:"#060f1e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"48px 40px",textAlign:"center",width:360,boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#c9a84c,#8b6914)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 20px" }}>⚖</div>
        <h1 style={{ fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 6px" }}>SIGNU</h1>
        <p style={{ fontSize:12,color:"rgba(201,168,76,0.7)",margin:"0 0 6px",letterSpacing:"0.1em",textTransform:"uppercase" }}>NULEJ · TJDFT</p>
        <p style={{ fontSize:12,color:"rgba(255,255,255,0.3)",margin:"0 0 36px" }}>Sistema de Gestão de Bens</p>
        <button onClick={handleLogin} disabled={loading} style={{ width:"100%",padding:"14px",background:loading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#0078d4,#005a9e)",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all 0.2s" }}>
          {loading ? "⟳ Aguarde..." : <>
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Entrar com conta Microsoft
          </>}
        </button>
        {erro && (
          <div style={{ marginTop:16,padding:"10px 14px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,fontSize:11,color:"#f87171",textAlign:"left",wordBreak:"break-word" }}>
            ⚠ {erro}
          </div>
        )}
        <p style={{ fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:20 }}>Use sua conta @tjdft.jus.br</p>
      </div>
    </div>
  );
}
