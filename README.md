<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8B5CF6,100:A78BFA&height=190&section=header&text=Meu%20Or%C3%A7amento&fontColor=ffffff&fontSize=50&fontAlignY=38&desc=Sistema%20Financeiro%20SaaS%20%C2%B7%20FastAPI%20%2B%20Supabase&descAlignY=60&descSize=17" width="100%" alt="Meu Orçamento" />

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

</div>

App de **finanças pessoais** (orçamento base zero + caixinhas), **multiusuário privado** e hospedado na nuvem. Back-end em **FastAPI + Postgres (Supabase)**, front em **HTML/CSS/JS** e login por **Supabase Auth** (e-mail/senha). Roda no **Render**; localmente cai para **SQLite** se não houver as variáveis do banco.

> ⚠️ **Segredos nunca vão pro git.** `.env` e `*.local.md` estão no `.gitignore`. Nunca versione `financeiro.db` (dados) nem credenciais.

## ✨ Funcionalidades

- **Multiusuário**: cada pessoa com seus dados isolados (login Supabase).
- **Caixinhas** por banco, com metas (valor + prazo) e barra de progresso.
- **Orçamento base zero**: saldo livre × guardado, tudo calculado dos lançamentos, com **trava de saldo** (não gasta/guarda sem dinheiro).
- **Dívidas / contas**: simples ou fatura de cartão, pagamento a partir de caixinha, arquivamento, aviso de vencimento e **mini-calendário** com pagar direto.
- **Assinaturas recorrentes** (opcionalmente dentro da fatura de um cartão).
- **Entradas automáticas**: renda recorrente (ex.: salário todo dia 5) que lança sozinha e **dispara a distribuição** nas caixinhas.
- **Regras de salário**, **rendimento** (CDI), **análise** do mês, **retrospectiva mensal** e **histórico** filtrável.
- **Importar extrato** (OFX/CSV) com filtro por mês e sugestão de caixinha.
- **Atalhos de teclado** (E = entrada, G = gasto).

## 🧰 Tecnologias

| Camada | Stack |
|--------|-------|
| Back-end | FastAPI · Uvicorn · Pydantic |
| Banco | PostgreSQL (Supabase) · SQLite no modo local |
| Autenticação | Supabase Auth (e-mail/senha) · isolamento por `user_id` |
| Front-end | HTML · CSS · JavaScript |
| Deploy | Render |

## ▶️ Como rodar (local, dev)

```bash
# 1. Instale as dependências
pip install -r requirements.txt

# 2. (Opcional) crie um .env com a conexão do Supabase (Session Pooler) + SUPABASE_URL
#    Sem .env, roda em SQLite — mas o login precisa do SUPABASE_URL.
#    PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD / PGSSLMODE / SUPABASE_URL

# 3. Suba o servidor
python -m uvicorn main:app --reload
# abra http://localhost:8000/
```

Entre com o e-mail/senha de um usuário criado no Supabase (Authentication → Add user).

## ☁️ Deploy (Render)

O Render puxa deste repositório. Basta configurar no painel as variáveis `PG*` + `SUPABASE_URL` (e, opcional, `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_JWT_SECRET`). Para migrar dados de um SQLite para o Supabase: `python migrar_para_supabase.py <SEU_UUID>`. Detalhes em `documentacao_tecnica.md` (§9).

## 🔒 Segurança

Login e **isolamento por `user_id`** em todas as rotas. O back conecta como role `postgres` (ignora RLS), então o isolamento é garantido **no código** (o RLS fica como rede de segurança). Segredos em `.env` / `.local.md` (gitignored). Ver `documentacao_tecnica.md` §3 e §9.

## 📁 Estrutura

| Arquivo | O que é |
|---------|---------|
| `main.py` | Back-end FastAPI (rotas, banco Postgres/SQLite, auth Supabase, regras). |
| `index.html` · `styles.css` · `app.js` | Front-end (estrutura · estilo · lógica). |
| `migrar_para_supabase.py` | Migra um `financeiro.db` (SQLite) pro Supabase carimbando o `user_id`. |
| `documentacao_tecnica.md` | Referência técnica (arquitetura, auth, schema, rotas, deploy). |
| `exemplos/` | Extratos de exemplo (OFX/CSV). |

## 👤 Autor

**Renan Santana** — Desenvolvedor · Python
[Portfólio](https://renanzin15.github.io) · [LinkedIn](https://www.linkedin.com/in/renan-santana-8508622a8/) · [GitHub](https://github.com/Renanzin15)

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:A78BFA,100:8B5CF6&height=110&section=footer" width="100%" alt="footer" />
</div>
