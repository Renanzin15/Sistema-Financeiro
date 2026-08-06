# Meu Orçamento — Sistema Financeiro Pessoal

App pessoal de controle financeiro (orçamento base zero + caixinhas), feito em **FastAPI + SQLite**
no back-end e uma página única **HTML/CSS/JS** (tema escuro, Chart.js) no front. Login por senha
única (bcrypt + JWT).

> ⚠️ **Nunca suba o `financeiro.db`** — ele guarda seus dados financeiros e o hash da senha. O
> `.gitignore` já bloqueia isso.

## Como rodar

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
2. Suba o servidor (na pasta do projeto):
   ```bash
   python -m uvicorn main:app --reload
   ```
3. Abra no navegador: **http://localhost:8000/app**
4. No primeiro acesso, você cria a senha. O banco `financeiro.db` é criado sozinho.

## Funcionalidades

- **Caixinhas** por banco, com metas (valor e prazo) e barra de progresso.
- **Orçamento base zero**: saldo livre × dinheiro guardado; o saldo é sempre calculado dos lançamentos.
- **Dívidas/contas**: simples ou fatura de cartão (soma de itens), pagamento a partir de caixinha,
  arquivamento (sem apagar), aviso de vencimento próximo.
- **Assinaturas recorrentes**, podendo ser cobradas dentro da fatura de um cartão.
- **Regras de salário**: ao registrar uma entrada, guarda automaticamente % ou valor em caixinhas.
- **Rendimento** (CDI etc.) como lançamento próprio, sem inflar as entradas.
- **Análise** do mês, principais gastos, **termômetro** (quando a caixinha zera) e **retrospectiva mensal**.
- **Histórico** filtrável, agrupado por mês.
- **Importar extrato** (OFX/CSV) com sugestão automática de caixinha.
- **Atalhos de teclado** (E = entrada, G = gasto).

## Estrutura

| Arquivo | O que é |
|---------|---------|
| `main.py` | Back-end FastAPI (rotas, banco SQLite, migrações). |
| `index.html` | Front-end completo (uma página só). |
| `requirements.txt` | Dependências Python. |
| `diario_projeto_financeiro.md` | Diário de bordo — decisões e etapas do projeto. |
| `backlog_ideias.md` | Ideias/melhorias mapeadas. |
| `plano_online_gratuito.md` | Plano para colocar online (multiusuário/nuvem). |
| `estudo_ocr_conta_imagem.md` | Estudo de OCR para ler conta por foto. |
| `documentacao_tecnica.md`, `guia_projeto_financeiro.md`, `codigo_comentado.md` | Docs de apoio. |
| `exemplos/` | Extratos de exemplo (OFX/CSV) para testar a importação. |

## Notas de segurança (antes de expor na internet)

Hoje é um app **local, de uso pessoal**. Antes de hospedar publicamente, resolver:
- Tirar a `CHAVE_SECRETA` do código → variável de ambiente (`.env`).
- Limitar tentativas de login (rate limiting).
- Multiusuário + isolamento de dados.

Ver o roteiro completo em `plano_online_gratuito.md`.
