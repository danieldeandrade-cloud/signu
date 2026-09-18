# Dashboard SIGNU (Google Apps Script)

Script vinculado à própria planilha **SIGNU_DB** — lê os dados direto de lá
(sem precisar de chave/token, já que roda dentro do Google), então não tem
o mesmo bloqueio da automação do SEI (que depende de navegador logado).

## O que faz

Gera/atualiza uma aba **"Dashboard_Produtividade"** com:

- **Produtividade por servidor** — quantas ações (criar, editar, transição,
  promover, registrar TEP, concluir no SEI) cada um fez nos últimos 7 e 30
  dias, lendo a aba `Historico_Alteracoes` (existe desde 2026-09-18 — só
  mostra dados a partir dessa data pra frente, não retroativo).
- **Fila atual por lista e status** — quantos itens tem em cada status, por
  lista (CEGOC, DPJ, PCDF 1ª/2ª, Doações, Caixa SEI).

## Instalação (uma vez)

1. Abra a planilha SIGNU_DB no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo padrão (`Código.gs`) e cole o conteúdo de
   [`Codigo.gs`](Codigo.gs) inteiro.
4. Salve (ícone de disquete ou `Ctrl+S`).
5. Volte pra aba da planilha e recarregue a página (F5).
6. Aparece um novo menu **"📊 Relatórios SIGNU"** na barra de menus, ao lado
   de Arquivo/Editar/etc.

## Uso

- **"Atualizar dashboard agora"** — roda na hora, sob demanda.
- **"Ativar atualização automática (seg. 7h)"** — cria um gatilho (trigger)
  que roda sozinho toda segunda-feira às 7h, sem precisar abrir a planilha.
  Na primeira vez que rodar, o Google vai pedir autorização (é normal —
  o script só acessa esta planilha, nada externo).
- **"Desativar atualização automática"** — remove o gatilho.

## Limitação conhecida

A produtividade só reflete o que aconteceu **depois** de 2026-09-18 (data em
que o app do SIGNU passou a gravar `Historico_Alteracoes`). Não dá pra saber
retroativamente quem fez o quê antes disso.
