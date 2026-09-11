#!/usr/bin/env python3
"""
Protótipo — extração SEI -> revisão para cadastro no SIGNU.

O QUE FAZ
  1. Conecta no navegador que VOCÊ já abriu e logou no SEI (via CDP).
  2. Acha os processos pelos marcadores "CADASTRAR SIGNU <lista>" (ou processa
     as abas de processo abertas, com --modo abas).
  3. Em cada processo: lê o texto dos frames da árvore/documento
     (ifrArvore, ifrConteudoVisualizacao, ifrVisualizacao).
  4. Manda o texto para a API do Google Gemini com um schema de campos do SIGNU
     e recebe um registro estruturado + nível de confiança + alertas.
  5. Grava saida/revisao_<timestamp>.json  e  .csv  para conferência humana.

O QUE NÃO FAZ (de propósito)
  - Não grava nada no SIGNU. Não clica em "salvar" em lugar nenhum.
  - Não faz login, não guarda senha: você loga no navegador.

COMO RODAR   (ver README.md para o passo a passo completo)
  1. Abrir o navegador com porta de depuração e logar no SEI:
       open -a "Comet" --args --remote-debugging-port=9222 \
         --user-data-dir="$HOME/comet-sei-debug"
  2. Colar a chave do Gemini em "gemini_api_key" no config.json.
  3. Marcar os processos no SEI com "CADASTRAR SIGNU <lista>".
  4. python extrair_sei.py            # varre pelos marcadores
"""

import argparse
import base64
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
# DPJ recebe lotes cíveis — nem tudo é veículo (mesma lista da tela de edição do SIGNU)
TIPOS_BEM_DPJ = ["CARRO", "MOTO", "CAMINHÃO", "CAMINHONETE", "REBOQUE", "VEÍCULO",
                  "ELETRÔNICO", "ELETRODOMÉSTICO", "INFORMÁTICA", "MÓVEIS", "FERRAMENTAS",
                  "DIVERSOS", "OUTROS"]
DESTINACOES = ["CIRCULAÇÃO", "RECICLAGEM"]
STATUS_DI   = ["AGUARDANDO", "EM DILIGÊNCIA", "ATRASADO", "PRAZO 6 MESES", "BAIXADO",
               "EM DILIGÊNCIA HIGEIA", "LPC", "CATÁLOGO", "RENAJUD"]
DEPOSITOS   = ["SELAB/PCDF", "CPA/PCDF", "CPA", "CEGOC", "5ªDP", "23ªDP", "30ªDP", "33ªDP"]
ACOES_SEI   = ["DILIGÊNCIA", "ARQUIVAR", "ENCAMINHAR", "AGUARDAR RETORNO", "CONCLUIR"]
MOTIVOS     = ["DETERIORADO", "BAIXA", "DOAÇÃO", "ARREMATAÇÃO LPC", "OUTROS"]

CAMPO = lambda desc, enum=None: {"descricao": desc, "enum": enum}

# Descrição do bem (p/ o catálogo do leilão) — sai preferencialmente do INFOSEG.
DESC_VEICULO = {
    "MARCA_MODELO":   CAMPO("Marca/modelo do veículo (ex.: GM/Corsa Wind)"),
    "ANO_FAB_MODELO": CAMPO("Ano de fabricação/modelo (ex.: 2005/2006)"),
    "COR":            CAMPO("Cor predominante"),
    "RENAVAM":        CAMPO("RENAVAM, só dígitos"),
}

SCHEMAS = {
    "cegoc": {
        "ID_PASEI":          CAMPO("Número do processo SEI/PA (formato 00000-00000000/0000-00)"),
        "TIPO_BEM":          CAMPO("Tipo do veículo", TIPOS_BEM),
        "NIV":               CAMPO("NIV/chassi (17 caracteres). 'N/A' se não aflorado/ilegível"),
        "PLACA":             CAMPO("Placa ostentada, só letras e números, sem traço"),
        **DESC_VEICULO,
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
        **DESC_VEICULO,
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
        **DESC_VEICULO,
        "DEPOSITO":          CAMPO("Depósito onde o bem está", DEPOSITOS),
        "STATUS_DILIGENCIA": CAMPO("Situação da diligência", STATUS_DI),
        "PA_TJDFT":          CAMPO("Nº do PA administrativo do TJDFT, se citado; senão 'N/C'"),
        "OBSERVACOES":       CAMPO("Resumo em 1-2 frases"),
    },
    "dpj": {
        # Extrai o 1º/principal bem do lote. Lote com vários bens diferentes
        # ainda precisa de conferência manual — ver LIMITAÇÕES no README.
        "PA_PJE":       CAMPO("Número do processo PJe"),
        "LOTE":         CAMPO("Número do lote, se citado"),
        "TIPO_BEM":     CAMPO("Tipo do bem (nem sempre é veículo)", TIPOS_BEM_DPJ),
        "DESCRICAO":    CAMPO("Descrição do bem — obrigatória se não for veículo (ex.: '5 cadeiras de escritório')"),
        "QUANTIDADE":   CAMPO("Quantidade do item, se citada (padrão '1')"),
        "NIV":          CAMPO("NIV/chassi, se for veículo"),
        "PLACA":        CAMPO("Placa, só letras e números, se for veículo"),
        **DESC_VEICULO,
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
    "CADASTRAR SIGNU PCDF 2":  "pcdf2",
    # PCDF 1ª não recebe mais cadastro novo — marcador foi excluído no SEI.
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


def _primeiro_proc(page):
    try:
        pl = page.locator("a[href*='acao=procedimento_trabalhar']").first
        return pl.inner_text().strip() if pl.count() else ""
    except Exception:
        return ""


def _paginar(page, direcao):
    """Chama a paginação AJAX do SEI (infraAcaoPaginar) e espera a lista mudar.
    direcao: '-' (anterior/1ª) ou '+' (próxima). Retorna True se a lista mudou."""
    antes = _primeiro_proc(page)
    for grupo in ("Recebidos", "Gerados"):
        try:
            page.evaluate(f"infraAcaoPaginar('{direcao}',0,'{grupo}', null)")
        except Exception:
            pass
    for _ in range(20):
        page.wait_for_timeout(300)
        if _primeiro_proc(page) != antes:
            return True
    return False


def _primeira_pagina(page, debug=False):
    """Rebobina a paginação do 'Recebidos' até a 1ª página (AJAX)."""
    for _ in range(30):
        if not _paginar(page, "-"):
            break


def descobrir_por_marcador(sei_page, mapa, filtro_lista=None, max_paginas=12, debug=False):
    """Lê a listagem 'Controle de Processos' aberta e devolve os processos cujo
    marcador está no `mapa`. Retorna [{numero, url, lista, marcador}]."""
    mapa_norm = {_norm(k): v for k, v in mapa.items()}
    achados, vistos = [], set()
    _primeira_pagina(sei_page, debug=debug)

    for pagina in range(1, max_paginas + 1):
        try:
            sei_page.wait_for_load_state("domcontentloaded", timeout=8000)
        except Exception:
            pass

        # a listagem costuma estar num frame de conteúdo; varre todos
        frames = [sei_page.main_frame] + [f for f in sei_page.frames if f is not sei_page.main_frame]
        SEL_PROC = "a[href*='acao=procedimento_trabalhar']"
        linhas_frame = None
        for f in frames:
            try:
                linhas = f.locator("table tr")
                if linhas.count() >= 2 and f.locator(SEL_PROC).count():
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
                # o link do PROCESSO é o que tem acao=procedimento_trabalhar
                # (a linha também tem link p/ gerenciar marcador, anotação, etc.)
                link = row.locator(SEL_PROC).first
                if not link.count():
                    cand = row.locator("a").filter(has_text=re.compile(r"\d{4,6}[-./]\d")).first
                    if not cand.count():
                        continue
                    link = cand
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
                # link p/ "Marcadores do Processo" — é onde fica o texto anotado no marcador
                link_marc = row.locator("a[href*='andamento_marcador_gerenciar']").first
                href_marc = link_marc.get_attribute("href") if link_marc.count() else None
                url_marc  = _abs_url(sei_page.url, href_marc) if href_marc else None
                achados.append({"numero": link.inner_text().strip(), "url": url,
                                "lista": lista, "marcador": marc_encontrado, "url_marcador": url_marc})
            except Exception as e:
                if debug:
                    print(f"    [debug] linha {i}: {e}")

        # próxima página (paginação AJAX do SEI)
        if _paginar(sei_page, "+"):
            continue
        break

    if debug:
        print(f"    [debug] descoberta varreu {pagina} página(s)")
    return achados


def _abs_url(base, href):
    from urllib.parse import urljoin
    return urljoin(base, href)


def ler_texto_marcador(page, url, nome_marcador, debug=False):
    """Abre 'Marcadores do Processo' (tela de gerenciar) e devolve o texto que o
    servidor anotou junto do marcador — é ali que a CEGOC diz circulação/reciclagem
    e o Caixa SEI recebe o nome do responsável."""
    if not url:
        return ""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(900)
    except Exception as e:
        if debug:
            print(f"    [debug] abrir marcadores do processo: {e}")
        return ""
    alvo = _norm(nome_marcador)
    try:
        linhas = page.locator("table tr")
        for i in range(linhas.count()):
            row = linhas.nth(i)
            if alvo not in _norm(row.inner_text() or ""):
                continue
            celulas = row.locator("td")
            n = celulas.count()
            valores = [re.sub(r"\s+", " ", (celulas.nth(k).inner_text() or "")).strip() for k in range(n)]
            if debug:
                print(f"    [debug] linha do marcador: {valores}")
            # colunas esperadas: Marcador | Texto | Usuário | Data/Hora | Ações
            if n >= 2:
                return valores[1]
    except Exception as e:
        if debug:
            print(f"    [debug] ler texto do marcador: {e}")
    return ""


# Servidores do NULEJ (mesma lista do SIGNU) — usados p/ casar o nome anotado no
# marcador "CADASTRAR SIGNU SEI" com o responsável a atribuir.
SERVIDORES = ["Carla Araújo", "Amanda Junqueira", "Carlos Caetano",
              "Cláudia Santos", "Loara Passo", "Letícia Mota", "Marcelo Oliveira"]


def casar_servidor(texto):
    """Casa o texto livre anotado no marcador com um nome da lista SERVIDORES
    (case/acento-insensível, substring nos dois sentidos). None se não achar."""
    t = _norm(texto)
    if not t:
        return None
    for s in SERVIDORES:
        sn = _norm(s)
        if sn in t or t in sn or _norm(s.split(" ")[0]) == t:
            return s
    return None


def ir_para_controle_processos(page, debug=False):
    """Navega a aba do SEI para a tela 'Controle de Processos' (listagem completa)."""
    try:
        # preferir o link do MENU (tem reset=1 -> listagem completa, sem filtro/paginação herdada)
        alvo = None
        for a in page.locator("a[href*='acao=procedimento_controlar']").all():
            h = a.get_attribute("href") or ""
            if "reset=1" in h:
                alvo = h
                break
        if alvo:
            page.goto(_abs_url(page.url, alvo), wait_until="domcontentloaded", timeout=20000)
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
    for st in ("domcontentloaded", "networkidle"):
        try:
            page.wait_for_load_state(st, timeout=10000)
        except Exception:
            pass

    titulo = ""
    try:
        titulo = page.title()
    except Exception:
        pass

    # SEI/TJDFT: a ÁRVORE de documentos fica no ifrArvore; cada nó é
    # <a href="...&id_documento=NNN..."> e o conteúdo abre no ifrConteudoVisualizacao.
    nome_arvore = cfg_sei.get("frame_arvore", "ifrArvore")
    nome_conteudo = cfg_sei.get("frame_conteudo", "ifrConteudoVisualizacao")

    fr_arvore = None
    for tentativa in range(15):
        fr_arvore = achar_frame(page, nome_arvore)
        if fr_arvore and len(texto_frame(fr_arvore, 500)) > 40:
            break
        page.wait_for_timeout(1000)
    if debug:
        print(f"    frames: {[f.name for f in page.frames]} (após {tentativa+1}s)")

    def _ler_conteudo():
        """Texto do ifrConteudoVisualizacao + qualquer frame aninhado com corpo de doc."""
        chunks = []
        for nome in (nome_conteudo, cfg_sei.get("frame_visualizacao", "ifrVisualizacao")):
            fc = achar_frame(page, nome)
            if fc:
                chunks.append(texto_frame(fc, 12000))
        for f in page.frames:  # doc costuma carregar +1 nível abaixo
            if f.name in ("", nome_arvore, nome_conteudo, "ifrArvore", "ifrPasta"):
                continue
            sub = texto_frame(f, 10000)
            if len(sub) > 150:
                chunks.append(sub)
        vistos, out = set(), []
        for c in chunks:
            k = c[:200]
            if c.strip() and k not in vistos:
                vistos.add(k); out.append(c)
        return "\n".join(out)

    def _achar_pdf_url():
        """Depois de abrir um doc, acha a URL do PDF (documento_download_anexo / .pdf)
        varrendo as URLs dos frames e os src de embed/iframe/object."""
        alvos = []
        for f in page.frames:
            if "documento_download" in f.url or f.url.lower().endswith(".pdf"):
                alvos.append(f.url)
            try:
                for sel in ("embed[src]", "iframe[src]", "object[data]"):
                    for el in f.locator(sel).all():
                        s = el.get_attribute("src") or el.get_attribute("data") or ""
                        if "documento_download" in s or s.lower().endswith(".pdf"):
                            alvos.append(s if s.startswith("http") else _abs_url(f.url, s))
            except Exception:
                pass
        return alvos[0] if alvos else None

    partes = []
    docs_lidos = 0
    pdfs = []

    if fr_arvore:
        nodes = fr_arvore.locator("a[href*='id_documento']")
        total = nodes.count()
        titulos, hrefs = [], []
        for i in range(total):
            titulos.append(re.sub(r"\s+", " ", (nodes.nth(i).inner_text() or "")).strip()[:90])
            hrefs.append(nodes.nth(i).get_attribute("href") or "")
        # ignora o nó raiz (só id_procedimento) e duplicatas de id_documento
        idx_por_doc = {}
        for i, h in enumerate(hrefs):
            m = re.search(r"id_documento=(\d+)", h)
            if m and m.group(1) not in idx_por_doc:
                idx_por_doc[m.group(1)] = i
        ordem = list(idx_por_doc.values())
        # INFOSEG primeiro
        ordem.sort(key=lambda i: (0 if "INFOSEG" in titulos[i].upper() else 1, i))
        ordem = ordem[: int(cfg_sei.get("max_documentos", 25))]
        partes.append("### DOCUMENTOS DO PROCESSO\n" + "\n".join(
            f"- {titulos[i]}" for i in ordem))
        if debug:
            print(f"    árvore: {total} <a>, {len(idx_por_doc)} documentos únicos, lendo {len(ordem)}")

        max_pdf_mb = float(cfg_sei.get("max_pdf_mb", 12))
        max_pdfs = int(cfg_sei.get("max_pdfs", 6))
        if cfg_sei.get("percorrer_arvore"):
            for i in ordem:
                try:
                    nodes.nth(i).click(timeout=4000)
                    page.wait_for_timeout(1400)
                    txt = _ler_conteudo()
                    if len(txt) > 120:
                        partes.append(f"### DOC — {titulos[i]}\n{txt}")
                        docs_lidos += 1
                        continue
                    # sem texto no DOM -> tentar baixar o PDF e mandar pro Gemini
                    pdf_url = _achar_pdf_url()
                    if pdf_url and len(pdfs) < max_pdfs:
                        try:
                            resp = page.context.request.get(pdf_url, timeout=30000)
                            body = resp.body() if resp.ok else b""
                        except Exception as e:
                            body = b""
                            if debug:
                                print(f"    '{titulos[i]}': download falhou: {e}")
                        if body and len(body) <= max_pdf_mb * 1_000_000:
                            pdfs.append({"titulo": titulos[i],
                                         "b64": base64.b64encode(body).decode()})
                            docs_lidos += 1
                            if debug:
                                print(f"    '{titulos[i]}': PDF {len(body)//1024} KB -> Gemini")
                        elif debug:
                            print(f"    '{titulos[i]}': PDF {len(body)} bytes (fora do limite / vazio)")
                    elif debug:
                        print(f"    '{titulos[i]}': sem texto e sem PDF localizável")
                except Exception as e:
                    if debug:
                        print(f"    nó '{titulos[i]}': {e}")
    else:
        partes.append("### PÁGINA\n" + texto_frame(page.main_frame, 8000))

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
        "pdfs": pdfs,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Extração com a API do Google Gemini (generativelanguage.googleapis.com)
# ─────────────────────────────────────────────────────────────────────────────
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def chamar_gemini(api_key, model, system, prompt, pdfs=None, max_tokens=4096, timeout=180):
    """POST .../{model}:generateContent — retorna (texto, finish_reason).
    pdfs: lista de {titulo, b64} anexada como inline_data application/pdf."""
    import urllib.request
    import urllib.error

    parts = [{"text": prompt}]
    for d in (pdfs or []):
        parts.append({"text": f"\n[PDF anexado: {d.get('titulo','documento')}]"})
        parts.append({"inline_data": {"mime_type": "application/pdf", "data": d["b64"]}})

    url = f"{GEMINI_BASE}/{model}:generateContent"
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", "replace")[:400]
        if e.code == 404:
            detalhe += (f"\n    -> modelo '{model}' não encontrado. Veja os disponíveis:\n"
                        f"       curl -s '{GEMINI_BASE}?key=SUA_CHAVE' | grep '\"name\"'\n"
                        f"       e ajuste 'gemini_model' no config.json (ex.: gemini-2.5-flash).")
        raise RuntimeError(f"Gemini HTTP {e.code}: {detalhe}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Gemini sem conexão: {e.reason}")

    cands = data.get("candidates") or []
    if not cands:
        fb = data.get("promptFeedback", {})
        raise RuntimeError(f"Gemini não retornou candidata (block: {fb.get('blockReason')})")
    fr = cands[0].get("finishReason", "")
    parts = (cands[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip(), fr


def _extrair_json(raw):
    """Tira cercas, tenta json.loads, senão isola do 1º '{' até fechar as chaves."""
    s = re.sub(r"^```(?:json)?|```$", "", raw.strip()).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    i = s.find("{")
    if i < 0:
        raise ValueError("sem '{' na resposta")
    prof, fim = 0, None
    for j in range(i, len(s)):
        if s[j] == "{":
            prof += 1
        elif s[j] == "}":
            prof -= 1
            if prof == 0:
                fim = j + 1
                break
    if fim:
        return json.loads(s[i:fim])
    # truncado: fecha o que dá
    return json.loads(s[i:] + "}" * prof)


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


def extrair_com_ia(api_key, model, schema, proc):
    prompt = f"""Abaixo está o texto extraído de um processo do SEI.

Preencha os campos do SIGNU listados. Regras:
- Use exatamente um dos valores possíveis quando o campo tiver lista.
- Se a informação não estiver no texto, use "" (string vazia). NÃO invente.
- PLACA e NIV: só letras e números, maiúsculas, sem traço/espaço.
- ID_PASEI / PA_PJE: copie o número do processo exatamente como aparece.

Alguns documentos vêm como PDF anexado (inclusive escaneados) — leia-os também.

FONTE DOS DADOS DO VEÍCULO (regra do NULEJ):
- Se houver um relatório/consulta **INFOSEG** no processo (texto ou PDF anexo),
  os dados do veículo (NIV/chassi, placa, tipo, marca/modelo) SÃO OS DO INFOSEG
  — use esses, mesmo que outro documento divirja. Em "_alertas", registre
  eventual divergência.
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
    raw, finish = chamar_gemini(api_key, model, SYS, prompt, pdfs=proc.get("pdfs"))
    try:
        data = _extrair_json(raw)
    except Exception as e:
        dbg = Path(__file__).with_name("saida") / f"_gemini_raw_{dt.datetime.now():%Y%m%d_%H%M%S}.txt"
        try:
            dbg.parent.mkdir(exist_ok=True)
            dbg.write_text(f"finishReason={finish}\n\n{raw}", encoding="utf-8")
        except Exception:
            pass
        data = {"campos": {}, "_confianca": 0,
                "_alertas": [f"resposta não-JSON (finish={finish}): {e}. Cru salvo em {dbg.name}"],
                "_campos_incertos": []}
    if finish and finish not in ("STOP", ""):
        data.setdefault("_alertas", []).append(f"Gemini finishReason={finish} (resposta pode ter sido cortada)")

    campos = data.get("campos", {}) or {}
    # rede de segurança: se a IA não pegou o número mas o regex pegou
    for k in ("ID_PASEI", "PA_PJE"):
        if k in schema and not campos.get(k) and proc["numero"]:
            campos[k] = proc["numero"]
    data["campos"] = campos
    return data


# ─────────────────────────────────────────────────────────────────────────────
def processar(page, cfg_sei, api_key, model, lista, args, texto_marcador=""):
    """Extrai texto da página de um processo + IA. Retorna o dict de resultado.
    texto_marcador: anotação que o servidor deixou junto do marcador (via
    'Marcadores do Processo') — CEGOC usa p/ dizer circulação/reciclagem, SEI usa
    p/ dizer o nome do responsável. Essas duas regras são determinísticas, não
    perguntadas pra IA."""
    schema = SCHEMAS[lista]
    proc = extrair_processo(page, cfg_sei, debug=args.debug)
    npdf = len(proc.get("pdfs", []))
    print(f"    processo: {proc['numero'] or '??'} | lista: {lista} | "
          f"docs lidos: {proc['docs_lidos']} | texto: {len(proc['texto'])} chars | PDFs: {npdf}")
    if texto_marcador:
        print(f"    texto do marcador: {texto_marcador!r}")
    if len(proc["texto"]) < 200 and npdf == 0:
        print("    [!] pouco texto e nenhum PDF — seletor de frame errado ou processo vazio.")

    try:
        ia = extrair_com_ia(api_key, model, schema, proc)
    except Exception as e:
        print(f"    [x] IA falhou: {e}")
        ia = {"campos": {}, "_confianca": 0, "_alertas": [f"erro IA: {e}"], "_campos_incertos": []}

    campos = ia.get("campos", {}) or {}
    alertas = list(ia.get("_alertas", []))
    campos.setdefault("RESPONSAVEL", "__AUTO__")  # SIGNU resolve o servidor na ingestão

    infoseg = bool(ia.get("_infoseg"))
    # coerência: sem INFOSEG => NIV não aflorado
    if "NIV_NAO_AFLORADO" in campos and not infoseg:
        campos["NIV_NAO_AFLORADO"] = "TRUE"
        if not campos.get("NIV"):
            campos["NIV"] = "N/A"

    # CEGOC: o servidor escreve CIRCULAÇÃO/RECICLAGEM no texto do marcador — isso
    # decide DESTINACAO e STATUS_DILIGENCIA, não é palpite da IA.
    if lista == "cegoc":
        tm = _norm(texto_marcador)
        if "CIRCUL" in tm:
            campos["DESTINACAO"], campos["STATUS_DILIGENCIA"] = "CIRCULAÇÃO", "LPC"
        elif "RECICL" in tm:
            campos["DESTINACAO"], campos["STATUS_DILIGENCIA"] = "RECICLAGEM", "EM DILIGÊNCIA"
        else:
            alertas.append(f"marcador sem CIRCULAÇÃO/RECICLAGEM no texto ({texto_marcador!r}) "
                            f"— destinação/status ficaram com o palpite da IA, confira.")

    # Caixa SEI: o texto do marcador traz o nome do responsável a quem vincular
    # (processo já cadastrado / resposta de ofício — não é distribuição automática).
    if lista == "sei" and texto_marcador:
        servidor = casar_servidor(texto_marcador)
        if servidor:
            campos["RESPONSAVEL"] = servidor
        else:
            alertas.append(f"não achei servidor correspondente ao texto do marcador ({texto_marcador!r}) "
                            f"— atribua manualmente.")

    conf = ia.get("_confianca", 0)
    print(f"    confiança: {conf}  INFOSEG: {infoseg}  incertos: {ia.get('_campos_incertos')}")
    for a in alertas:
        print(f"      · {a}")

    return {
        "processo": proc["numero"],
        "lista": lista,
        "campos": campos,
        "_infoseg": infoseg,
        "_confianca": conf,
        "_texto_marcador": texto_marcador,
        "_campos_incertos": ia.get("_campos_incertos", []),
        "_alertas": alertas,
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

    cfg = carregar_config(args.config)
    cfg_sei = cfg["sei"]
    mapa_marc = (cfg.get("marcadores") or {}).get("mapa") or MARCADOR_LISTA

    api_key = (
        cfg.get("gemini_api_key") or cfg.get("GEMINI_API_KEY") or cfg.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    ).strip()
    model = cfg.get("gemini_model", "gemini-3.5-flash")
    if not args.dump and not api_key:
        sys.exit("[x] sem chave do Gemini. Cole o valor em \"gemini_api_key\" no config.json\n"
                 "    (ou defina a env GEMINI_API_KEY / GOOGLE_API_KEY).")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("[x] pip install -r requirements.txt  (playwright)")

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
                resultados.append(processar(page, cfg_sei, api_key, model, args.lista.lower(), args))

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
                    texto_marcador = ""
                    if item.get("url_marcador") and item["lista"] in ("cegoc", "sei"):
                        texto_marcador = ler_texto_marcador(work, item["url_marcador"], item["marcador"], debug=args.debug)
                    try:
                        work.goto(item["url"], wait_until="domcontentloaded", timeout=20000)
                    except Exception as e:
                        print(f"    [x] não abriu: {e}")
                        continue
                    work.wait_for_timeout(800)
                    resultados.append(processar(work, cfg_sei, api_key, model, item["lista"], args, texto_marcador=texto_marcador))
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
    cols = ["processo", "lista", "_confianca", "_infoseg", "_texto_marcador"] + todas_chaves + ["_campos_incertos", "_alertas", "fonte_url"]
    with fcsv.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in resultados:
            linha = {"processo": r["processo"], "lista": r["lista"], "_confianca": r["_confianca"],
                     "_infoseg": r.get("_infoseg", ""),
                     "_texto_marcador": r.get("_texto_marcador", ""),
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
