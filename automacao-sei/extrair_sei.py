#!/usr/bin/env python3
"""
Protótipo — extração SEI -> revisão para cadastro no SIGNU.

O QUE FAZ
  1. Conecta no Chrome que VOCÊ já abriu e logou no SEI (via CDP).
  2. Varre as abas abertas e identifica as que são um processo do SEI.
  3. Em cada processo: lê o texto da árvore de documentos e do documento aberto
     (opcionalmente percorre a árvore clicando em cada nó).
  4. Manda o texto para o Claude com um schema de campos do SIGNU e recebe um
     registro estruturado + nível de confiança + alertas.
  5. Grava saida/revisao_<timestamp>.json  e  .csv  para conferência humana.

O QUE NÃO FAZ (de propósito)
  - Não grava nada no SIGNU. Não clica em "salvar" em lugar nenhum.
  - Não faz login, não guarda senha: você loga no navegador.

COMO RODAR   (ver README.md para o passo a passo completo)
  1. Abrir o Chrome com porta de depuração e logar no SEI:
       "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         --remote-debugging-port=9222 \
         --user-data-dir="$HOME/chrome-sei-debug"
  2. Abrir cada processo que interessa numa aba.
  3. export ANTHROPIC_API_KEY=sk-ant-...
  4. python extrair_sei.py --lista pcdf2
"""

import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Campos que a IA deve extrair, por lista. Espelham app/cadastro/page.jsx (CAMPOS),
# só a parte que dá para inferir do conteúdo do processo. Responsável fica de fora
# (distribuição é decidida no cadastro); datas/flags calculadas também.
# ─────────────────────────────────────────────────────────────────────────────
TIPOS_BEM   = ["CARRO", "MOTO", "CAMINHÃO", "CAMINHONETE", "REBOQUE", "OUTROS"]
DESTINACOES = ["CIRCULAÇÃO", "RECICLAGEM"]
STATUS_DI   = ["AGUARDANDO", "EM DILIGÊNCIA", "ATRASADO", "PRAZO 6 MESES", "BAIXADO",
               "EM DILIGÊNCIA HIGEIA", "LPC", "CATÁLOGO", "RENAJUD"]
DEPOSITOS   = ["SELAB/PCDF", "CPA/PCDF", "CPA", "CEGOC", "5ªDP", "23ªDP", "30ªDP", "33ªDP"]
ACOES_SEI   = ["DILIGÊNCIA", "ARQUIVAR", "ENCAMINHAR", "AGUARDAR RETORNO", "CONCLUIR"]
MOTIVOS     = ["DETERIORADO", "BAIXA", "DOAÇÃO", "ARREMATAÇÃO LPC", "OUTROS"]

CAMPO = lambda desc, enum=None: {"descricao": desc, "enum": enum}

SCHEMAS = {
    "cegoc": {
        "ID_PASEI":          CAMPO("Número do processo SEI/PA (formato 00000-00000000/0000-00)"),
        "TIPO_BEM":          CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":               CAMPO("NIV/chassi (17 caracteres). 'N/A' se não aflorado/ilegível"),
        "PLACA":             CAMPO("Placa ostentada, só letras e números, sem traço"),
        "STATUS_DILIGENCIA": CAMPO("Situação atual da diligência", STATUS_DI),
        "DESTINACAO":        CAMPO("Destino do bem", DESTINACOES),
        "OBSERVACOES":       CAMPO("Resumo em 1-2 frases do que o processo determina sobre o bem"),
    },
    "pcdf1": {
        "ID_PASEI":          CAMPO("Número do processo SEI/PA"),
        "TIPO_BEM":          CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":               CAMPO("NIV/chassi. 'N/A' se não aflorado"),
        "PLACA":             CAMPO("Placa, só letras e números"),
        "DEPOSITO":          CAMPO("Depósito onde o bem está", DEPOSITOS),
        "STATUS_DILIGENCIA": CAMPO("Situação da diligência", STATUS_DI),
        "OBSERVACOES":       CAMPO("Resumo em 1-2 frases"),
    },
    "pcdf2": {
        "ID_PASEI":          CAMPO("Número do processo SEI/PA"),
        "TIPO_BEM":          CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":               CAMPO("NIV/chassi. 'N/A' se não aflorado"),
        "PLACA":             CAMPO("Placa, só letras e números"),
        "DEPOSITO":          CAMPO("Depósito onde o bem está", DEPOSITOS),
        "STATUS_DILIGENCIA": CAMPO("Situação da diligência", STATUS_DI),
        "PA_TJDFT":          CAMPO("Nº do PA administrativo do TJDFT, se citado; senão 'N/C'"),
        "OBSERVACOES":       CAMPO("Resumo em 1-2 frases"),
    },
    "dpj": {
        "PA_PJE":       CAMPO("Número do processo PJe"),
        "LOTE":         CAMPO("Número do lote, se citado"),
        "TIPO_BEM":     CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":          CAMPO("NIV/chassi"),
        "PLACA":        CAMPO("Placa, só letras e números"),
        "DATA_ENTRADA": CAMPO("Data de entrada do bem (AAAA-MM-DD), se citada"),
        "MOTIVO_SAIDA": CAMPO("Motivo de saída, se já definido", ["", *MOTIVOS]),
        "OBSERVACOES":  CAMPO("Resumo em 1-2 frases"),
    },
    "doacoes_diligencia": {
        "DATA_DECISAO": CAMPO("Data da decisão que autorizou a doação (AAAA-MM-DD)"),
        "ENTIDADE_NOME": CAMPO("Nome da entidade credenciada beneficiada, se citada"),
        "ID_PASEI":     CAMPO("Número do processo SEI/PA"),
        "TIPO_BEM":     CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":          CAMPO("NIV/chassi"),
        "PLACA":        CAMPO("Placa, só letras e números"),
        "OBSERVACOES":  CAMPO("Resumo em 1-2 frases"),
    },
    "sei": {
        "ID_PASEI":    CAMPO("Número do processo SEI/PA"),
        "TIPO_BEM":    CAMPO("Tipo do bem, se identificável", TIPOS_BEM),
        "ACAO":        CAMPO("Ação de triagem sugerida pelo conteúdo", ACOES_SEI),
        "OBSERVACOES": CAMPO("Resumo em 1-2 frases do que o PA pede"),
    },
}
# aliases amigáveis
SCHEMAS["pcdf_1higeia"] = SCHEMAS["pcdf1"]
SCHEMAS["pcdf_2higeia"] = SCHEMAS["pcdf2"]
SCHEMAS["doacoes"] = SCHEMAS["doacoes_diligencia"]

# Padrões de número de processo (para achar o ID mesmo se a IA escorregar)
RE_PA_SEI = re.compile(r"\b\d{4,6}[-.]\d{6,8}/\d{4}-\d{2}\b")
RE_CNJ    = re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")


def carregar_config(caminho):
    p = Path(caminho)
    if not p.exists():
        alt = p.with_name("config.example.json")
        if alt.exists():
            print(f"[i] {p.name} não existe; usando {alt.name}. "
                  f"Copie para config.json e ajuste se precisar.")
            p = alt
        else:
            sys.exit(f"[x] config não encontrada: {caminho}")
    return json.loads(p.read_text(encoding="utf-8"))


# ─────────────────────────────────────────────────────────────────────────────
# SEI / navegador
# ─────────────────────────────────────────────────────────────────────────────
def eh_aba_sei(url, url_contains):
    u = (url or "").lower()
    return any(frag.lower() in u for frag in url_contains)


def texto_frame(frame, limite=20000):
    try:
        t = frame.evaluate("() => document.body ? document.body.innerText : ''")
        return (t or "").strip()[:limite]
    except Exception:
        return ""


def achar_frame(page, nome):
    for f in page.frames:
        if f.name == nome:
            return f
    # fallback: por url
    for f in page.frames:
        if nome.lower() in (f.url or "").lower():
            return f
    return None


def extrair_processo(page, cfg_sei, debug=False):
    """Retorna dict {numero, titulo_aba, url, texto, docs_lidos}."""
    page.bring_to_front()
    try:
        page.wait_for_load_state("domcontentloaded", timeout=8000)
    except Exception:
        pass

    titulo = ""
    try:
        titulo = page.title()
    except Exception:
        pass

    fr_arvore = achar_frame(page, cfg_sei["frame_arvore"])
    fr_visu   = achar_frame(page, cfg_sei["frame_visualizacao"])

    partes = []
    if fr_arvore:
        partes.append("### ÁRVORE DE DOCUMENTOS\n" + texto_frame(fr_arvore, 8000))
    else:
        partes.append("### PÁGINA\n" + texto_frame(page.main_frame, 8000))

    docs_lidos = 0
    if fr_visu:
        partes.append("### DOCUMENTO ABERTO\n" + texto_frame(fr_visu))
        # frames aninhados dentro do visualizador (SEI às vezes usa +1 nível)
        for f in page.frames:
            if f in (fr_arvore, fr_visu, page.main_frame):
                continue
            sub = texto_frame(f, 6000)
            if len(sub) > 200:
                partes.append("### (frame aninhado)\n" + sub)
        docs_lidos = 1

    # opcional: percorrer a árvore clicando em cada nó
    if cfg_sei.get("percorrer_arvore") and fr_arvore:
        try:
            nodes = fr_arvore.locator("a[href*='documento_visualizar'], a[onclick*='documento']")
            n = min(nodes.count(), int(cfg_sei.get("max_documentos", 12)))
            if debug:
                print(f"    árvore: {nodes.count()} nós, lendo {n}")
            for i in range(n):
                try:
                    nodes.nth(i).click(timeout=3000)
                    page.wait_for_timeout(600)
                    fv = achar_frame(page, cfg_sei["frame_visualizacao"])
                    if fv:
                        txt = texto_frame(fv, 8000)
                        if len(txt) > 120:
                            partes.append(f"### DOC {i+1}\n{txt}")
                            docs_lidos += 1
                except Exception as e:
                    if debug:
                        print(f"    nó {i}: {e}")
        except Exception as e:
            if debug:
                print(f"    percorrer árvore falhou: {e}")

    texto = "\n\n".join(p for p in partes if p and p.strip())

    m = RE_PA_SEI.search(texto) or RE_PA_SEI.search(titulo) \
        or RE_CNJ.search(texto) or RE_CNJ.search(titulo)
    numero = m.group(0) if m else ""

    return {
        "numero": numero,
        "titulo_aba": titulo,
        "url": page.url,
        "texto": texto,
        "docs_lidos": docs_lidos,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Extração com o Claude
# ─────────────────────────────────────────────────────────────────────────────
def montar_schema_texto(schema):
    linhas = []
    for campo, meta in schema.items():
        s = f'- "{campo}": {meta["descricao"]}'
        if meta.get("enum"):
            s += "  |  valores possíveis: " + " | ".join(repr(v) for v in meta["enum"] if v != "")
        linhas.append(s)
    return "\n".join(linhas)


SYS = (
    "Você é um assistente do NULEJ/TJDFT que lê o conteúdo de um processo do SEI "
    "sobre um veículo apreendido e preenche a ficha de cadastro do sistema SIGNU. "
    "Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código."
)


def extrair_com_ia(client, model, schema, proc):
    prompt = f"""Abaixo está o texto extraído de um processo do SEI.

Preencha os campos do SIGNU listados. Regras:
- Use exatamente um dos valores possíveis quando o campo tiver lista.
- Se a informação não estiver no texto, use "" (string vazia). NÃO invente.
- PLACA e NIV: só letras e números, maiúsculas, sem traço/espaço. NIV = "N/A" se o processo diz que não aflorou / não foi possível identificar.
- ID_PASEI / PA_PJE: copie o número do processo exatamente como aparece.

CAMPOS:
{montar_schema_texto(schema)}

Formato da resposta (JSON):
{{
  "campos": {{ ... um par para cada campo acima ... }},
  "_confianca": 0.0 a 1.0,
  "_campos_incertos": ["NOME_DO_CAMPO", ...],
  "_alertas": ["frases curtas sobre ambiguidades, divergências ou dados faltando"]
}}

TEXTO DO PROCESSO (pode estar truncado):
\"\"\"
{proc['texto'][:45000]}
\"\"\"
"""
    msg = client.messages.create(
        model=model,
        max_tokens=1600,
        temperature=0,
        system=SYS,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip()).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group(0)) if m else {"campos": {}, "_alertas": ["IA não retornou JSON"], "_confianca": 0}

    campos = data.get("campos", {}) or {}
    # rede de segurança: se a IA não pegou o número mas o regex pegou
    for k in ("ID_PASEI", "PA_PJE"):
        if k in schema and not campos.get(k) and proc["numero"]:
            campos[k] = proc["numero"]
    data["campos"] = campos
    return data


# ─────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Protótipo extração SEI -> revisão SIGNU")
    ap.add_argument("--lista", required=True,
                    help="cegoc | pcdf1 | pcdf2 | dpj | doacoes | sei")
    ap.add_argument("--config", default=str(Path(__file__).with_name("config.json")))
    ap.add_argument("--saida-dir", default=str(Path(__file__).with_name("saida")))
    ap.add_argument("--limite", type=int, default=0, help="máx. de processos (0 = todos)")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    schema = SCHEMAS.get(args.lista.lower())
    if not schema:
        sys.exit(f"[x] lista inválida: {args.lista}. Use: {', '.join(sorted(SCHEMAS))}")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("[x] defina ANTHROPIC_API_KEY no ambiente.")

    cfg = carregar_config(args.config)
    cfg_sei = cfg["sei"]

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("[x] pip install -r requirements.txt  (playwright)")
    import anthropic

    client = anthropic.Anthropic()
    model = cfg.get("anthropic_model", "claude-sonnet-5")

    resultados = []
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.connect_over_cdp(cfg["cdp_url"])
        except Exception as e:
            sys.exit(f"[x] não conectei no Chrome em {cfg['cdp_url']}.\n"
                     f"    Abra o Chrome com --remote-debugging-port=9222 e tente de novo.\n"
                     f"    ({e})")

        paginas = [p for ctx in browser.contexts for p in ctx.pages]
        abas_sei = [p for p in paginas if eh_aba_sei(p.url, cfg_sei["url_contains"])]
        print(f"[i] {len(paginas)} abas abertas, {len(abas_sei)} parecem ser do SEI.")
        if not abas_sei:
            sys.exit("[x] nenhuma aba do SEI encontrada. Abra os processos em abas e rode de novo.\n"
                     "    (ajuste sei.url_contains no config se o endereço do seu SEI for diferente)")

        if args.limite:
            abas_sei = abas_sei[:args.limite]

        for idx, page in enumerate(abas_sei, 1):
            print(f"\n[{idx}/{len(abas_sei)}] {page.url[:90]}")
            proc = extrair_processo(page, cfg_sei, debug=args.debug)
            print(f"    processo: {proc['numero'] or '??'} | docs lidos: {proc['docs_lidos']} | "
                  f"texto: {len(proc['texto'])} chars")
            if len(proc["texto"]) < 200:
                print("    [!] pouco texto extraído — provável PDF escaneado ou seletor de frame errado.")

            try:
                ia = extrair_com_ia(client, model, schema, proc)
            except Exception as e:
                print(f"    [x] IA falhou: {e}")
                ia = {"campos": {}, "_confianca": 0, "_alertas": [f"erro IA: {e}"], "_campos_incertos": []}

            conf = ia.get("_confianca", 0)
            print(f"    confiança: {conf}  incertos: {ia.get('_campos_incertos')}")
            for a in ia.get("_alertas", []):
                print(f"      · {a}")

            resultados.append({
                "processo": proc["numero"],
                "lista": args.lista.lower(),
                "campos": ia.get("campos", {}),
                "_confianca": conf,
                "_campos_incertos": ia.get("_campos_incertos", []),
                "_alertas": ia.get("_alertas", []),
                "fonte": {
                    "url": proc["url"],
                    "titulo_aba": proc["titulo_aba"],
                    "docs_lidos": proc["docs_lidos"],
                },
                "texto_bruto_prefixo": proc["texto"][:2000],
            })

    # ── saída ──
    saida_dir = Path(args.saida_dir)
    saida_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    fjson = saida_dir / f"revisao_{args.lista.lower()}_{ts}.json"
    fcsv  = saida_dir / f"revisao_{args.lista.lower()}_{ts}.csv"

    fjson.write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")

    cols = ["processo", "_confianca"] + list(schema.keys()) + ["_campos_incertos", "_alertas", "fonte_url"]
    with fcsv.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in resultados:
            linha = {"processo": r["processo"], "_confianca": r["_confianca"],
                     "_campos_incertos": " ; ".join(r["_campos_incertos"]),
                     "_alertas": " ; ".join(r["_alertas"]),
                     "fonte_url": r["fonte"]["url"]}
            linha.update(r["campos"])
            w.writerow(linha)

    print(f"\n[ok] {len(resultados)} processo(s) -> {fjson}")
    print(f"[ok]                            -> {fcsv}")
    print("\nConfira o CSV/JSON antes de cadastrar qualquer coisa no SIGNU. "
          "Nada foi gravado no sistema.")


if __name__ == "__main__":
    main()
