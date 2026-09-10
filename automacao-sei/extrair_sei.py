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
        "NIV":               CAMPO("NIV/chassi do INFOSEG. 'N/A' se não houver INFOSEG"),
        "NIV_NAO_AFLORADO":  CAMPO("'TRUE' se não houver INFOSEG no processo, senão 'FALSE'", ["TRUE", "FALSE"]),
        "PLACA":             CAMPO("Placa do INFOSEG, só letras e números"),
        "PLACA_OSTENTADA":   CAMPO("Placa citada no auto/BO quando NÃO há INFOSEG (só p/ busca)"),
        "DEPOSITO":          CAMPO("Depósito onde o bem está", DEPOSITOS),
        "STATUS_DILIGENCIA": CAMPO("Situação da diligência", STATUS_DI),
        "OBSERVACOES":       CAMPO("Resumo em 1-2 frases"),
    },
    "pcdf2": {
        "ID_PASEI":          CAMPO("Número do processo SEI/PA"),
        "TIPO_BEM":          CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":               CAMPO("NIV/chassi do INFOSEG. 'N/A' se não houver INFOSEG"),
        "NIV_NAO_AFLORADO":  CAMPO("'TRUE' se não houver INFOSEG no processo, senão 'FALSE'", ["TRUE", "FALSE"]),
        "PLACA":             CAMPO("Placa do INFOSEG, só letras e números"),
        "PLACA_OSTENTADA":   CAMPO("Placa citada no auto/BO quando NÃO há INFOSEG (só p/ busca)"),
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

# Marcador do SEI -> lista do SIGNU. O texto tem que bater (case-insensitive,
# ignora acento) com o rótulo do marcador na listagem "Controle de Processos".
# Pode sobrescrever no config.json em marcadores.mapa.
MARCADOR_LISTA = {
    "CADASTRAR SIGNU CEGOC":   "cegoc",
    "CADASTRAR SIGNU DPJ":     "dpj",
    "CADASTRAR SIGNU PCDF 1":  "pcdf1",
    "CADASTRAR SIGNU PCDF 2":  "pcdf2",
    "CADASTRAR SIGNU SEI":     "sei",
}
# Marcador aplicado depois de processar (troca feita à mão por enquanto — ver README).
MARCADOR_POS = "REVISAR - CADASTRADO SIGNU"

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


def _sem_acento(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                    if unicodedata.category(c) != "Mn")


def _norm(s):
    return re.sub(r"\s+", " ", _sem_acento(str(s)).upper()).strip()


def descobrir_por_marcador(sei_page, mapa, filtro_lista=None, max_paginas=10, debug=False):
    """Lê a listagem 'Controle de Processos' aberta e devolve os processos cujo
    marcador está no `mapa`. Retorna [{numero, url, lista, marcador}]."""
    mapa_norm = {_norm(k): v for k, v in mapa.items()}
    achados, vistos = [], set()

    for pagina in range(1, max_paginas + 1):
        try:
            sei_page.wait_for_load_state("domcontentloaded", timeout=8000)
        except Exception:
            pass

        # a listagem costuma estar num frame de conteúdo; varre todos
        frames = [sei_page.main_frame] + [f for f in sei_page.frames if f is not sei_page.main_frame]
        linhas_frame = None
        for f in frames:
            try:
                linhas = f.locator("table tr")
                if linhas.count() >= 2 and f.locator("a[href*='procedimento_trabalhar'], a[href*='id_procedimento']").count():
                    linhas_frame = f
                    break
            except Exception:
                continue
        if linhas_frame is None:
            if debug:
                print("    [debug] não achei a tabela de processos nesta página")
            break

        linhas = linhas_frame.locator("table tr")
        total = linhas.count()
        if debug:
            print(f"    [debug] página {pagina}: {total} linhas na tabela")
        for i in range(total):
            row = linhas.nth(i)
            try:
                link = row.locator("a[href*='procedimento_trabalhar'], a[href*='id_procedimento']").first
                if not link.count():
                    continue
                href = link.get_attribute("href") or ""
                numero = _norm(link.inner_text())
                # rótulo do marcador: texto da linha + títulos/tooltips dos elementos de marcador
                blob = _norm(row.inner_text())
                try:
                    for attr in ("title", "data-original-title", "aria-label", "alt"):
                        for el in row.locator(f"[{attr}]").all():
                            blob += " " + _norm(el.get_attribute(attr) or "")
                except Exception:
                    pass

                marc_encontrado = next((mn for mn in mapa_norm if mn and mn in blob), None)
                if not marc_encontrado:
                    continue
                lista = mapa_norm[marc_encontrado]
                if filtro_lista and lista != filtro_lista:
                    continue

                url = href if href.startswith("http") else _abs_url(sei_page.url, href)
                chave = numero or url
                if chave in vistos:
                    continue
                vistos.add(chave)
                achados.append({"numero": link.inner_text().strip(), "url": url,
                                "lista": lista, "marcador": marc_encontrado})
            except Exception as e:
                if debug:
                    print(f"    [debug] linha {i}: {e}")

        # próxima página
        try:
            prox = linhas_frame.locator(
                "a:has-text('Próxima'), a[title*='Próxima'], a:has-text('>>'), a[title*='próxima']"
            ).first
            if prox.count() and prox.is_enabled():
                prox.click(timeout=3000)
                sei_page.wait_for_timeout(1200)
                continue
        except Exception:
            pass
        break

    return achados


def _abs_url(base, href):
    from urllib.parse import urljoin
    return urljoin(base, href)


def ir_para_controle_processos(page, debug=False):
    """Navega a aba do SEI para a tela 'Controle de Processos' (listagem com marcadores)."""
    try:
        link = page.locator("a[href*='acao=procedimento_controlar']").first
        if link.count():
            href = link.get_attribute("href")
            page.goto(_abs_url(page.url, href), wait_until="domcontentloaded", timeout=20000)
        else:
            page.get_by_role("link", name=re.compile("Controle de Processos", re.I)).first.click(timeout=5000)
    except Exception as e:
        if debug:
            print(f"    [debug] navegação p/ Controle de Processos falhou: {e}")
    for st in ("domcontentloaded", "networkidle"):
        try:
            page.wait_for_load_state(st, timeout=8000)
        except Exception:
            pass
    page.wait_for_timeout(1500)


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
- PLACA e NIV: só letras e números, maiúsculas, sem traço/espaço.
- ID_PASEI / PA_PJE: copie o número do processo exatamente como aparece.

FONTE DOS DADOS DO VEÍCULO (regra do NULEJ):
- Se houver um relatório/consulta **INFOSEG** no processo, os dados do veículo
  (NIV/chassi, placa, tipo, marca/modelo) SÃO OS DO INFOSEG — use esses, mesmo
  que outro documento divirja. Em "_alertas", registre eventual divergência.
- Se NÃO houver INFOSEG no processo, trate como **NIV não aflorado**:
  NIV = "N/A", NIV_NAO_AFLORADO = "TRUE", e a placa (se citada em auto de
  apreensão/BO) vai em PLACA_OSTENTADA, não em PLACA. Adicione o alerta
  "sem INFOSEG — NIV não aflorado".

CAMPOS:
{montar_schema_texto(schema)}

Formato da resposta (JSON):
{{
  "campos": {{ ... um par para cada campo acima ... }},
  "_infoseg": true/false,
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
def processar(page, cfg_sei, client, model, lista, args):
    """Extrai texto da página de um processo + IA. Retorna o dict de resultado."""
    schema = SCHEMAS[lista]
    proc = extrair_processo(page, cfg_sei, debug=args.debug)
    print(f"    processo: {proc['numero'] or '??'} | lista: {lista} | "
          f"docs lidos: {proc['docs_lidos']} | texto: {len(proc['texto'])} chars")
    if len(proc["texto"]) < 200:
        print("    [!] pouco texto extraído — provável PDF escaneado ou seletor de frame errado.")

    try:
        ia = extrair_com_ia(client, model, schema, proc)
    except Exception as e:
        print(f"    [x] IA falhou: {e}")
        ia = {"campos": {}, "_confianca": 0, "_alertas": [f"erro IA: {e}"], "_campos_incertos": []}

    campos = ia.get("campos", {}) or {}
    campos.setdefault("RESPONSAVEL", "__AUTO__")  # SIGNU resolve o servidor na ingestão

    infoseg = bool(ia.get("_infoseg"))
    # coerência: sem INFOSEG => NIV não aflorado
    if "NIV_NAO_AFLORADO" in campos and not infoseg:
        campos["NIV_NAO_AFLORADO"] = "TRUE"
        if not campos.get("NIV"):
            campos["NIV"] = "N/A"

    conf = ia.get("_confianca", 0)
    print(f"    confiança: {conf}  INFOSEG: {infoseg}  incertos: {ia.get('_campos_incertos')}")
    for a in ia.get("_alertas", []):
        print(f"      · {a}")

    return {
        "processo": proc["numero"],
        "lista": lista,
        "campos": campos,
        "_infoseg": infoseg,
        "_confianca": conf,
        "_campos_incertos": ia.get("_campos_incertos", []),
        "_alertas": ia.get("_alertas", []),
        "fonte": {"url": proc["url"], "titulo_aba": proc["titulo_aba"], "docs_lidos": proc["docs_lidos"]},
        "texto_bruto_prefixo": proc["texto"][:2000],
    }


def main():
    ap = argparse.ArgumentParser(description="Protótipo extração SEI -> revisão SIGNU")
    ap.add_argument("--modo", choices=["marcador", "abas"], default="marcador",
                    help="marcador: varre a listagem do SEI pelos marcadores (padrão). "
                         "abas: processa as abas de processo já abertas.")
    ap.add_argument("--lista", default=None,
                    help="modo abas: obrigatório. modo marcador: filtra para só essa lista.")
    ap.add_argument("--config", default=str(Path(__file__).with_name("config.json")))
    ap.add_argument("--saida-dir", default=str(Path(__file__).with_name("saida")))
    ap.add_argument("--limite", type=int, default=0, help="máx. de processos (0 = todos)")
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--dump", nargs="?", const="cp", default=None,
                    help="diagnóstico e sai. --dump (Controle de Processos) | --dump marcadores | --dump aqui")
    args = ap.parse_args()

    if args.lista and args.lista.lower() not in SCHEMAS:
        sys.exit(f"[x] lista inválida: {args.lista}. Use: {', '.join(sorted(SCHEMAS))}")
    if args.modo == "abas" and not args.lista and not args.dump:
        sys.exit("[x] modo abas exige --lista.")
    if not args.dump and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("[x] defina ANTHROPIC_API_KEY no ambiente.")

    cfg = carregar_config(args.config)
    cfg_sei = cfg["sei"]
    mapa_marc = (cfg.get("marcadores") or {}).get("mapa") or MARCADOR_LISTA

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
            sys.exit(f"[x] não conectei no navegador em {cfg['cdp_url']}.\n"
                     f"    Abra o navegador com --remote-debugging-port=9222 e tente de novo.\n"
                     f"    ({e})")

        paginas = [p for ctx in browser.contexts for p in ctx.pages]
        abas_sei = [p for p in paginas if eh_aba_sei(p.url, cfg_sei["url_contains"])]
        print(f"[i] {len(paginas)} abas abertas, {len(abas_sei)} parecem ser do SEI.")
        if not abas_sei:
            sys.exit("[x] nenhuma aba do SEI encontrada. Deixe o SEI aberto e logado.\n"
                     "    (ajuste sei.url_contains no config se o endereço do seu SEI for diferente)")

        if args.dump:
            pg = abas_sei[0]
            pg.bring_to_front()
            for st in ("domcontentloaded", "networkidle"):
                try:
                    pg.wait_for_load_state(st, timeout=8000)
                except Exception:
                    pass
            pg.wait_for_timeout(1500)
            if args.dump == "marcadores":
                print("[i] indo para o menu Marcadores…")
                try:
                    a = pg.locator("a[href*='acao=marcador_listar']").first
                    pg.goto(_abs_url(pg.url, a.get_attribute("href")), wait_until="domcontentloaded", timeout=20000)
                except Exception as e:
                    print(f"[!] falhou: {e}")
                pg.wait_for_timeout(2000)
            elif args.dump == "cp" and pg.locator("table tr").count() < 2:
                print("[i] aba não está numa listagem — indo para 'Controle de Processos'…")
                ir_para_controle_processos(pg, debug=True)
            pg.wait_for_timeout(1500)
            try:
                ifr = pg.locator("iframe")
                print(f"[i] elementos <iframe> na página: {ifr.count()}")
                for i in range(ifr.count()):
                    el = ifr.nth(i)
                    print(f"    iframe[{i}] id={el.get_attribute('id')!r} "
                          f"name={el.get_attribute('name')!r} src={(el.get_attribute('src') or '')[:120]}")
            except Exception as e:
                print(f"[i] erro listando iframes: {e}")
            print(f"\n=== DUMP da aba: {pg.url}\n")
            frame_tab = None
            for fi, f in enumerate(pg.frames):
                try:
                    nlinks = f.locator("a").count()
                    ntr = f.locator("table tr").count()
                except Exception:
                    nlinks = ntr = -1
                print(f"[frame {fi}] name={f.name!r}  linhas_tabela={ntr}  links={nlinks}  url={f.url[:110]}")
                if ntr and ntr >= 2 and frame_tab is None:
                    try:
                        if f.locator("a[href*='procedimento_trabalhar'], a[href*='id_procedimento']").count():
                            frame_tab = f
                    except Exception:
                        pass

            if args.dump == "marcadores":
                f = frame_tab or pg.main_frame
                print("\n--- tabela de Marcadores: linhas + links ---")
                rows = f.locator("table tr")
                for i in range(min(rows.count(), 40)):
                    r = rows.nth(i)
                    try:
                        txt = re.sub(r"\s+", " ", r.inner_text() or "").strip()
                        if not txt:
                            continue
                        print(f"\n  linha {i}: {txt[:120]!r}")
                        for a in r.locator("a").all()[:10]:
                            at = re.sub(r"\s+", " ", (a.inner_text() or "")).strip()[:40]
                            ah = (a.get_attribute("href") or "")[:150]
                            ati = (a.get_attribute("title") or a.get_attribute("aria-label") or "")[:60]
                            print(f"     a {at!r} title={ati!r} -> {ah}")
                    except Exception as e:
                        print(f"  linha {i}: erro {e}")
                print("\n=== fim do dump. Cole essa saída aqui."); return

            if frame_tab is None:
                print("\n[!] nenhuma tabela de processos encontrada.")
                print("=== fim do dump."); return

            print(f"\n--- analisando linhas da tabela de processos (frame {pg.frames.index(frame_tab)}) ---")
            rows = frame_tab.locator("table tr")
            mostradas = 0
            for i in range(rows.count()):
                if mostradas >= 15:
                    break
                r = rows.nth(i)
                try:
                    plink = r.locator("a[href*='procedimento_trabalhar'], a[href*='id_procedimento']").first
                    if not plink.count():
                        continue
                    numero = re.sub(r"\s+", " ", plink.inner_text() or "").strip()
                    row_txt = re.sub(r"\s+", " ", r.inner_text() or "").strip()
                    attrs = []
                    for attr in ("title", "data-original-title", "aria-label", "alt"):
                        for el in r.locator(f"[{attr}]").all()[:12]:
                            v = (el.get_attribute(attr) or "").strip()
                            if v:
                                attrs.append(f"{attr}={v!r}")
                    imgs = []
                    for im in r.locator("img").all()[:12]:
                        s = (im.get_attribute("src") or "")
                        t = (im.get_attribute("title") or im.get_attribute("alt") or "")
                        if "marca" in s.lower() or "marca" in t.lower() or t:
                            imgs.append(f"img[{t!r} {s.split('/')[-1][:40]}]")
                    print(f"\n  linha {i}: processo={numero!r}")
                    print(f"    texto: {row_txt[:160]!r}")
                    if attrs: print(f"    attrs: {' | '.join(attrs[:8])}")
                    if imgs: print(f"    imgs:  {' | '.join(imgs[:8])}")
                    mostradas += 1
                except Exception as e:
                    print(f"  linha {i}: erro {e}")
            print("\n=== fim do dump. Cole essa saída aqui.")
            return

        if args.modo == "abas":
            alvos = abas_sei[:args.limite] if args.limite else abas_sei
            for idx, page in enumerate(alvos, 1):
                print(f"\n[{idx}/{len(alvos)}] {page.url[:90]}")
                resultados.append(processar(page, cfg_sei, client, model, args.lista.lower(), args))

        else:  # modo marcador
            filtro = args.lista.lower() if args.lista else None
            sei_page = abas_sei[0]
            sei_page.bring_to_front()
            if sei_page.locator("table tr").count() < 2:
                print("[i] indo para 'Controle de Processos'…")
                ir_para_controle_processos(sei_page, debug=args.debug)
            print(f"[i] procurando marcadores na listagem: {sei_page.url[:90]}")
            fila = descobrir_por_marcador(sei_page, mapa_marc, filtro_lista=filtro, debug=args.debug)
            if not fila:
                sys.exit("[x] nenhum processo com os marcadores mapeados foi encontrado.\n"
                         "    Abra o 'Controle de Processos' do SEI (a tela com a lista + coluna de marcador)\n"
                         "    e rode de novo. Use --debug para ver o que o script está lendo.")
            if args.limite:
                fila = fila[:args.limite]
            por_lista = {}
            for f in fila:
                por_lista[f["lista"]] = por_lista.get(f["lista"], 0) + 1
            print(f"[i] {len(fila)} processo(s) na fila: " +
                  ", ".join(f"{k}={v}" for k, v in por_lista.items()))

            work = sei_page.context.new_page()
            try:
                for idx, item in enumerate(fila, 1):
                    print(f"\n[{idx}/{len(fila)}] {item['numero']}  ({item['marcador']} -> {item['lista']})")
                    try:
                        work.goto(item["url"], wait_until="domcontentloaded", timeout=20000)
                    except Exception as e:
                        print(f"    [x] não abriu: {e}")
                        continue
                    work.wait_for_timeout(800)
                    resultados.append(processar(work, cfg_sei, client, model, item["lista"], args))
            finally:
                work.close()

    if not resultados:
        sys.exit("[x] nada processado.")

    # ── saída ──
    saida_dir = Path(args.saida_dir)
    saida_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = (args.lista.lower() if args.lista else args.modo)
    fjson = saida_dir / f"revisao_{tag}_{ts}.json"
    fcsv  = saida_dir / f"revisao_{tag}_{ts}.csv"

    fjson.write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")

    todas_chaves = []
    for r in resultados:
        for k in r["campos"]:
            if k not in todas_chaves:
                todas_chaves.append(k)
    cols = ["processo", "lista", "_confianca", "_infoseg"] + todas_chaves + ["_campos_incertos", "_alertas", "fonte_url"]
    with fcsv.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in resultados:
            linha = {"processo": r["processo"], "lista": r["lista"], "_confianca": r["_confianca"],
                     "_infoseg": r.get("_infoseg", ""),
                     "_campos_incertos": " ; ".join(r["_campos_incertos"]),
                     "_alertas": " ; ".join(r["_alertas"]),
                     "fonte_url": r["fonte"]["url"]}
            linha.update(r["campos"])
            w.writerow(linha)

    print(f"\n[ok] {len(resultados)} processo(s) -> {fjson}")
    print(f"[ok]                            -> {fcsv}")
    print(f"\nPróximo passo manual: nos processos abaixo, troque o marcador verde "
          f"pelo rosa «{MARCADOR_POS}» no SEI:")
    for r in resultados:
        print(f"  - {r['processo'] or r['fonte']['url']}")
    print("\nNada foi gravado no SIGNU. Confira o CSV/JSON antes de cadastrar.")


if __name__ == "__main__":
    main()
