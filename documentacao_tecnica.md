# Documentação Técnica — App de Controle Financeiro Pessoal

> Documento de referência do sistema **como ele é hoje**. Descreve arquitetura, modelo de
> dados, rotas e regras de negócio. Para o histórico das decisões (o "porquê"), ver o
> `diario_projeto_financeiro.md`.

---

## 1. Visão geral

Aplicação web de finanças pessoais (uso individual), baseada no método de **orçamento base
zero + caixinhas (envelopes)**. Roda localmente; acesso via navegador.

**Stack:**
- Back-end: Python + FastAPI
- Banco de dados: SQLite (arquivo `financeiro.db`)
- Front-end: HTML + CSS + JavaScript puro, arquivo único (`index.html`)
- Gráfico: Chart.js (via CDN)
- Autenticação: senha única com hash (bcrypt) + token de sessão JWT (python-jose)

**Arquivos:**
- `main.py` — back-end (API + acesso ao banco)
- `index.html` — front-end completo (servido pela rota `/app`)
- `financeiro.db` — banco de dados SQLite (criado/migrado na inicialização)
- `MeuOrcamento.bat` — atalho que sobe o servidor sem depender do editor

**Dependências (pip):** `fastapi`, `uvicorn`, `bcrypt`, `python-jose[cryptography]`.

**Como executar:** `python -m uvicorn main:app` → acesso em `http://127.0.0.1:8000/app`.
O `.bat` usa `cd /d "%~dp0"` (resolve o acento no caminho) e abre o navegador.

---

## 2. Arquitetura

Aplicação monolítica cliente-servidor rodando na mesma máquina:

```
Navegador (index.html)  ── HTTP/JSON ──>  FastAPI (main.py)  ──>  SQLite (financeiro.db)
     JS (fetch)                             rotas + regras           arquivo local
```

- O front-end faz chamadas `fetch` às rotas da API e monta a tela com o JSON de resposta.
- O back-end concentra as regras de negócio e todo o acesso ao banco.
- Não há framework de front-end; a manipulação de DOM é manual em JS.
- Cada requisição a dados exige um token JWT válido no cabeçalho `Authorization: Bearer <token>`.

**Convenção monetária (importante):** todo dinheiro é armazenado em **centavos (inteiro)**.
A conversão para reais (÷100) acontece só na exibição. O front converte reais→centavos
(×100) antes de enviar. Isso evita erros de arredondamento com números decimais.

---

## 3. Modelo de dados (SQLite)

### Tabela `bancos`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| nome | TEXT | |

### Tabela `caixinhas`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| nome | TEXT | |
| banco_id | INTEGER | adicionada por migração (ALTER TABLE); FK lógica → bancos.id |

> O saldo da caixinha **não é uma coluna** — é calculado (ver regra em §5).

### Tabela `lancamentos`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| tipo | TEXT | `entrada`, `alocacao`, `pagamento`, `saida_livre` |
| valor_centavos | INTEGER | |
| descricao | TEXT | |
| caixinha_id | INTEGER | nulo para entrada e saida_livre; preenchido em alocacao/pagamento |

### Tabela `contas`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| nome | TEXT | |
| valor_centavos | INTEGER | |
| vencimento | TEXT | formato `AAAA-MM-DD` (pode estar vazio em contas antigas) |
| tipo | TEXT | rótulo livre (fixa, cartao, outro) |
| paga | INTEGER | 0 = não paga, 1 = paga (default 0) |
| caixinha_paga_id | INTEGER | caixinha de onde saiu o pagamento |

### Tabela `recorrentes` (moldes de assinatura)
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| nome | TEXT | |
| valor_centavos | INTEGER | |
| dia_vencimento | INTEGER | dia do mês (1–31) |
| tipo | TEXT | |

### Tabela `config` (chave-valor)
| coluna | tipo | notas |
|--------|------|-------|
| chave | TEXT PK | ex.: `senha_hash` |
| valor | TEXT | ex.: hash bcrypt da senha |

### Migração
Função `migrar()` roda na inicialização. Usa `PRAGMA table_info` para checar se a coluna
já existe e só então faz `ALTER TABLE ... ADD COLUMN` — idempotente (não quebra na 2ª
execução) e preserva dados. Hoje cobre a coluna `caixinhas.banco_id`.

---

## 4. Autenticação e segurança

- **Senha única** (app pessoal). Hash com **bcrypt** (`bcrypt.hashpw` / `checkpw`),
  guardado em `config.senha_hash`. Senha em texto nunca é armazenada.
- **Token JWT** (HS256, python-jose). Payload `{"dono": true, "exp": ...}`.
  Validade: `HORAS_VALIDADE_TOKEN = 720` (30 dias). Assinado com `CHAVE_SECRETA`.
- **Proteção de rotas:** dependência `exigir_login` (FastAPI `Depends`) valida o token via
  `HTTPBearer`. Sem token / token inválido / expirado → HTTP 401. Aplicada a **19 rotas de
  dados**; rotas abertas: `/`, `/app`, `/auth/status`, `/auth/definir-senha`, `/auth/login`.

**Notas de segurança conhecidas (dívida técnica):**
- `CHAVE_SECRETA` está hardcoded no `main.py` (valor de exemplo). Trocar por segredo forte
  e idealmente carregar de variável de ambiente antes de qualquer exposição.
- Sem rate limiting (limite de tentativas de senha).
- Sem HTTPS (uso local). Obrigatório antes de expor na internet.
- Sem recuperação de senha (reset manual apagando `config.senha_hash`).
- Modelo é single-user; multiusuário exigiria `usuario_id` em todas as tabelas + filtro por
  usuário em todas as rotas (ver diário).

---

## 5. Regras de negócio (cálculos)

**Fonte única da verdade = os lançamentos.** Saldos nunca são campos guardados; são sempre
somados a partir da tabela `lancamentos`. Isso torna apagar/desfazer seguro (o saldo se
recalcula sozinho).

- **Saldo de uma caixinha** (`saldo_da_caixinha`):
  `SUM(alocacao) − SUM(pagamento)` daquela `caixinha_id`.
- **Saldo livre** (`/saldo-livre`):
  `SUM(entrada) − SUM(alocacao) − SUM(saida_livre)`. `tudo_distribuido = (livre == 0)`.
- **Total a pagar:** soma de `valor_centavos` das contas com `paga = 0`.

**Tipos de lançamento:**
- `entrada` — dinheiro que entra (sem caixinha).
- `alocacao` — guardar em caixinha (aumenta saldo da caixinha).
- `pagamento` — saída de uma caixinha (reduz saldo da caixinha). Usado por "gastar de
  caixinha" e pelo pagamento de conta.
- `saida_livre` — saída de dinheiro não alocado (reduz o saldo livre).

**Transferência entre caixinhas:** cria dois lançamentos — `pagamento` na origem +
`alocacao` no destino (mesmo valor). Protegida contra origem=destino e saldo insuficiente.

**Pagar conta:** confere saldo da caixinha escolhida; cria `pagamento` nela; marca
`paga=1` e grava `caixinha_paga_id`. **Desfazer pagamento:** localiza o lançamento de
pagamento (por caixinha + valor, o mais recente) e o remove; volta `paga=0`.
Fragilidade conhecida: com dois pagamentos idênticos, desfaz o mais recente.

**Recorrentes:** `gerar_recorrentes_do_mes()` roda ao listar contas; para cada molde, gera
a conta do mês atual (`AAAA-MM-DD`) se ainda não existir (checa nome + vencimento). Não
duplica. Apagar o molde não apaga as contas já geradas.

---

## 6. Referência de rotas

> Todas as rotas de dados exigem `Authorization: Bearer <token>`. Valores em `valor_centavos`.

### Autenticação (abertas)
| Método | Rota | Corpo | Retorno |
|--------|------|-------|---------|
| GET | `/auth/status` | — | `{senha_definida: bool}` |
| POST | `/auth/definir-senha` | `{senha}` | `{token}` (só no 1º acesso; senha ≥ 4 chars) |
| POST | `/auth/login` | `{senha}` | `{token}` ou 401 |

### Sistema (abertas)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | raiz |
| GET | `/app` | serve o `index.html` |

### Lançamentos
| Método | Rota | Corpo / Param | Descrição |
|--------|------|---------------|-----------|
| POST | `/lancamentos` | `{tipo, valor_centavos, descricao, caixinha_id}` | cria lançamento |
| GET | `/lancamentos` | — | lista todos |
| DELETE | `/lancamentos/{id}` | id | apaga (saldos recalculam) |

### Saldo
| Método | Rota | Retorno |
|--------|------|---------|
| GET | `/saldo-livre` | entradas, alocado, saidas_livres, saldo_livre, tudo_distribuido |

### Caixinhas
| Método | Rota | Corpo / Param | Descrição |
|--------|------|---------------|-----------|
| POST | `/caixinhas` | `{nome, banco_id}` | cria (banco obrigatório) |
| GET | `/caixinhas` | — | lista com saldo e banco_id |
| POST | `/caixinhas/{id}/mover` | `{banco_id}` | move para outro banco |
| DELETE | `/caixinhas/{id}` | id | apaga (só se saldo zero) |

### Transferência
| Método | Rota | Corpo | Descrição |
|--------|------|-------|-----------|
| POST | `/transferir` | `{origem_id, destino_id, valor_centavos}` | pagamento+alocacao |

### Contas
| Método | Rota | Corpo / Param | Descrição |
|--------|------|---------------|-----------|
| POST | `/contas` | `{nome, valor_centavos, vencimento, tipo}` | cria conta |
| DELETE | `/contas/{id}` | id | apaga conta (só se `paga=0`) |
| PUT | `/contas/{id}` | `{nome, valor_centavos, vencimento, tipo}` | edita conta (só se `paga=0`) |
| GET | `/contas` | — | lista (dispara geração de recorrentes do mês) |
| POST | `/contas/{id}/pagar` | `{caixinha_id}` | paga puxando da caixinha |
| POST | `/contas/{id}/desfazer-pagamento` | id | reverte o pagamento |

### Recorrentes
| Método | Rota | Corpo / Param | Descrição |
|--------|------|---------------|-----------|
| POST | `/recorrentes` | `{nome, valor_centavos, dia_vencimento, tipo}` | cria molde |
| GET | `/recorrentes` | — | lista moldes |
| DELETE | `/recorrentes/{id}` | id | apaga molde (contas geradas ficam) |

### Bancos
| Método | Rota | Corpo / Param | Descrição |
|--------|------|---------------|-----------|
| POST | `/bancos` | `{nome}` | cria banco |
| GET | `/bancos` | — | lista bancos |
| DELETE | `/bancos/{id}` | id | apaga (só se não tiver caixinhas) |

---

## 7. Front-end (`index.html`)

- Arquivo único: HTML + CSS (tema escuro, variáveis CSS com destaque roxo/violeta) + JS.
- **Tela de login** sobreposta (z-index alto): detecta 1º acesso via `/auth/status`
  (criar senha) vs. acesso normal (entrar). Guarda o token em variável JS (`TOKEN`) e o
  envia em toda chamada via wrapper `pedir()`.
- **Navegação por telas** (menu lateral): Visão geral, Caixinhas, Dívidas, Histórico,
  e botão Sair. Troca de tela via classe `.ativa` (sem recarregar página).
- **Seletor de banco** no topo: filtra caixinhas e a pizza pelo banco selecionado
  (`bancoSelecionado`). Escopo atual: só caixinhas são por banco (Opção 1).
- **Dashboard:** cards de resumo (saldo livre, entradas, guardado, contas a pagar) +
  pizza de distribuição das caixinhas (Chart.js/doughnut).
- **Dívidas:** tabela com status colorido calculado por data de vencimento no JS
  (`statusConta`): Pago / Vencido / Hoje / contagem ≤5 dias / A vencer.
- Conversão reais→centavos (`paraCentavos`) e formatação `reais()` no cliente.

> Dependência de internet: Chart.js vem de CDN — a pizza precisa de rede. O restante do
> app funciona offline.

---

## 8. Limitações e dívidas técnicas conhecidas

- **Single-user**; sem isolamento por usuário.
- **Segurança para exposição:** faltam HTTPS, rate limiting, segredo fora do código.
- **Lançamentos sem data:** a tabela `lancamentos` não guarda data/hora — impede
  agrupar histórico por período e análises temporais até que a coluna seja adicionada.
- **Entrada sem banco:** entradas e saldo livre são gerais (não por banco) — decisão
  consciente (Opção 1).
- **Desfazer pagamento:** heurística por caixinha+valor (ver §5).
- **Contas antigas sem vencimento:** aparecem como "A vencer" (status não calculável).
- **CHAVE_SECRETA** de exemplo no código.

---

## 9. Roadmap técnico (planejado — ver diário para detalhes)

- ~~**A** Apagar dívida~~ — CONCLUÍDO (`DELETE /contas/{id}`, só não-paga).
- ~~**B** Editar dívida~~ — CONCLUÍDO (`PUT /contas/{id}`, só não-paga).
- ~~**C** Visão geral de todos os bancos~~ — CONCLUÍDO (opção "Todos" no seletor).
- ~~**D** Contas tipo "fatura" (cartão)~~ — CONCLUÍDO (16/07/2026). `contas.tipo_conta`
  ('simples'/'fatura') + tabela `fatura_itens` (1:N); total da fatura = soma dos itens;
  rotas de item; fatura expansível no front; paga inteira. Virada automática de mês NÃO feita
  (faturas criadas por mês manualmente) — refinamento futuro.
- ~~**F** Histórico melhorado~~ — CONCLUÍDO (16/07/2026). F1 coluna `data` em lancamentos
  (migração) → F2 visual (agrupar por dia, ícones, cores) → F3 filtros (Tudo/Entradas/Saídas/
  Caixinhas) + busca → F4 tela de Análise (totais do mês, % gasto, para onde foi o dinheiro).
- ~~**E** Padronização de ícones~~ — CONCLUÍDO (16/07/2026). Ícones SVG EMBUTIDOS (não CDN,
  funciona offline): menu, badges do histórico, botões editar/apagar padronizados em todo o app.

**Nova dívida técnica (D):** tabela `fatura_itens` sem índice em `conta_id` (irrelevante no
volume pessoal). `desfazer_pagamento` de fatura casa o lançamento por caixinha+valor(total);
os itens ficam congelados enquanto paga, então o total não muda — seguro no uso normal.

**Estudo futuro (não no app atual):** multiusuário (`usuario_id` em todas as tabelas +
filtro por usuário em todas as rotas), PostgreSQL na nuvem, hospedagem (Coolify/VPS ou
serviço gerenciado), 2FA, LGPD, backup automático.
