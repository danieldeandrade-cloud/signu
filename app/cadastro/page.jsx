"use client";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useRef } from "react";

// Listas onde buscar duplicatas (todas)
const TODAS_LISTAS_ROTA = [
  { rota:"cegoc",              label:"CEGOC",        color:"#3b82f6" },
  { rota:"dpj",                label:"DPJ-GC99",     color:"#fb923c" },
  { rota:"pcdf1",              label:"PCDF 1ª",      color:"#a78bfa" },
  { rota:"pcdf2",              label:"PCDF 2ª",      color:"#c084fc" },
  { rota:"doacoes_diligencia", label:"Doações",      color:"#34d399" },
  { rota:"sei",                label:"Caixa SEI",    color:"#fbbf24" },
];

// Mapa: chave da lista → rota da API
const LISTA_API_MAP = {
  CEGOC:        "cegoc",
  DPJ_GC99:     "dpj",
  PCDF_1HIGEIA: "pcdf1",
  PCDF_2HIGEIA: "pcdf2",
  DOACOES:      "doacoes_diligencia",
  CAIXA_SEI:    "sei",
};

// ─── CONFIG DAS LISTAS ────────────────────────────────────────────────────────
const LISTAS_CONFIG = [
  { key:"CEGOC",         label:"CEGOC",          icon:"🏛️", color:"#3b82f6", bg:"#1e3a5f", desc:"Bens operacionais — diligências CEGOC" },
  { key:"DPJ_GC99",      label:"DPJ-GC99",       icon:"⚖️", color:"#fb923c", bg:"#5f2a0e", desc:"Lotes cíveis — controle de prazo 6 meses" },
  { key:"PCDF_1HIGEIA",  label:"PCDF 1ª HIGEIA", icon:"🚔", color:"#a78bfa", bg:"#3b1f5f", desc:"Bens na 1ª HIGEIA — expedição FIB" },
  { key:"PCDF_2HIGEIA",  label:"PCDF 2ª HIGEIA", icon:"🚔", color:"#c084fc", bg:"#4a1f6f", desc:"Bens na 2ª HIGEIA — baixa de veículo" },
  { key:"DOACOES",       label:"Doação",          icon:"🤝", color:"#34d399", bg:"#064e3b", desc:"Doações em andamento para entidades" },
  { key:"CAIXA_SEI",     label:"Caixa SEI",       icon:"📬", color:"#fbbf24", bg:"#451a03", desc:"Triagem de novos PAs recebidos via SEI" },
];

const SERVIDORES = [
  "Carla Araújo","Amanda Junqueira","Carlos Caetano",
  "Cláudia Santos","Loara Passo","Letícia Mota","Marcelo Oliveira",
];

const TIPOS_BEM    = ["CARRO","MOTO","CAMINHÃO","CAMINHONETE","REBOQUE","OUTROS"];
const DESTINACOES  = ["CIRCULAÇÃO","RECICLAGEM"];
const STATUS_DI    = ["AGUARDANDO","EM DILIGÊNCIA","ATRASADO","PRAZO 6 MESES","BAIXADO","EM DILIGÊNCIA HIGEIA","LPC","CATÁLOGO","RENAJUD"];
const DEPOSITOS    = ["SELAB/PCDF","CPA/PCDF","CPA","CEGOC","5ªDP","23ªDP","30ªDP","33ªDP"];
const ACOES_SEI    = ["DILIGÊNCIA","ARQUIVAR","ENCAMINHAR","AGUARDAR RETORNO","CONCLUIR"];
const STATUS_LOCAL = ["EM ANÁLISE","AGUARDANDO ENTIDADE","CONCLUÍDO","CANCELADO"];
// Edital de Chamamento nº 2/2024 — lista extraída em 24/06/2026 do site TJDFT
// https://www.tjdft.jus.br/.../lista-de-entidades-credenciadas-edital-de-chamamento-no-2-2024
const ENTIDADES = [
  "1. Associação Casa de Proteção Magnólia - CPM",
  "2. Projeto Integral de Vida - Pró-Vida",
  "3. ASCOM - Associação Comunitária de São Sebastião - DF",
  "4. Associação Capoeiristas do Rei",
  "5. Instituto de Desenvolvimento da Educação e Implementação de Ações Sociais - IDEIAS Ser Escola",
  "6. Associação de Pais e Amigos dos Excepcionais do DF - APAE/DF",
  "7. Associação Brasília Inclusiva e Direitos Sociais - ABIDS",
  "8. Associação Beneficente Luz do Dia - ABLD",
  "9. Associação Evangelística Palavra de Bênção",
  "10. Instituto Jovens Promessas",
  "11. Instituto Horizontes de Responsabilidade Social - IHRS",
  "12. Creche Criança Cidadã de Planaltina",
  "13. Movimento Popular do Arapoanga pela Cidadania - MPA",
  "14. Centro Esportivo Cultural de Planaltina - DF",
  "15. Instituto de Integração e Formação do Ser Social",
  "16. Movimento de Assistência aos Carentes da Metropolitana",
  "17. Grupo Força para Vencer",
  "18. Associação Evangélica Missão Resgate",
  "19. Academia Gamense de Letras - AGL",
  "20. Organização Viva Vida - OVV",
  "21. Instituto Abba Pai",
  "22. Organização Assistencial Amor sem Fronteira",
  "23. Organização Social Ambiental da Fauna e Flora do Brasil",
  "24. Associação de Moradores dos Bairros Santa Luiza e Cidade Nova",
  "25. Comunidade Terapêutica Elshadai",
  "26. Associação de Moradores Aguaslindense - AMAG",
  "27. Centro de Assistência Social e Espiritual",
  "28. Instituto Esporte e Vida",
  "29. Instituto Epuranios",
  "30. Centro de Integração à Cultura, Esporte e Habitação de Planaltina",
  "31. Aconchego - Grupo de Apoio à Convivência Familiar e Comunitária",
  "32. Obras Sociais do Centro Espírita Fraternidade Jerônimo Candinho",
  "33. Instituto Arkrealiza",
  "34. Instituto Lar dos Velhinhos Maria Madalena",
  "35. Comunidade Cristã Amada",
  "36. Instituto Abraço Solidário",
  "37. Instituto Magia dos Sonhos",
  "38. VESP - Vila Esperança",
  "39. Associação dos Idosos da Ceilândia",
  "40. Associação das Artes dos Manualistas e dos Artesãos - ASSOCIAAMA",
  "41. Casa de Ismael - Lar da Criança",
  "42. Associação Comunitária Missão Shekinah - AMAS",
  "43. Associação Lar Infantil Chico Xavier",
  "44. Lar de São José",
  "45. Instituto Nossa Missão",
  "46. Associação Benéfica Cristã Promotora do Desenvolvimento Integral - ABC PRODEIN",
  "47. Obra das Filhas do Amor de Jesus Cristo (Casa do Menino Jesus)",
  "48. Obras Sociais do Centro Espírita Batuíra",
  "49. Instituto Carisma",
];
const MOTIVOS_SAIDA= ["DETERIORADO","BAIXA","DOAÇÃO","ARREMATAÇÃO LPC","OUTROS"];

// Campos por lista
const CAMPOS = {
  CEGOC: [
    { id:"ID_PASEI",          label:"ID_PASEI *",          type:"text",     required:true,  placeholder:"Ex: 0038491-22.2024.8.07.0001" },
    { id:"TIPO_BEM",          label:"Tipo de Bem *",       type:"select",   required:true,  options:TIPOS_BEM },
    { id:"NIV",               label:"NIV / Chassi",        type:"text",     placeholder:"17 caracteres",maxLength:18 },
    { id:"STATUS_DILIGENCIA", label:"Status *",            type:"select",   required:true,  options:STATUS_DI },
    { id:"DESTINACAO",        label:"Destinação *",        type:"select",   required:true,  options:DESTINACOES },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"FIB",               label:"FIB Expedida",        type:"toggle" },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Registros de movimentação e ações..." },
  ],
  DPJ_GC99: [
    { id:"LOTE",              label:"Lote *",              type:"number",   required:true,  placeholder:"Ex: 49" },
    { id:"PA_PJE",            label:"PA PJE *",            type:"text",     required:true,  placeholder:"Ex: 0002341-88.2021" },
    { id:"TIPO_BEM",          label:"Tipo de Bem *",       type:"select",   required:true,  options:TIPOS_BEM },
    { id:"NIV",               label:"NIV / Chassi",        type:"text",     placeholder:"17 caracteres",maxLength:18 },
    { id:"DATA_ENTRADA",      label:"Data de Entrada *",   type:"date",     required:true },
    { id:"PRAZO_6MESES",      label:"Prazo 6 Meses",       type:"date",     readonly:true,  hint:"Calculado automaticamente (+180 dias)" },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"MOTIVO_SAIDA",      label:"Motivo de Saída",     type:"select",   options:["", ...MOTIVOS_SAIDA] },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Registros de movimentação..." },
  ],
  PCDF_1HIGEIA: [
    { id:"ID_PASEI",          label:"ID_PASEI *",          type:"text",     required:true,  placeholder:"Ex: 0054812-11.2022.8.07.0003" },
    { id:"TIPO_BEM",          label:"Tipo de Bem *",       type:"select",   required:true,  options:TIPOS_BEM },
    { id:"NIV",               label:"NIV / Chassi",        type:"text",     placeholder:"17 caracteres",maxLength:18 },
    { id:"DEPOSITO",          label:"Depósito *",          type:"select",   required:true,  options:DEPOSITOS },
    { id:"STATUS_DILIGENCIA", label:"Status *",            type:"select",   required:true,  options:STATUS_DI },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"FIB",               label:"FIB Expedida",        type:"toggle" },
    { id:"CEB_TEP_TIV",       label:"CEB/TEP/TIV Emitido", type:"toggle" },
    { id:"OFICIO_BAIXA",      label:"Ofício de Baixa",     type:"toggle" },
    { id:"INUTILIZADO",       label:"Inutilizado",         type:"toggle" },
    { id:"PESO_KG",           label:"Peso (kg)",           type:"number",   placeholder:"Ex: 1250" },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Registros de movimentação..." },
  ],
  PCDF_2HIGEIA: [
    { id:"ID_PASEI",          label:"ID_PASEI *",          type:"text",     required:true,  placeholder:"Ex: 0071009-44.2024.8.07.0007" },
    { id:"TIPO_BEM",          label:"Tipo de Bem *",       type:"select",   required:true,  options:TIPOS_BEM },
    { id:"NIV",               label:"NIV / Chassi",        type:"text",     placeholder:"17 caracteres",maxLength:18 },
    { id:"DEPOSITO",          label:"Depósito *",          type:"select",   required:true,  options:DEPOSITOS },
    { id:"STATUS_DILIGENCIA", label:"Status *",            type:"select",   required:true,  options:STATUS_DI },
    { id:"PA_TJDFT",          label:"PA TJDFT",            type:"text",     placeholder:"N/C se não houver" },
    { id:"ORIGEM_CEGOC_ID",   label:"Origem CEGOC ID",     type:"text",     placeholder:"Ex: CEGOC-0142" },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"FIB",               label:"FIB Expedida",        type:"toggle" },
    { id:"CEB_TEP_TIV",       label:"CEB/TEP/TIV Emitido", type:"toggle" },
    { id:"OFICIO_BAIXA",      label:"Ofício de Baixa",     type:"toggle" },
    { id:"INUTILIZADO",       label:"Inutilizado",         type:"toggle" },
    { id:"RESTRICAO_ROUBO",   label:"Restrição Roubo/Furto", type:"toggle" },
    { id:"PESO_KG",           label:"Peso (kg)",           type:"number",   placeholder:"Ex: 8500" },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Registros de movimentação..." },
  ],
  DOACOES: [
    { id:"ENTIDADE_NOME",     label:"Entidade Credenciada *", type:"select", required:true, options:ENTIDADES },
    { id:"ID_PASEI",          label:"ID_PASEI *",          type:"text",     required:true,  placeholder:"Ex: 0038491-22.2024.8.07.0001" },
    { id:"TIPO_BEM",          label:"Tipo de Bem *",       type:"select",   required:true,  options:TIPOS_BEM },
    { id:"NIV",               label:"NIV / Chassi",        type:"text",     placeholder:"17 caracteres",maxLength:18 },
    { id:"STATUS_LOCAL_PA",   label:"Status Local PA",     type:"select",   options:STATUS_LOCAL },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Detalhes da doação..." },
  ],
  CAIXA_SEI: [
    { id:"ID_PASEI",          label:"ID_PASEI *",          type:"text",     required:true,  placeholder:"Ex: 0038491-22.2024.8.07.0001" },
    { id:"TIPO_BEM",          label:"Tipo de Bem",         type:"select",   options:TIPOS_BEM },
    { id:"ACAO",              label:"Ação *",              type:"select",   required:true,  options:ACOES_SEI },
    { id:"Responsavel",       label:"Responsável *",       type:"select",   required:true,  options:SERVIDORES },
    { id:"OBSERVACOES",       label:"Observações",         type:"textarea", placeholder:"Descrição da triagem..." },
  ],
};

// ─── FORM FIELD ───────────────────────────────────────────────────────────────
function FormField({ campo, value, onChange, accentColor }) {
  const inputBase = {
    width:"100%", padding:"9px 12px",
    background:"rgba(255,255,255,0.05)",
    border:`1px solid ${campo.required && !value ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}`,
    borderRadius:8, color:"#fff", fontSize:13,
    outline:"none", transition:"border 0.15s", boxSizing:"border-box",
  };

  const focusStyle = { border:`1px solid ${accentColor}66` };

  if (campo.type === "toggle") {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8 }}>
        <span style={{ fontSize:13, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>{campo.label}</span>
        <button onClick={() => onChange(!value)} style={{
          width:44, height:24, borderRadius:12, border:"none", cursor:"pointer",
          background: value ? "#22c55e" : "rgba(255,255,255,0.1)",
          position:"relative", transition:"background 0.2s", flexShrink:0,
        }}>
          <span style={{ position:"absolute", top:3, left: value ? 23 : 3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
        </button>
      </div>
    );
  }

  if (campo.type === "textarea") {
    return (
      <div>
        <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{campo.label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={campo.placeholder}
          onFocus={e => e.target.style.border = `1px solid ${accentColor}66`}
          onBlur={e => e.target.style.border = "1px solid rgba(255,255,255,0.1)"}
          style={{ ...inputBase, minHeight:90, resize:"vertical", lineHeight:1.6 }}/>
        {campo.hint && <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:4, fontStyle:"italic" }}>{campo.hint}</div>}
      </div>
    );
  }

  if (campo.type === "select") {
    return (
      <div>
        <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>
          {campo.label}
        </label>
        <select value={value} onChange={e => onChange(e.target.value)}
          onFocus={e => e.target.style.border = `1px solid ${accentColor}66`}
          onBlur={e => e.target.style.border = `1px solid ${campo.required && !value ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}`}
          style={{ ...inputBase, cursor:"pointer" }}>
          <option value="" style={{ background:"#0a1628" }}>— Selecione —</option>
          {campo.options.map(o => <option key={o} value={o} style={{ background:"#0a1628" }}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>
        {campo.label}
      </label>
      <input
        type={campo.type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={campo.placeholder}
        readOnly={campo.readonly}
        maxLength={campo.maxLength}
        onFocus={e => { if(!campo.readonly) e.target.style.border = `1px solid ${accentColor}66`; }}
        onBlur={e => e.target.style.border = `1px solid ${campo.required && !value ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}`}
        style={{ ...inputBase, cursor: campo.readonly ? "default" : "text", opacity: campo.readonly ? 0.5 : 1 }}
      />
      {campo.hint && <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:4, fontStyle:"italic" }}>{campo.hint}</div>}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CadastroPage() {
  const [listaKey, setListaKey] = useState(null);
  const [formData, setFormData] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [erros, setErros] = useState([]);

  const lista = LISTAS_CONFIG.find(l => l.key === listaKey);
  const campos = listaKey ? CAMPOS[listaKey] || [] : [];
  const [proximaEntidade, setProximaEntidade] = useState(null);
  const [carregandoEntidade, setCarregandoEntidade] = useState(false);

  // ── Detecção de duplicata ──────────────────────────────────────────────────
  const [duplicata, setDuplicata] = useState(null);   // { campo, valor, encontrados: [{lista, item}] }
  const [buscandoDup, setBuscandoDup] = useState(false);
  const debounceRef = useRef(null);

  const buscarDuplicata = (campo, valor) => {
    clearTimeout(debounceRef.current);
    setDuplicata(null);
    const v = (valor || "").trim().toUpperCase();
    if (v.length < 6) return; // mínimo de caracteres para buscar

    debounceRef.current = setTimeout(async () => {
      setBuscandoDup(true);
      const encontrados = [];
      await Promise.allSettled(
        TODAS_LISTAS_ROTA.map(async ({ rota, label, color }) => {
          try {
            const res = await fetch(`/api/bens/${rota}`);
            const json = await res.json();
            const itens = json.dados || [];
            itens.forEach(item => {
              const niv    = (item.NIV      || "").toUpperCase();
              const pasei  = (item.ID_PASEI || item.PA_PJE || "").toUpperCase().replace(/\s/g,"");
              const alvo   = v.replace(/\s/g,"");
              if ((campo === "NIV"      && niv   && niv   === alvo) ||
                  (campo === "ID_PASEI" && pasei && pasei === alvo)) {
                encontrados.push({ lista: label, color, item });
              }
            });
          } catch { /* ignora erros de rede */ }
        })
      );
      setBuscandoDup(false);
      if (encontrados.length > 0) setDuplicata({ campo, valor: v, encontrados });
    }, 600);
  };

  // Quando DOACOES for selecionada, calcula a próxima entidade na fila efetiva.
  //
  // Lógica: para cada uma das 49 entidades, busca o ÚLTIMO EVENTO (doação realizada
  // ou recusa registrada em Anotações). A entidade cujo último evento é mais antigo
  // (ou que nunca teve evento) é a próxima na fila. Entidades que recusaram vão
  // automaticamente para o fim, pois o timestamp da recusa fica mais recente.
  useEffect(() => {
    if (listaKey !== "DOACOES") { setProximaEntidade(null); return; }
    setCarregandoEntidade(true);

    Promise.allSettled([
      fetch("/api/bens/doacoes_diligencia").then(r => r.json()),
      fetch("/api/anotacoes").then(r => r.json()),
    ]).then(([resDoac, resAnot]) => {
      // Mapeia entidade → timestamp do último evento (ms)
      const ultimoEvento = {};

      // Doações realizadas (aba usa ENTIDADE_NOME)
      const doacoes = resDoac.status === "fulfilled" ? (resDoac.value.dados || []) : [];
      doacoes.forEach(r => {
        const ent = (r.ENTIDADE_NOME || r.ENTIDADE || "").trim();
        if (!ent) return;
        const t = r.DATA_CADASTRO ? new Date(r.DATA_CADASTRO).getTime() : (r._rowNumber || 0);
        if (!ultimoEvento[ent] || t > ultimoEvento[ent]) ultimoEvento[ent] = t;
      });

      // Anotações de recusa (aba usa ENTIDADE)
      const anotacoes = resAnot.status === "fulfilled" ? (resAnot.value.dados || []) : [];
      anotacoes.forEach(r => {
        const ent = (r.ENTIDADE || "").trim();
        if (!ent) return;
        const t = r.DATA ? new Date(r.DATA).getTime() : (r._rowNumber || 0);
        if (!ultimoEvento[ent] || t > ultimoEvento[ent]) ultimoEvento[ent] = t;
      });

      // Ordena as 49 entidades pelo último evento crescente
      // (sem evento = 0, fica primeiro; com evento mais antigo vem antes)
      const ordenadas = [...ENTIDADES].sort((a, b) => {
        const ta = ultimoEvento[a] || 0;
        const tb = ultimoEvento[b] || 0;
        if (ta !== tb) return ta - tb;
        // Desempate: posição original na lista
        return ENTIDADES.indexOf(a) - ENTIDADES.indexOf(b);
      });

      const proxima = ordenadas[0];
      setProximaEntidade(proxima);
      setFormData(prev => ({ ...prev, ENTIDADE_NOME: proxima }));
    }).finally(() => setCarregandoEntidade(false));
  }, [listaKey]);

  // Calcula prazo 6 meses automaticamente para DPJ
  const handleChange = (id, val) => {
    const next = { ...formData, [id]: val };
    if (id === "DATA_ENTRADA" && listaKey === "DPJ_GC99" && val) {
      const d = new Date(val);
      d.setDate(d.getDate() + 180);
      next.PRAZO_6MESES = d.toISOString().split("T")[0];
    }
    setFormData(next);
    setErros(erros.filter(e => e !== id));
    // Dispara verificação de duplicata nos campos críticos
    if (id === "NIV" || id === "ID_PASEI" || id === "PA_PJE") {
      const campo = id === "PA_PJE" ? "ID_PASEI" : id;
      buscarDuplicata(campo, val);
    }
  };

  const handleSalvar = async () => {
    // Validação dos campos obrigatórios
    const novosErros = campos.filter(c => c.required && !formData[c.id]).map(c => c.id);
    if (novosErros.length > 0) { setErros(novosErros); return; }

    setSalvando(true);
    setErroSalvar(null);

    try {
      const rota = LISTA_API_MAP[listaKey];

      // Normaliza toggles: envia "TRUE"/"FALSE" (compatível com Google Sheets)
      const payload = {};
      campos.forEach(c => {
        if (c.type === "toggle") {
          payload[c.id] = formData[c.id] ? "TRUE" : "FALSE";
        } else if (formData[c.id] !== undefined && formData[c.id] !== "") {
          payload[c.id] = formData[c.id];
        }
      });

      const res = await fetch(`/api/bens/${rota}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao salvar");

      setSucesso(true);
      setTimeout(() => { setSucesso(false); setFormData({}); setListaKey(null); }, 3000);
    } catch (e) {
      setErroSalvar(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleLimpar = () => { setFormData({}); setErros([]); };

  // Separa toggles dos outros campos
  const camposNormais = campos.filter(c => c.type !== "toggle");
  const camposToggle  = campos.filter(c => c.type === "toggle");

  // Conta campos preenchidos
  const preenchidos = campos.filter(c => c.type !== "toggle" && formData[c.id]).length;
  const totalNormais = camposNormais.length;
  const progresso = totalNormais > 0 ? Math.round((preenchidos / totalNormais) * 100) : 0;

  return (
    <div className="signu-layout" style={{ background:"#060f1e", fontFamily:"'Inter',system-ui,sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.2);border-radius:4px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <Sidebar />

      {/* MAIN */}
      <main className="signu-main">

        {/* Top bar */}
        <header style={{ height:56,borderBottom:"1px solid rgba(201,168,76,0.1)",background:"#0a1628",display:"flex",alignItems:"center",padding:"0 28px",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>SIGNU</span>
            <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
            <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Cadastro</span>
            {lista && <>
              <span style={{ color:"rgba(255,255,255,0.15)" }}>/</span>
              <span style={{ fontSize:12,fontWeight:700,color:lista.color,background:lista.bg,padding:"2px 10px",borderRadius:4 }}>{lista.label}</span>
            </>}
          </div>
          {listaKey && (
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:11,color:"rgba(255,255,255,0.3)" }}>{preenchidos}/{totalNormais} campos</span>
              <div style={{ width:80,height:4,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden" }}>
                <div style={{ width:`${progresso}%`,height:"100%",background:lista?.color||"#c9a84c",borderRadius:4,transition:"width 0.3s" }}/>
              </div>
            </div>
          )}
        </header>

        <div className="signu-content" style={{ padding:"28px" }}>

          {/* ── SELEÇÃO DE LISTA ── */}
          {!listaKey ? (
            <div style={{ animation:"fadeIn 0.3s ease" }}>
              <h1 style={{ fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.02em" }}>Novo Cadastro</h1>
              <p style={{ fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 28px" }}>Selecione a lista de destino para o bem.</p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,maxWidth:800 }}>
                {LISTAS_CONFIG.map(l => (
                  <button key={l.key} onClick={() => { setListaKey(l.key); setFormData({}); setErros([]); setDuplicata(null); }}
                    style={{
                      background:`linear-gradient(145deg,${l.bg},rgba(6,15,30,0.9))`,
                      border:`1px solid ${l.color}30`,
                      borderRadius:14,padding:"20px 18px",cursor:"pointer",
                      textAlign:"left",transition:"all 0.18s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=`${l.color}70`; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 8px 24px rgba(0,0,0,0.4)`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=`${l.color}30`; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
                  >
                    <div style={{ fontSize:28,marginBottom:10 }}>{l.icon}</div>
                    <div style={{ fontSize:14,fontWeight:700,color:l.color,marginBottom:5 }}>{l.label}</div>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.5 }}>{l.desc}</div>
                    <div style={{ marginTop:12,fontSize:10,color:"rgba(255,255,255,0.25)" }}>
                      {(CAMPOS[l.key]||[]).filter(c=>c.required).length} campos obrigatórios
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── FORMULÁRIO ── */
            <div style={{ maxWidth:860, animation:"fadeIn 0.3s ease" }}>
              {/* Header do form */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <button onClick={() => setListaKey(null)} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>←</button>
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ fontSize:22 }}>{lista.icon}</span>
                      <h1 style={{ fontSize:18,fontWeight:700,color:"#fff",margin:0 }}>Novo bem em {lista.label}</h1>
                    </div>
                    <p style={{ fontSize:12,color:"rgba(255,255,255,0.35)",margin:"3px 0 0" }}>{lista.desc}</p>
                  </div>
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 280px",gap:20 }}>

                {/* Coluna principal — campos normais */}
                <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

                  {/* Banner: próxima entidade na fila (somente Doações) */}
                  {listaKey === "DOACOES" && (
                    <div style={{ background:"linear-gradient(135deg,rgba(52,211,153,0.1),rgba(52,211,153,0.04))",border:"1px solid rgba(52,211,153,0.25)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12 }}>
                      <span style={{ fontSize:22,flexShrink:0 }}>🔢</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:"rgba(52,211,153,0.8)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3 }}>
                          Próxima entidade na ordem
                        </div>
                        {carregandoEntidade ? (
                          <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",fontStyle:"italic" }}>Calculando…</div>
                        ) : proximaEntidade ? (
                          <div style={{ fontSize:13,fontWeight:600,color:"#fff" }}>{proximaEntidade}</div>
                        ) : (
                          <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",fontStyle:"italic" }}>Iniciando pela entidade nº 1</div>
                        )}
                      </div>
                      <div style={{ fontSize:10,color:"rgba(52,211,153,0.5)",textAlign:"right",flexShrink:0 }}>
                        Edital nº 2/2024<br/>49 entidades
                      </div>
                    </div>
                  )}

                  {/* Grid de campos 2 colunas */}
                  <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"20px" }}>
                    <div style={{ fontSize:11,fontWeight:700,color:`${lista.color}99`,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:18 }}>
                      Dados do Bem
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                      {camposNormais.map(campo => (
                        <div key={campo.id} style={{ gridColumn: campo.type==="textarea" ? "1 / -1" : "auto" }}>
                          <FormField
                            campo={campo}
                            value={formData[campo.id] || ""}
                            onChange={v => handleChange(campo.id, v)}
                            accentColor={lista.color}
                          />
                          {erros.includes(campo.id) && (
                            <div style={{ fontSize:10,color:"#f87171",marginTop:4 }}>⚠ Campo obrigatório</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Alerta de duplicata ── */}
                  {(buscandoDup || duplicata) && (
                    <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${duplicata ? "rgba(248,113,113,0.4)" : "rgba(201,168,76,0.2)"}` }}>
                      {buscandoDup && !duplicata && (
                        <div style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", fontSize:12, color:"rgba(255,255,255,0.4)", display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span>
                          Verificando duplicidade...
                        </div>
                      )}
                      {duplicata && (
                        <div>
                          <div style={{ padding:"10px 14px", background:"rgba(248,113,113,0.1)", display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:16 }}>⚠️</span>
                            <span style={{ fontSize:12, fontWeight:700, color:"#f87171" }}>
                              {duplicata.campo === "NIV" ? "NIV" : "Processo"} já cadastrado em {duplicata.encontrados.length} lista(s)
                            </span>
                          </div>
                          <div style={{ padding:"8px 14px 12px", background:"rgba(248,113,113,0.05)" }}>
                            {duplicata.encontrados.map((enc, i) => (
                              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8, borderLeft:`3px solid ${enc.color}`, marginTop:6 }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:11, fontWeight:700, color:enc.color, marginBottom:2 }}>{enc.lista}</div>
                                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>
                                    {enc.item.ID_PASEI || enc.item.PA_PJE || "—"}
                                    {enc.item.TIPO_BEM ? ` · ${enc.item.TIPO_BEM}` : ""}
                                    {enc.item.STATUS_DILIGENCIA ? ` · ${enc.item.STATUS_DILIGENCIA}` : ""}
                                  </div>
                                  {enc.item.RESPONSAVEL && (
                                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
                                      Responsável: {enc.item.RESPONSAVEL}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div style={{ fontSize:11, color:"rgba(248,113,113,0.7)", marginTop:10, fontStyle:"italic" }}>
                              Verifique se é realmente um novo item antes de salvar.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toggles (se houver) */}
                  {camposToggle.length > 0 && (
                    <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"20px" }}>
                      <div style={{ fontSize:11,fontWeight:700,color:`${lista.color}99`,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16 }}>
                        Flags e Indicadores
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                        {camposToggle.map(campo => (
                          <FormField key={campo.id} campo={campo} value={!!formData[campo.id]} onChange={v => handleChange(campo.id, v)} accentColor={lista.color}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna lateral — resumo + ação */}
                <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

                  {/* Resumo do preenchimento */}
                  <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:`1px solid ${lista.color}22`,borderRadius:12,padding:"18px" }}>
                    <div style={{ fontSize:11,fontWeight:700,color:`${lista.color}99`,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14 }}>Resumo</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {camposNormais.filter(c => formData[c.id]).map(c => (
                        <div key={c.id} style={{ display:"flex",justifyContent:"space-between",gap:8 }}>
                          <span style={{ fontSize:10,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.06em",flexShrink:0 }}>{c.id}</span>
                          <span style={{ fontSize:11,color:"rgba(255,255,255,0.7)",textAlign:"right",fontFamily:c.type==="text"?"'IBM Plex Mono',monospace":"inherit",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140 }}>{formData[c.id]}</span>
                        </div>
                      ))}
                      {camposNormais.filter(c => formData[c.id]).length === 0 && (
                        <div style={{ fontSize:12,color:"rgba(255,255,255,0.2)",fontStyle:"italic",textAlign:"center",padding:"16px 0" }}>Preencha os campos ao lado</div>
                      )}
                    </div>
                    {/* Barra de progresso */}
                    {totalNormais > 0 && (
                      <div style={{ marginTop:16,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                          <span style={{ fontSize:10,color:"rgba(255,255,255,0.3)" }}>Progresso</span>
                          <span style={{ fontSize:10,fontWeight:700,color:lista.color }}>{progresso}%</span>
                        </div>
                        <div style={{ height:6,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden" }}>
                          <div style={{ width:`${progresso}%`,height:"100%",background:`linear-gradient(90deg,${lista.color}88,${lista.color})`,borderRadius:4,transition:"width 0.4s ease" }}/>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rota API */}
                  <div style={{ background:"linear-gradient(145deg,#0f2040,#0a1628)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10 }}>Destino</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:11,lineHeight:1.8,color:"rgba(255,255,255,0.3)" }}>
                      <div><span style={{ color:"#a78bfa" }}>POST</span> /api/bens/<span style={{ color:lista?.color }}>{LISTA_API_MAP[listaKey]}</span></div>
                      <div style={{ fontSize:10,marginTop:4,color:"rgba(255,255,255,0.2)" }}>→ Google Sheets: SIGNU_DB</div>
                    </div>
                  </div>

                  {/* Erro ao salvar */}
                  {erroSalvar && (
                    <div style={{ background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#f87171" }}>
                      <div style={{ fontWeight:700,marginBottom:3 }}>⚠️ Erro ao salvar</div>
                      <div style={{ opacity:0.8,fontSize:11 }}>{erroSalvar}</div>
                    </div>
                  )}

                  {/* Botões */}
                  <button onClick={handleSalvar} disabled={salvando}
                    style={{
                      width:"100%",padding:"13px",borderRadius:10,border:"none",
                      background: salvando ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,${lista.color}cc,${lista.color})`,
                      color:"#fff",fontSize:14,fontWeight:700,cursor:salvando?"not-allowed":"pointer",
                      transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    }}>
                    {salvando ? (
                      <><span style={{ display:"inline-block",animation:"spin 0.8s linear infinite" }}>⟳</span> Salvando...</>
                    ) : "💾 Salvar Cadastro"}
                  </button>

                  <button onClick={handleLimpar} style={{ width:"100%",padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:13,cursor:"pointer" }}>
                    🗑 Limpar Formulário
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* TOAST DE SUCESSO */}
      {sucesso && (
        <div style={{
          position:"fixed",bottom:28,right:28,zIndex:200,
          display:"flex",alignItems:"center",gap:10,
          padding:"14px 22px",borderRadius:14,
          background:"linear-gradient(135deg,#15803d,#166534)",
          border:"1px solid rgba(34,197,94,0.4)",
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
          fontSize:14,fontWeight:700,color:"#fff",
          animation:"fadeIn 0.3s ease",
        }}>
          ✅ Bem cadastrado em {lista?.label} com sucesso!
        </div>
      )}
    </div>
  );
}