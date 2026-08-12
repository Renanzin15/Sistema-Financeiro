# Meu Orçamento — Sistema Financeiro (SaaS multi-usuário)

App de finanças pessoais (orçamento base zero + caixinhas), **multi-usuário privado**, hospedado na nuvem.
Back-end **FastAPI + Postgres (Supabase)**; front **HTML/CSS/JS** (`index.html` + `styles.css` + `app.js`);
login por **Supabase Auth** (e-mail/senha). Roda no **Render**. Localmente cai pra **SQLite** se não houver
as variáveis do banco.

> ⚠️ **Segredos nunca vão pro git.** `.env` e `*.local.md` estão no `.gitignore`. Nunca versione
> `financeiro.db` (dados) nem credenciais.

## Como rodar (local, dev)

1. `pip install -r requirements.txt`
2. Crie um `.env` na pasta do projeto com a conexão do Supabase (Session Pooler) + `SUPABASE_URL`
   (sem `.env` roda em SQLite, mas o **login precisa** do `SUPABASE_URL`). Ex.:
   ```
   PGHOST=aws-0-sa-east-1.pooler.supabase.com
   PGPORT=5432
   PGDATABASE=postgres
   PGUSER=postgres.<ref>
   PGPASSWORD='...'
   PGSSLMODE=require
   SUPABASE_URL=https://<ref>.supabase.co
   ```
3. `python -m uvicorn main:app --reload` → abra **http://localhost:8000/**
4. Entre com o e-mail/senha de um usuário criado no Supabase (Authentication → Add user).

## Deploy (Render)
O Render puxa deste repositório. Setar no painel as env vars `PG*` + `SUPABASE_URL` (e opcional
`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_JWT_SECRET`). Migrar os dados de um SQLite com
`python migrar_para_supabase.py <SEU_UUID>`. Ver detalhes em `documentacao_tecnica.md` (§9).

## Funcionalidades

- **Multi-usuário**: cada pessoa com seus dados isolados (login Supabase; cadastro manual).
- **Caixinhas** por banco, com metas (valor + prazo) e barra de progresso.
- **Orçamento base zero**: saldo livre × guardado (soma dos saldos atuais das caixinhas); tudo calculado dos lançamentos. **Trava de saldo** (não gasta/guarda sem dinheiro).
- **Dívidas/contas**: simples ou fatura de cartão, pagamento a partir de caixinha, arquivamento, aviso de vencimento; **mini-calendário** de vencimentos com pagar direto.
- **Assinaturas recorrentes** (opcionalmente dentro da fatura de um cartão).
- **Entradas automáticas**: renda recorrente (ex.: salário todo dia 5) que lança sozinha e **dispara a distribuição** nas caixinhas.
- **Regras de salário**, **rendimento** (CDI), **Análise** do mês, **retrospectiva mensal**, **histórico** filtrável.
- **Importar extrato** (OFX/CSV) com **filtro por mês** e sugestão de caixinha.
- **Atalhos** (E = entrada, G = gasto).

## Estrutura

| Arquivo | O que é |
|---------|---------|
| `main.py` | Back-end FastAPI (rotas, banco Postgres/SQLite, auth Supabase, regras). |
| `index.html` · `styles.css` · `app.js` | Front-end (estrutura · estilo+fonte · lógica). |
| `requirements.txt` | Dependências Python. |
| `migrar_para_supabase.py` | Migra um `financeiro.db` (SQLite) pro Supabase carimbando o `user_id`. |
| `documentacao_tecnica.md` | Referência técnica (arquitetura, auth, schema, rotas, deploy). |
| `diario_projeto_financeiro.md` | Diário — decisões e etapas. |
| `guia_projeto_financeiro.md` · `codigo_comentado.md` | Docs de apoio. |
| `backlog_ideias.md` · `plano_online_gratuito.md` · `estudo_ocr_conta_imagem.md` | Ideias / plano / estudo OCR. |
| `exemplos/` | Extratos de exemplo (OFX/CSV). |

## Segurança
Login e isolamento por `user_id` em todas as rotas. O back conecta como role `postgres` (ignora RLS),
então **o isolamento é no código** (o RLS fica como rede de segurança). Segredos em `.env`/`.local.md`
gitignored. Ver `documentacao_tecnica.md` §3 e §9.
