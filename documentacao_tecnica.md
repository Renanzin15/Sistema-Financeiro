# Documentação Técnica — App de Controle Financeiro Pessoal

> Documento de referência do sistema **como ele é hoje** (atualizado em 06/08/2026, após a
> Etapa 20). Descreve arquitetura, modelo de dados, rotas e regras de negócio. Para o histórico
> das decisões (o "porquê"), ver o `diario_projeto_financeiro.md`.

---

## 1. Visão geral

Aplicação web de finanças pessoais (uso individual), baseada no método de **orçamento base
zero + caixinhas (envelopes)**. Roda localmente; acesso via navegador.

**Stack:**
- Back-end: Python + FastAPI
- Banco de dados: SQLite (arquivo `financeiro.db`)
- Front-end: HTML + CSS + JavaScript puro, arquivo único (`index.html`)
- Gráfico: Chart.js (via CDN)
- Ícones: SVG **embutidos** no próprio HTML (offline, sem CDN)
- Autenticação: senha única com hash (bcrypt) + token de sessão JWT (python-jose)
- OCR (opcional, só se usar o leitor de conta por imagem — ainda não implementado): Tesseract + pytesseract + Pillow

**Arquivos:**
- `main.py` — back-end (API + acesso ao banco) — ~1318 linhas
- `index.html` — front-end completo (servido pela rota `/app`) — ~1934 linhas
- `financeiro.db` — banco SQLite (criado/migrado na inicialização; **nunca versionar**)
- `requirements.txt` — dependências pip

**Dependências (pip):** `fastapi`, `uvicorn[standard]`, `bcrypt`, `python-jose[cryptography]`, `pydantic`.

**Como executar:** `python -m uvicorn main:app` → acesso em `http://127.0.0.1:8000/app`.

---

## 2. Arquitetura

Aplicação monolítica cliente-servidor rodando na mesma máquina:

```
Navegador (index.html)  ── HTTP/JSON ──>  FastAPI (main.py)  ──>  SQLite (financeiro.db)
     JS (fetch)                             rotas + regras           arquivo local
```

- O front faz chamadas `fetch` às rotas e monta a tela com o JSON. Sem framework de front.
- O back concentra as regras de negócio e todo o acesso ao banco.
- Cada requisição a dados exige token JWT no cabeçalho `Authorization: Bearer <token>`.
- `/app` responde com header `Cache-Control: no-store` (evita o navegador travar versão antiga).

**Convenção monetária (importante):** todo dinheiro é armazenado em **centavos (inteiro)**.
Conversão para reais (÷100) só na exibição; o front converte reais→centavos (×100) antes de enviar.

---

## 3. Modelo de dados (SQLite)

### `bancos`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| nome | TEXT | |

### `caixinhas`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| nome | TEXT | |
| banco_id | INTEGER | FK lógica → bancos.id (migração) |
| meta_centavos | INTEGER | meta opcional (0 = sem meta) (migração) |
| meta_prazo | TEXT | **E8**: data-limite da meta `AAAA-MM-DD` ou NULL (migração) |

> Saldo da caixinha **não é coluna** — é calculado (§5).

### `lancamentos`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| tipo | TEXT | `entrada`, `alocacao`, `pagamento`, `saida_livre`, **`rendimento`** |
| valor_centavos | INTEGER | |
| descricao | TEXT | |
| caixinha_id | INTEGER | nulo em entrada/saida_livre; preenchido em alocacao/pagamento/rendimento |
| data | TEXT | `AAAA-MM-DD` (migração F1; nulos = registros antigos) |

### `contas`
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| nome | TEXT | |
| valor_centavos | INTEGER | em fatura nasce 0 (total vem dos itens) |
| vencimento | TEXT | `AAAA-MM-DD` |
| tipo | TEXT | rótulo/categoria (texto livre; ver tabela `categorias`) |
| paga | INTEGER | 0/1 |
| caixinha_paga_id | INTEGER | de qual caixinha saiu o pagamento |
| tipo_conta | TEXT | `simples` ou `fatura` (migração D) |
| arquivada | INTEGER | **M1**: 0/1 — arquivada some da tela mas fica no banco (migração) |

### `recorrentes` (moldes de assinatura)
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| nome, valor_centavos, dia_vencimento, tipo | | |
| conta_fatura_id | INTEGER | **E2**: FK → contas.id (fatura de cartão) ou NULL = avulsa (migração) |

### `fatura_itens` (itens de uma conta tipo fatura)
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| conta_id | INTEGER | FK lógica → contas.id |
| descricao, valor_centavos, data | | |

### `categorias` (rótulos de conta/assinatura)
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| nome | TEXT | semeada 1x com "Conta fixa", "Cartão", "Outros" |

### `regras_salario` (**E4**)
| coluna | tipo | notas |
|--------|------|-------|
| id | INTEGER PK | |
| gatilho | TEXT | nome da entrada que dispara (match case-insensitive exato) |
| modo | TEXT | `percentual` (valor = % inteiro) ou `fixo` (valor = centavos) |
| valor | INTEGER | |
| caixinha_id | INTEGER | destino da alocação automática |

### `config` (chave-valor)
Chaves usadas: `senha_hash`, `categorias_iniciadas`, `wrapped_visto_ate` (**E6**).

### Migração
`migrar()` roda na inicialização; usa `PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN` só se a
coluna faltar — **idempotente** e preserva dados. Colunas cobertas: `caixinhas.banco_id`,
`caixinhas.meta_centavos`, `caixinhas.meta_prazo`, `lancamentos.data`, `contas.tipo_conta`,
`contas.arquivada`, `recorrentes.conta_fatura_id`. Tabelas novas nascem via `CREATE TABLE IF NOT EXISTS`.

---

## 4. Autenticação e segurança

- **Senha única** (app pessoal), hash **bcrypt** em `config.senha_hash`. Texto nunca é guardado.
- **Token JWT** (HS256, python-jose), payload `{"dono": true, "exp": ...}`, validade 720h (30 dias),
  assinado com `CHAVE_SECRETA`.
- **Proteção de rotas:** dependência `exigir_login` (FastAPI `Depends` + `HTTPBearer`). Sem/ inválido/
  expirado → 401. Abertas só: `/`, `/app`, `/auth/status`, `/auth/definir-senha`, `/auth/login`.

**Dívida técnica de segurança (resolver ANTES de expor na internet — ver `plano_online_gratuito.md`):**
`CHAVE_SECRETA` hardcoded, sem rate limiting, sem HTTPS, sem multiusuário, front usa muito `innerHTML`
(risco XSS quando multiusuário).

---

## 5. Regras de negócio (cálculos)

**Fonte única da verdade = os lançamentos.** Saldos nunca são guardados; são somados de `lancamentos`.

- **Saldo de caixinha** (`saldo_da_caixinha`): `SUM(alocacao + rendimento) − SUM(pagamento)`.
- **Saldo livre** (`/saldo-livre`): `SUM(entrada) − SUM(alocacao) − SUM(saida_livre)`.
  (Rendimento **não** entra aqui — não vem de entrada nem reduz o livre.)
- **Total a pagar:** soma das contas não arquivadas com `paga=0`.

**Tipos de lançamento:**
- `entrada` — dinheiro de fora (sem caixinha). **Dispara as regras de salário (E4).**
- `alocacao` — guardar em caixinha.
- `pagamento` — saída de uma caixinha (gastar de caixinha / pagar conta / saída de transferência).
- `saida_livre` — saída do dinheiro não alocado.
- `rendimento` (**M2**) — juros/CDI: entra na caixinha como dinheiro novo; **não** conta como entrada
  nem mexe no saldo livre.

**Regras de salário (E4):** ao criar uma `entrada`, `aplicar_regras_salario` procura regras cujo
`gatilho` == descrição (case-insensitive) e cria `alocacao` automática (% do valor ou fixo) na caixinha.

**Transferência:** dois lançamentos — `pagamento` na origem + `alocacao` no destino. Protegida contra
origem=destino, valor≤0 e saldo insuficiente.

**Pagar conta:** confere saldo; cria `pagamento`; marca `paga=1` + `caixinha_paga_id`.
Fatura: valor = soma dos `fatura_itens`. **Desfazer:** remove o lançamento (por caixinha+valor, o mais recente).

**Arquivar conta (M1):** `UPDATE arquivada=1` (só pagas). Some da lista principal, fica no banco.
`arquivar-antigas` arquiva de uma vez as pagas de meses anteriores.

**Recorrentes (`gerar_recorrentes_do_mes`, roda no GET /contas):** para cada molde —
se `conta_fatura_id` aponta pra uma fatura válida (**E2**), entra como **item da fatura** do mês
(dedup por nome+mês, respeita fatura paga) e **não** cria conta avulsa; senão, cria a conta avulsa do
mês (dedup por nome+vencimento). Ao vincular à fatura, a conta avulsa não-paga do mês é removida.

---

## 6. Referência de rotas

> Todas as de dados exigem `Authorization: Bearer <token>`. Valores em `valor_centavos`.

**Auth (abertas):** `GET /auth/status` · `POST /auth/definir-senha {senha}` · `POST /auth/login {senha}`
**Sistema (abertas):** `GET /` · `GET /app`

**Lançamentos:** `POST /lancamentos {tipo,valor_centavos,descricao,caixinha_id,data?}` ·
`GET /lancamentos` · `DELETE /lancamentos/{id}`
**Saldo:** `GET /saldo-livre`

**Caixinhas:** `POST /caixinhas {nome,banco_id,meta_centavos?}` · `GET /caixinhas` ·
`POST /caixinhas/{id}/meta {meta_centavos,meta_prazo?}` · `POST /caixinhas/{id}/mover {banco_id}` ·
`DELETE /caixinhas/{id}`
**Transferência:** `POST /transferir {origem_id,destino_id,valor_centavos}`

**Contas:** `POST /contas {nome,valor_centavos,vencimento,tipo,tipo_conta?}` · `GET /contas` ·
`PUT /contas/{id}` · `DELETE /contas/{id}` · `POST /contas/{id}/pagar {caixinha_id}` ·
`POST /contas/{id}/desfazer-pagamento` ·
**(M1)** `GET /contas/arquivadas` · `POST /contas/{id}/arquivar` · `POST /contas/{id}/desarquivar` ·
`POST /contas/arquivar-antigas`
**Fatura (itens):** `GET /contas/{id}/itens` · `POST /contas/{id}/itens {descricao,valor_centavos}` ·
`DELETE /contas/{id}/itens/{item_id}`

**Recorrentes:** `POST /recorrentes {...,conta_fatura_id?}` · `GET /recorrentes` ·
`DELETE /recorrentes/{id}` · **(E2)** `POST /recorrentes/{id}/fatura {conta_fatura_id}`
**Bancos:** `POST /bancos {nome}` · `GET /bancos` · `DELETE /bancos/{id}`
**Categorias:** `GET /categorias` · `POST /categorias {nome}` · `DELETE /categorias/{id}`
**Regras (E4):** `GET /regras` · `POST /regras {gatilho,modo,valor,caixinha_id}` · `DELETE /regras/{id}`
**Retrospectiva (E6):** `GET /wrapped-status` · `POST /wrapped-visto {mes}`
**Importar extrato (E3):** `POST /importar/analisar {conteudo,tipo_arquivo}` (devolve prévia, não grava) ·
`POST /importar/confirmar {linhas:[...]}` (grava o que o usuário confirmou)

---

## 7. Front-end (`index.html`)

- Arquivo único: HTML + CSS (tema escuro roxo) + JS. Ícones **SVG embutidos** (dict `ICONES` + `ico()`).
- **Login** sobreposto (1º acesso cria senha; depois entra). Token em `TOKEN`, enviado por `pedir()`.
- **8 telas** no menu lateral: Visão geral, Caixinhas, Dívidas, Histórico, Análise, Categorias,
  **Regras**, **Importar** (+ Sair). Troca por classe `.ativa`.
- **Atalhos (E9):** `E` = entrada, `G` = gasto, `Esc` = tira foco, `Enter` = salva.
- **Dashboard:** cards de resumo + pizza (Chart.js) + badge de **streak (E5)**.
- **Caixinhas:** lista com metas (barra + prazo E8), formulários (guardar, **rendimento M2**,
  transferir, gastar, tirar do livre) e **Termômetro/Runway (E1)**.
- **Dívidas:** tabela com status por vencimento (`statusConta`: Pago/Vencido/Vence hoje/Faltam X dias≤7/
  A vencer), fatura expansível, **arquivar (M1)**; assinaturas com vínculo de fatura (E2).
- **Histórico:** agrupado por mês (com resumo) e por dia; filtros + busca.
- **Análise:** totais do mês, principais gastos, para onde foi o dinheiro, e botão **retrospectiva (E6)**.
- **Categorias / Regras / Importar:** telas de gerenciamento.
- **Modal de retrospectiva (E6):** overlay mostrado 1x/sessão ao entrar em mês novo, ou manual.

> Chart.js vem de CDN — a pizza precisa de rede; o resto funciona offline.

---

## 8. Limitações e dívidas técnicas conhecidas

- **Single-user**; sem isolamento por usuário.
- **Segurança p/ exposição:** HTTPS, rate limiting, segredo fora do código, sanitização (XSS).
- **Desfazer pagamento:** heurística por caixinha+valor.
- **Importar CSV:** vírgula servindo de separador E decimal é ambíguo → orientar OFX ou CSV `;`.
- **OCR/PDF:** não implementado (estudo em `estudo_ocr_conta_imagem.md`).
- **Virada automática de fatura por mês:** não feita (faturas geridas manualmente).

---

## 9. Roadmap (resumo — detalhes no diário e no `backlog_ideias.md`)

**Concluído:** A/B/C (apagar/editar dívida, visão todos os bancos), D (fatura de cartão), E (ícones SVG),
F1–F4 (data, histórico visual, filtros, Análise), Etapas 17–19 (data do lançamento, histórico por mês,
metas, categorias, principais gastos), **Etapa 20** (M1 arquivar, M2 rendimento, M4 aviso 7 dias,
E1 termômetro, E2 assinatura na fatura, E3 importar OFX/CSV, E4 regras de salário, E5 streaks,
E6 retrospectiva, E8 metas com prazo, E9 atalhos).

**Pendente:** OCR de conta por imagem (Fase 1); E7 Web Push, Cold Start e **fase online** (multiusuário,
segurança, Supabase/Postgres, hospedagem) — ver `plano_online_gratuito.md`.
