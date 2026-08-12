# Código comentado — `main.py` (estado atual)

> ⚠️ **Atualização (fase SaaS, 10/08/2026):** este passo-a-passo foi escrito na fase SQLite single-user.
> Desde então o `main.py` mudou muito: **banco Postgres/Supabase** (com wrapper `_ConexaoPG` que traduz
> `?`→`%s`, e fallback SQLite), **autenticação Supabase Auth** (`_verificar_token` valida ES256 via JWKS,
> HS256 reserva; `exigir_login` devolve o `user_id`), **isolamento por `user_id`** em toda query,
> `config` por usuário, e a tabela nova `entradas_recorrentes`. Os padrões de cada bloco continuam válidos,
> mas para a arquitetura/rotas/schema **atuais** a referência é o `documentacao_tecnica.md`; o "porquê" das
> mudanças está no `diario_projeto_financeiro.md` (Etapas 23–32).

> Passo-a-passo explicado do back-end **como ele é hoje** (atualizado em 06/08/2026, após a Etapa 20 +
> validações de entrada). Mostra os blocos mais importantes com o código real e uma explicação antes de
> cada um. As rotas de CRUD repetitivas (criar/listar/apagar) seguem sempre o mesmo padrão e são
> resumidas. A **fonte da verdade é o próprio `main.py`** (bem comentado); aqui é o mapa para estudar.

---

## 1. Imports e configuração

`re`, `csv`, `io` entraram para o leitor de extrato (E3). `CHAVE_SECRETA` assina os tokens.

```python
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import date, datetime, timedelta, timezone
import sqlite3, re, csv, io, bcrypt
from jose import jwt, JWTError

CHAVE_SECRETA = "..."          # ⚠ tirar p/ variável de ambiente antes de expor
ALGORITMO = "HS256"
HORAS_VALIDADE_TOKEN = 720     # 30 dias
app = FastAPI()
seguranca = HTTPBearer(auto_error=False)
```

---

## 2. Banco: tabelas e migração

`criar_tabelas()` cria (se não existir) as 8 tabelas: `bancos`, `caixinhas`, `lancamentos`, `contas`,
`recorrentes`, `config`, `fatura_itens`, `categorias`, `regras_salario`. As categorias padrão
("Conta fixa", "Cartão", "Outros") são semeadas **uma vez só** (guardado por `config.categorias_iniciadas`).

`migrar()` adiciona colunas novas a tabelas já existentes, **sem apagar dados** — só faz `ALTER TABLE`
se a coluna faltar (idempotente). Colunas cobertas hoje:

```python
def migrar():
    con = conectar()
    colunas = [c[1] for c in con.execute("PRAGMA table_info(caixinhas)").fetchall()]
    if "banco_id" not in colunas:      con.execute("ALTER TABLE caixinhas ADD COLUMN banco_id INTEGER")
    colunas_lanc = [c[1] for c in con.execute("PRAGMA table_info(lancamentos)").fetchall()]
    if "data" not in colunas_lanc:     con.execute("ALTER TABLE lancamentos ADD COLUMN data TEXT")
    colunas_contas = [c[1] for c in con.execute("PRAGMA table_info(contas)").fetchall()]
    if "tipo_conta" not in colunas_contas: con.execute("ALTER TABLE contas ADD COLUMN tipo_conta TEXT DEFAULT 'simples'")
    if "meta_centavos" not in colunas: con.execute("ALTER TABLE caixinhas ADD COLUMN meta_centavos INTEGER DEFAULT 0")
    if "meta_prazo" not in colunas:    con.execute("ALTER TABLE caixinhas ADD COLUMN meta_prazo TEXT")          # E8
    if "arquivada" not in colunas_contas: con.execute("ALTER TABLE contas ADD COLUMN arquivada INTEGER DEFAULT 0")  # M1
    colunas_rec = [c[1] for c in con.execute("PRAGMA table_info(recorrentes)").fetchall()]
    if "conta_fatura_id" not in colunas_rec: con.execute("ALTER TABLE recorrentes ADD COLUMN conta_fatura_id INTEGER")  # E2
    con.commit(); con.close()
```

---

## 3. Autenticação (senha + JWT)

- Senha guardada como **hash bcrypt** em `config.senha_hash` (`guardar_senha`/`senha_confere`).
- `criar_token()` gera um JWT com `exp` de 30 dias.
- `exigir_login` é a dependência que protege as rotas: sem token válido → 401.

```python
def exigir_login(cred: HTTPAuthorizationCredentials = Depends(seguranca)):
    if cred is None:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    try:
        jwt.decode(cred.credentials, CHAVE_SECRETA, algorithms=[ALGORITMO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    return True
```

---

## 4. Funções de apoio (cálculos e regras)

### `data_hoje()` e `data_valida()` — **validação nova**
`data_valida` recusa "datas malucas" (texto solto, ano fora de 2000–2100). Usada em lançamentos e contas.

```python
def data_valida(s):
    if not s: return True                         # vazio = usa hoje
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if not m: return False
    ano, mes, dia = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return 2000 <= ano <= 2100 and 1 <= mes <= 12 and 1 <= dia <= 31
```

### `saldo_da_caixinha()` — inclui rendimento (M2)
Saldo = (alocações **+ rendimentos**) − pagamentos. O `rendimento` entra como dinheiro novo na caixinha,
mas não é "entrada" nem sai do saldo livre.

```python
def saldo_da_caixinha(con, caixinha_id):
    entrou = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo IN ('alocacao','rendimento')",
        (caixinha_id,)).fetchone()[0]
    saiu = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo='pagamento'",
        (caixinha_id,)).fetchone()[0]
    return entrou - saiu
```

### `total_conta()`
Fatura = soma dos `fatura_itens`; conta simples = o valor guardado.

### `aplicar_regras_salario()` — E4
Chamada quando uma **entrada** é criada. Para cada regra cujo `gatilho` bate com a descrição
(case-insensitive), cria uma `alocacao` automática (% do valor ou valor fixo) na caixinha da regra.

```python
def aplicar_regras_salario(con, descricao, valor_centavos, data):
    alvo = (descricao or "").strip().lower()
    if not alvo: return
    for modo, valor, cxid in con.execute(
            "SELECT modo, valor, caixinha_id FROM regras_salario WHERE lower(gatilho)=?", (alvo,)).fetchall():
        if cxid is None or con.execute("SELECT id FROM caixinhas WHERE id=?", (cxid,)).fetchone() is None:
            continue
        quantia = round(valor_centavos * valor / 100) if modo == "percentual" else valor
        if quantia <= 0: continue
        con.execute("INSERT INTO lancamentos (tipo,valor_centavos,descricao,caixinha_id,data) VALUES ('alocacao',?,?,?,?)",
                    (quantia, f"regra: {descricao.strip()}", cxid, data))
```

### `gerar_recorrentes_do_mes()` — E2 (assinatura na fatura)
Roda no `GET /contas`. Para cada assinatura: se ela está **vinculada a uma fatura válida**, entra como
**item da fatura** do mês (dedup por nome+mês, respeita fatura paga) e **não** cria conta avulsa; senão,
cria a conta avulsa do mês (dedup por nome+vencimento).

```python
for nome, valor, dia, tipo, fatura_id in recorrentes:
    vencimento = f"{ano:04d}-{mes:02d}-{dia:02d}"
    if fatura_id is not None:
        fatura = con.execute("SELECT id, tipo_conta, paga FROM contas WHERE id=?", (fatura_id,)).fetchone()
        if fatura is not None and (fatura[1] or "simples") == "fatura":
            if fatura[2] == 0:  # só mexe se não paga
                ja = con.execute("SELECT id FROM fatura_itens WHERE conta_id=? AND descricao=? AND data LIKE ?",
                                 (fatura_id, nome, mes_str + "%")).fetchone()
                if ja is None:
                    con.execute("INSERT INTO fatura_itens (conta_id,descricao,valor_centavos,data) VALUES (?,?,?,?)",
                                (fatura_id, nome, valor, vencimento))
            continue
    ja_existe = con.execute("SELECT id FROM contas WHERE nome=? AND vencimento=?", (nome, vencimento)).fetchone()
    if ja_existe is None:
        con.execute("INSERT INTO contas (nome,valor_centavos,vencimento,tipo) VALUES (?,?,?,?)", (nome,valor,vencimento,tipo))
```

---

## 5. Leitor de extrato (E3) — parsers sem biblioteca externa

- `MAPA_PALAVRAS`: dicionário palavra→categoria (uber→transporte, ifood→alimentação...).
- `_num_br(s)`: converte texto monetário (BR `1.234,56` e US `1234.56`) em float, ou `None`.
- `_data_iso(s)`: normaliza `dd/mm/aaaa`, `aaaa-mm-dd`, `dd/mm/aa` → `AAAA-MM-DD`.
- `_sugerir_caixinha(desc, caixinhas)`: casa a descrição com o nome da caixinha ou via `MAPA_PALAVRAS`.
- `parse_ofx(texto, caixinhas)`: lê os blocos `<STMTTRN>` (valor `<TRNAMT>`, data `<DTPOSTED>`, descrição `<MEMO>/<NAME>`).
- `parse_csv(texto, caixinhas)`: detecta separador (`;`/`,`), acha colunas por cabeçalho (data/valor/descrição)
  ou por heurística posicional. Sinal do valor define entrada (+) ou gasto (−).

Todos devolvem uma lista de `{descricao, valor_centavos, data, tipo, caixinha_id}` — **só a prévia**, nada é gravado aqui.

---

## 6. Modelos (Pydantic)

Descrevem o corpo de cada rota. Destaques novos: `NovoLancamento` aceita `data` opcional;
`DefinirMeta` aceita `meta_prazo`; `NovaConta` tem `tipo_conta`; `NovaRecorrente` tem `conta_fatura_id`;
`NovaRegra`, `WrappedVisto`, `ImportarAnalise`, `LinhaImport`, `ImportarConfirmar`.

---

## 7. Rotas — resumo

### Lançamentos — **com validações novas**
`POST /lancamentos` agora recusa valor ≤ 0 e data inválida; se for `entrada`, dispara as regras de salário.

```python
@app.post("/lancamentos")
def criar_lancamento(item: NovoLancamento, _=Depends(exigir_login)):
    if item.valor_centavos <= 0:
        raise HTTPException(status_code=400, detail="O valor precisa ser maior que zero.")
    if not data_valida(item.data):
        raise HTTPException(status_code=400, detail="Data inválida (use AAAA-MM-DD, ano entre 2000 e 2100).")
    con = conectar()
    data = item.data if item.data else data_hoje()
    con.execute("INSERT INTO lancamentos (tipo,valor_centavos,descricao,caixinha_id,data) VALUES (?,?,?,?,?)",
                (item.tipo, item.valor_centavos, item.descricao, item.caixinha_id, data))
    if item.tipo == "entrada":
        aplicar_regras_salario(con, item.descricao, item.valor_centavos, data)
    con.commit(); con.close()
    return {"status": "salvo"}
```

### Saldo livre
`GET /saldo-livre` = `SUM(entrada) − SUM(alocacao) − SUM(saida_livre)` (rendimento não entra).

### Caixinhas
`POST /caixinhas` (banco obrigatório) · `GET /caixinhas` (devolve saldo, `meta_reais`, `meta_prazo`) ·
`POST /caixinhas/{id}/meta` (grava meta + prazo; sem meta zera o prazo) · `POST /caixinhas/{id}/mover` ·
`DELETE /caixinhas/{id}` (só se sem lançamentos).

### Contas — **com validações + arquivamento (M1)**
`POST /contas` recusa valor ≤ 0 (conta simples) e vencimento inválido. `GET /contas` mostra só as **não
arquivadas** e dispara `gerar_recorrentes_do_mes`. `PUT` e `DELETE` só em conta não paga.
Pagamento/desfazer como antes. Arquivamento:

```python
@app.post("/contas/{conta_id}/arquivar")   # só pagas: UPDATE arquivada=1
@app.post("/contas/{conta_id}/desarquivar") # UPDATE arquivada=0
@app.get("/contas/arquivadas")              # lista as arquivadas
@app.post("/contas/arquivar-antigas")       # arquiva as pagas de meses anteriores de uma vez
```

### Fatura (itens)
`GET/POST/DELETE /contas/{id}/itens` — só em conta tipo fatura e não paga.

### Recorrentes — **com vínculo de fatura (E2)**
`POST /recorrentes` (aceita `conta_fatura_id`) · `GET /recorrentes` · `DELETE /recorrentes/{id}` ·
`POST /recorrentes/{id}/fatura` (vincula/desvincula; ao vincular, **remove a conta avulsa não-paga do mês**
com o mesmo nome, pra não cobrar duas vezes).

### Bancos, Categorias
CRUD simples. Banco só apaga sem caixinhas. Categoria pode apagar mesmo em uso (o rótulo é texto nas contas).

### Regras de salário (E4)
`GET /regras` · `POST /regras` (valida modo, valor > 0, % ≤ 100, caixinha existe) · `DELETE /regras/{id}`.

### Retrospectiva (E6)
`GET /wrapped-status` (lê `config.wrapped_visto_ate`) · `POST /wrapped-visto` (marca o mês como visto).
O resumo em si é calculado no front a partir dos lançamentos.

### Importar extrato (E3)
`POST /importar/analisar` → chama `parse_ofx`/`parse_csv` e devolve a prévia (não grava).
`POST /importar/confirmar` → grava só as linhas que o usuário confirmou: entrada → `entrada` (saldo livre);
gasto com caixinha → `pagamento`; gasto sem caixinha → `saida_livre`. **Não** dispara regras de salário.

---

## Resumo dos tipos de lançamento

- `entrada` — dinheiro de fora (dispara regras de salário).
- `alocacao` — guardar em caixinha.
- `pagamento` — sair de uma caixinha (gasto / pagar conta / saída de transferência).
- `saida_livre` — sair do dinheiro não alocado.
- `rendimento` — juros/CDI: entra na caixinha, não conta como entrada nem mexe no saldo livre.
