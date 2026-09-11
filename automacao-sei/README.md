# Automação SEI → SIGNU (protótipo v0)

Acha processos no SEI pelos **marcadores** "CADASTRAR SIGNU <lista>", lê o
conteúdo, extrai os campos com o **Google Gemini** e gera um arquivo de
**revisão** (JSON + CSV). **Não grava nada no SIGNU.**

## Por que assim

- Você loga no SEI. O script não guarda senha nem faz login — ele "pega carona"
  na sessão do navegador via CDP (porta de depuração do Chromium/Comet).
- A extração é só leitura no SEI. A saída é um arquivo para conferência humana.
- Ingestão no SIGNU é o **passo 2**, depois que a extração provar que acerta.

## Instalação (uma vez)

```bash
cd automacao-sei
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`playwright install` **não** é necessário: o script conecta no seu navegador, não
baixa um navegador próprio. A extração usa a API REST do Gemini via `urllib`
(biblioteca padrão) — sem SDK.

## Uso

### 1. Abrir o navegador com porta de depuração e logar no SEI

Feche o navegador normal antes (ou use um perfil separado como abaixo):

```bash
open -a "Comet" --args --remote-debugging-port=9222 \
  --user-data-dir="$HOME/comet-sei-debug"
```

(Para Chrome, troque `"Comet"` por `"Google Chrome"`.)

Nessa janela: entre no SEI e faça login. Não precisa abrir os processos —
basta marcá-los com o marcador da lista de destino.

### 2. Chave do Gemini

Cole o valor da sua chave em `gemini_api_key` no `config.json`
(copie de `config.example.json` se ainda não existir). O `config.json` está
no `.gitignore`. Alternativa: env `GEMINI_API_KEY` ou `GOOGLE_API_KEY`.

Modelo em `gemini_model` (padrão `gemini-3.5-flash`; ajuste para um modelo
disponível na sua conta, ex. `gemini-2.5-flash`).

### 3. Marcar os processos no SEI

Aplique em cada processo o marcador da lista de destino:
`CADASTRAR SIGNU CEGOC` · `... DPJ` · `... PCDF 1ª` · `... PCDF 2ª` · `... SEI`.

### 4. Rodar

```bash
python extrair_sei.py                 # varre pelos marcadores
python extrair_sei.py --limite 1 --debug   # testa com 1 processo
python extrair_sei.py --lista pcdf2   # só o marcador de PCDF 2ª
```

Modos:
- `--modo marcador` (padrão) — acha os processos pelos marcadores.
- `--modo abas --lista <x>` — processa as abas de processo já abertas.
- `--dump` / `--dump marcadores` — diagnóstico read-only da estrutura do SEI.

### 5. Conferir a saída

`saida/revisao_<lista>_<timestamp>.csv` — abra no Excel/Sheets. Colunas:
número do processo, lista, `_confianca` (0–1), `_infoseg`, um campo por coluna
do SIGNU, `_campos_incertos`, `_alertas`, link de origem.

`saida/revisao_<lista>_<timestamp>.json` — o mesmo, com um trecho do texto bruto
lido de cada processo (para auditar o que a IA viu).

> A pasta `saida/` está no `.gitignore` — conteúdo de processo é dado sensível.

## Regra INFOSEG

- **Com Relatório INFOSEG no processo** → os dados do veículo (NIV, placa, tipo)
  são os do INFOSEG, mesmo que outro documento divirja (a divergência vira alerta).
- **Sem INFOSEG** → NIV não aflorado: `NIV_NAO_AFLORADO=TRUE`, `NIV="N/A"`, e a
  placa citada no auto/BO vai em `PLACA_OSTENTADA`.

## Como lê os documentos

Percorre a árvore (`ifrArvore`), e para cada documento:
- **SEI nativo (HTML)** → lê o texto direto.
- **PDF anexo (inclusive escaneado)** → baixa o arquivo pela sessão autenticada
  do navegador e manda como anexo para o Gemini, que faz o OCR. Limites em
  `sei.max_pdfs` / `sei.max_pdf_mb`.

## Limitações conhecidas (v0)

- **Seletores do SEI**: frames `ifrArvore` / `ifrConteudoVisualizacao` /
  `ifrVisualizacao` são o padrão do SEI 4.x. Ajuste `sei.*` no `config.json` e
  rode com `--debug` se o seu SEI divergir.
- **Sessão do SEI**: expira sozinha (~30–60 min) e cai se abrir uma URL de
  processo sem assinatura. O script sempre usa a href assinada da listagem.
- **Sem checagem de duplicidade**: conferência manual; dedup automática entra no
  passo 2.
- **DPJ com vários bens no mesmo lote**: o schema `dpj` extrai só o item
  principal/1º bem do processo. A tela de cadastro do SIGNU já suporta vários
  itens por lote (com descrição, quantidade e avaliação individual/total cada
  um) — extrair a lista completa de bens de um único processo é melhoria
  futura, não feita ainda.

## Passo 2 (quando a extração estiver confiável)

1. Endpoint `POST /api/importacao-sei` no SIGNU, fora do middleware, autenticado
   por `x-import-token`, que grava numa aba `Importacao_SEI` (staging).
2. Tela "Importação SEI — a revisar" na Gestão: gestor confere linha a linha e
   promove para a lista real (reaproveitando o fluxo de cadastro + dedup).
3. `extrair_sei.py` ganha `--enviar` para postar o JSON nesse endpoint, e a
   troca automática do marcador verde pelo rosa `REVISAR - CADASTRADO SIGNU`.
