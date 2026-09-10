# Automação SEI → SIGNU (protótipo v0)

Lê processos do SEI **abertos no seu navegador** (já logado), extrai os campos com
o Claude e gera um arquivo de **revisão** (JSON + CSV). **Não grava nada no SIGNU.**

## Por que assim

- Você loga no SEI. O script não guarda senha nem faz login — ele "pega carona"
  na sessão do navegador via CDP (porta de depuração do Chrome).
- A extração é só leitura no SEI. A saída é um arquivo para conferência humana.
- Ingestão no SIGNU é o **passo 2**, depois que a extração provar que acerta.

## Instalação (uma vez)

```bash
cd automacao-sei
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`playwright install` **não** é necessário: o script conecta no seu Chrome, não
baixa um navegador próprio.

## Uso

### 1. Abrir o Chrome com porta de depuração e logar no SEI

Feche o Chrome normal antes (ou use um perfil separado como abaixo):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/chrome-sei-debug"
```

Nesse Chrome: entre no SEI, faça login, e **abra em abas** os processos que quer
processar (um processo por aba, na tela de visualização do processo).

### 2. Chave da API

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Rodar

```bash
python extrair_sei.py --lista pcdf2
```

Listas: `cegoc` · `pcdf1` · `pcdf2` · `dpj` · `doacoes` · `sei`

Opções:
- `--limite 3` — processa só as 3 primeiras abas do SEI (bom para testar)
- `--debug` — imprime estrutura de frames / nós da árvore
- `--config config.json` — usa um config próprio (copie de `config.example.json`)

### 4. Conferir a saída

`saida/revisao_<lista>_<timestamp>.csv` — abra no Excel/Sheets. Colunas:
número do processo, `_confianca` (0–1), um campo por coluna do SIGNU,
`_campos_incertos`, `_alertas`, link da aba de origem.

`saida/revisao_<lista>_<timestamp>.json` — o mesmo, com um trecho do texto bruto
lido de cada processo (para auditar o que a IA viu).

> A pasta `saida/` está no `.gitignore` — conteúdo de processo é dado sensível.

## Limitações conhecidas (v0)

- **PDF escaneado**: o script lê texto de HTML e de PDF com camada de texto. Se o
  documento for imagem pura, sai pouco/nada — vai precisar de OCR (passo futuro).
- **Seletores do SEI**: os nomes de frame (`ifrArvore` / `ifrVisualizacao`) são o
  padrão do SEI 4.x. Se o seu SEI for diferente, ajuste `sei.*` no `config.json` e
  rode com `--debug`.
- **Seleção por checkbox**: v0 processa as abas que você abriu. Ler os processos
  "marcados" numa listagem é um incremento fácil depois de acertar a extração.
- **Sem checagem de duplicidade**: a conferência é manual. A dedup automática entra
  junto com a ingestão (passo 2), que vai precisar de um endpoint dedicado no
  SIGNU protegido por token (a API atual exige sessão de gestor).

## Passo 2 (quando a extração estiver confiável)

1. Endpoint `POST /api/importacao-sei` no SIGNU, fora do middleware, autenticado
   por `x-import-token`, que grava numa aba `Importacao_SEI` (staging).
2. Tela "Importação SEI — a revisar" na Gestão: gestor confere linha a linha e
   promove para a lista real (reaproveitando o fluxo de cadastro + dedup).
3. `extrair_sei.py` ganha `--enviar` para postar o JSON nesse endpoint.
