# Backup / Handoff — Sistema Financeiro (continuar em outra conta)

> Gerado em 06/08/2026. Este pacote reúne **tudo** do projeto "Meu Orçamento" (Sistema Financeiro)
> do Renan, pra continuar o trabalho numa conta/sessão nova do Claude sem perder contexto.

## O que é o projeto
App pessoal de finanças (orçamento base zero + caixinhas). Stack: **FastAPI + SQLite** (`main.py`) +
**HTML/CSS/JS** numa página só (`index.html`). Login por senha única (bcrypt + JWT). Dinheiro sempre
em centavos (inteiro). Saldo é sempre calculado dos lançamentos (nunca guardado).

## Onde o código vive (JÁ SEGURO, independe da conta Claude)
- **GitHub (privado):** https://github.com/Renanzin15/Sistema-Financeiro
  - Na conta nova, é só continuar usando esse repo (é a conta GitHub do Renan, não muda).
  - Fluxo de trabalho combinado: **toda mudança → documentar no Obsidian → `git add`/`commit`/`push`.**
- **Vault Obsidian (esta máquina):** `C:\Claude\Claude\Pessoal\Sistema Financeiro\`
- **Projeto roda na outra máquina do Renan:** `D:\PROGRAMAÇÃO\Financeiro`

## ⚠️ IMPORTANTE — o que NÃO está neste backup nem no GitHub
- O arquivo **`financeiro.db`** (seus dados financeiros reais + hash da senha) fica só na sua máquina
  `D:\PROGRAMAÇÃO\Financeiro`. Ele é bloqueado no `.gitignore` de propósito. **Faça backup dele à parte**
  (copie o `financeiro.db` pra um pen drive / nuvem sua). Sem ele, você perde os lançamentos já feitos.

## Conteúdo deste pacote
- `Sistema Financeiro/` — a pasta completa do projeto:
  - `main.py`, `index.html` — o app (versão atual, testada).
  - `README.md`, `requirements.txt`, `.gitignore`.
  - `documentacao_tecnica.md` — referência técnica atual (dados, rotas, regras).
  - `guia_projeto_financeiro.md` — manual do usuário das telas.
  - `codigo_comentado.md` — código explicado (blocos principais).
  - `diario_projeto_financeiro.md` — diário de bordo (todas as etapas e decisões).
  - `backlog_ideias.md` — ideias/melhorias mapeadas + status.
  - `plano_online_gratuito.md` — roteiro pra colocar online (multiusuário/nuvem).
  - `estudo_ocr_conta_imagem.md` — estudo de OCR (ler conta por foto).
  - `exemplos/` — extratos OFX/CSV de teste do importador.
  - `backups/` — versões antigas v0–v9.
- `memoria_claude/` — as memórias que o Claude acumulou (contexto, preferências, fluxo). Na conta nova,
  peça ao Claude pra ler esses arquivos e recriar as memórias equivalentes.

## Como retomar numa conta/sessão nova
1. Instale as libs: `pip install -r requirements.txt` (fastapi, uvicorn, bcrypt, python-jose, pydantic).
2. Rode: `python -m uvicorn main:app` → abra `http://localhost:8000/app`.
3. Restaure seu `financeiro.db` (backup à parte) na pasta do projeto.
4. Diga ao novo Claude: "leia `memoria_claude/` e o `diario_projeto_financeiro.md` pra pegar o contexto".

## Ambiente de teste (como o Claude testava aqui)
Python 3.12 em `C:\Users\Renan Santana\AppData\Local\Programs\Python\Python312\python.exe`. Testes:
copiar `main.py`+`index.html` pra pasta isolada, subir `uvicorn` numa porta, exercitar via HTTP e navegador.

## Estado atual (o que está feito) — resumo
- Concluído: A/B/C, D (fatura), E (ícones), F1–F4 (histórico/análise), Etapas 17–19, e a **Etapa 20**:
  M1 arquivar contas, M2 rendimento, M4 aviso 7 dias, E1 termômetro, E2 assinatura na fatura,
  E3 importar OFX/CSV, E4 regras de salário, E5 streaks, E6 retrospectiva, E8 metas com prazo,
  E9 atalhos de teclado. + Etapa 20.1: validações de entrada (valor>0, datas válidas).
- **Pendente / próximos:** OCR de conta por imagem (Fase 1 — ver `estudo_ocr_conta_imagem.md`);
  fase online (multiusuário, segurança, Supabase, hospedagem, Web Push) — ver `plano_online_gratuito.md`.
