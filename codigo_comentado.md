# Código completo comentado — `main.py`

> ⚠️ **SNAPSHOT HISTÓRICO (versão inicial do projeto).** Este passo-a-passo comentado retrata uma
> versão **antiga** do `main.py` (3 tabelas, sem login, ~11 rotas). O `main.py` atual tem ~1318 linhas,
> com autenticação JWT, ~40 rotas e 8 tabelas — e **já é bastante comentado no próprio arquivo**.
> Este documento é mantido como material de estudo do começo do projeto. Para o **estado atual**, use o
> próprio `main.py` (comentado) e o `documentacao_tecnica.md` (modelo de dados e rotas completos).
> Não re-anotamos as 1318 linhas aqui de propósito — seria duplicar os comentários que já existem no código.

Este documento reúne todo o código do projeto até aqui, exatamente como está,
com uma explicação antes de cada bloco. Serve como referência de estudo e como
o estado atual do `main.py`.

Inclui: banco (3 tabelas), lançamentos, caixinhas, transferência, apagar caixinha,
saldo livre não-alocado, e contas/dívidas com pagamento.

> Nota: este documento mostra o código na **ordem organizada ideal** (modelos juntos,
> funções auxiliares antes das rotas). O `main.py` real pode estar com os blocos um pouco
> fora de ordem por terem sido colados em etapas — funciona igual, mas quando quiser
> reorganizar, use este documento como referência da ordem limpa.

---

## Bloco 1 — Imports

Traz o FastAPI (o framework), o `HTTPException` (para recusar operações inválidas
com mensagem clara), o `BaseModel` do Pydantic (para descrever e validar o que chega
nas rotas) e o `sqlite3` (o banco de dados, que já vem embutido no Python).

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sqlite3

app = FastAPI()
```

---

## Bloco 2 — Banco de dados

`conectar()` abre o arquivo `financeiro.db` (criado sozinho na primeira vez).
`criar_tabelas()` monta as duas tabelas se ainda não existirem:
- `caixinhas`: os "bolsos" (só id e nome — sem coluna de saldo, de propósito).
- `lancamentos`: todo movimento de dinheiro, com uma coluna `caixinha_id` que
  liga o movimento a um bolso (pode ser vazia, ex.: numa entrada de salário).

Os valores ficam em `valor_centavos` (inteiro) — R$ 2.000 = 200000 — para evitar
erros de arredondamento com números decimais.

```python
def conectar():
    return sqlite3.connect("financeiro.db")

def criar_tabelas():
    con = conectar()
    con.execute("""
        CREATE TABLE IF NOT EXISTS caixinhas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS lancamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT,
            valor_centavos INTEGER,
            descricao TEXT,
            caixinha_id INTEGER
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            valor_centavos INTEGER,
            vencimento TEXT,
            tipo TEXT,
            paga INTEGER DEFAULT 0,
            caixinha_paga_id INTEGER
        )
    """)
    con.commit()
    con.close()

criar_tabelas()
```

---

## Bloco 3 — Modelos (o formato do que chega)

Descrevem o que cada rota espera receber. O Pydantic valida sozinho: se vier texto
onde devia ser número, ele recusa. O `caixinha_id: int | None = None` significa
"pode ter caixinha ou não". Os três tipos de lançamento usados são: `entrada`
(dinheiro de fora), `alocacao` (dinheiro para uma caixinha) e `pagamento` (dinheiro
que sai de uma caixinha).

```python
class NovaCaixinha(BaseModel):
    nome: str

class NovoLancamento(BaseModel):
    tipo: str
    valor_centavos: int
    descricao: str
    caixinha_id: int | None = None

class NovaTransferencia(BaseModel):
    origem_id: int
    destino_id: int
    valor_centavos: int

class NovaConta(BaseModel):
    nome: str
    valor_centavos: int
    vencimento: str
    tipo: str

class PagamentoConta(BaseModel):
    caixinha_id: int
```

---

## Bloco 4 — Função auxiliar de saldo

Calcula o saldo de uma caixinha somando o que entrou (`alocacao`) menos o que saiu
(`pagamento`). Fica numa função separada para não repetir esse cálculo em vários
lugares. É o "Método 2": o saldo é sempre calculado a partir dos lançamentos,
nunca guardado num campo à parte.

```python
def saldo_da_caixinha(con, caixinha_id):
    entrou = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo='alocacao'",
        (caixinha_id,)
    ).fetchone()[0]
    saiu = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo='pagamento'",
        (caixinha_id,)
    ).fetchone()[0]
    return entrou - saiu
```

---

## Bloco 5 — Rota raiz (teste de vida)

Só confirma que o app está no ar.

```python
@app.get("/")
def raiz():
    return {"mensagem": "app financeiro vivo"}
```

---

## Bloco 6 — Lançamentos

`POST /lancamentos` grava um movimento. `GET /lancamentos` lista todos, convertendo
centavos para reais só na hora de mostrar. Esta lista é a "fonte da verdade": todo
saldo do app é derivado dela.

```python
@app.post("/lancamentos")
def criar_lancamento(item: NovoLancamento):
    con = conectar()
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id) VALUES (?, ?, ?, ?)",
        (item.tipo, item.valor_centavos, item.descricao, item.caixinha_id)
    )
    con.commit()
    con.close()
    return {"status": "salvo"}

@app.get("/lancamentos")
def listar_lancamentos():
    con = conectar()
    linhas = con.execute("SELECT id, tipo, valor_centavos, descricao, caixinha_id FROM lancamentos").fetchall()
    con.close()
    return [
        {"id": l[0], "tipo": l[1], "valor_reais": l[2] / 100, "descricao": l[3], "caixinha_id": l[4]}
        for l in linhas
    ]
```

---

## Bloco 7 — Caixinhas (criar e listar)

`POST /caixinhas` cria um bolso (só o nome). `GET /caixinhas` lista cada um com o
saldo calculado na hora, usando a função auxiliar do Bloco 4.

```python
@app.post("/caixinhas")
def criar_caixinha(item: NovaCaixinha):
    con = conectar()
    con.execute("INSERT INTO caixinhas (nome) VALUES (?)", (item.nome,))
    con.commit()
    con.close()
    return {"status": "caixinha criada"}

@app.get("/caixinhas")
def listar_caixinhas():
    con = conectar()
    caixas = con.execute("SELECT id, nome FROM caixinhas").fetchall()
    resultado = []
    for c in caixas:
        cid = c[0]
        resultado.append({
            "id": cid,
            "nome": c[1],
            "saldo_reais": saldo_da_caixinha(con, cid) / 100
        })
    con.close()
    return resultado
```

> Nota: a rota `GET /caixinhas` original repetia o cálculo de saldo inteiro.
> Aqui ela já aparece usando a função auxiliar `saldo_da_caixinha` — mesmo
> resultado, código mais limpo. Se o seu `main.py` ainda tem a versão longa,
> pode trocar por esta quando quiser.

---

## Bloco 8 — Transferência entre caixinhas

Move dinheiro de um bolso para outro criando **dois lançamentos**: um `pagamento`
na origem e uma `alocacao` no destino. Antes de mover, faz três verificações:
valor positivo, origem diferente do destino, e saldo suficiente na origem.

```python
@app.post("/transferir")
def transferir(item: NovaTransferencia):
    if item.valor_centavos <= 0:
        raise HTTPException(status_code=400, detail="O valor precisa ser maior que zero.")
    if item.origem_id == item.destino_id:
        raise HTTPException(status_code=400, detail="Origem e destino não podem ser a mesma caixinha.")

    con = conectar()

    saldo_origem = saldo_da_caixinha(con, item.origem_id)
    if saldo_origem < item.valor_centavos:
        con.close()
        raise HTTPException(status_code=400, detail="Saldo insuficiente na caixinha de origem.")

    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id) VALUES (?, ?, ?, ?)",
        ("pagamento", item.valor_centavos, "transferência (saída)", item.origem_id)
    )
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id) VALUES (?, ?, ?, ?)",
        ("alocacao", item.valor_centavos, "transferência (entrada)", item.destino_id)
    )
    con.commit()
    con.close()
    return {"status": "transferência feita"}
```

---

## Bloco 9 — Apagar caixinha (só se estiver vazia)

`DELETE /caixinhas/{caixinha_id}`. O id vem pela URL. Só apaga se a caixinha existir
e não tiver nenhum lançamento ligado a ela — protege o histórico contra registros
órfãos. Se tem movimentos, orienta a transferir o saldo antes.

```python
@app.delete("/caixinhas/{caixinha_id}")
def apagar_caixinha(caixinha_id: int):
    con = conectar()

    existe = con.execute("SELECT id FROM caixinhas WHERE id=?", (caixinha_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa caixinha não existe.")

    qtd = con.execute(
        "SELECT COUNT(*) FROM lancamentos WHERE caixinha_id=?",
        (caixinha_id,)
    ).fetchone()[0]
    if qtd > 0:
        con.close()
        raise HTTPException(
            status_code=400,
            detail="A caixinha tem lançamentos. Transfira o saldo para outra antes de apagar."
        )

    con.execute("DELETE FROM caixinhas WHERE id=?", (caixinha_id,))
    con.commit()
    con.close()
    return {"status": "caixinha apagada"}
```

---

## Bloco 10 — Saldo livre não-alocado

`GET /saldo-livre` calcula quanto do dinheiro ainda não foi distribuído em caixinhas:
soma das entradas menos soma das alocações. O campo `tudo_distribuido` é verdadeiro
quando esse saldo chega a zero — o "orçamento fechado" do base zero (e o futuro
indicador verde do front-end).

```python
@app.get("/saldo-livre")
def saldo_livre():
    con = conectar()
    entradas = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='entrada'"
    ).fetchone()[0]
    alocado = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='alocacao'"
    ).fetchone()[0]
    con.close()
    livre = entradas - alocado
    return {
        "entradas_reais": entradas / 100,
        "alocado_reais": alocado / 100,
        "saldo_livre_reais": livre / 100,
        "tudo_distribuido": livre == 0
    }
```

> Ponto a revisitar: a transferência cria uma `alocacao` no destino, então ela conta
> nesse cálculo como se fosse distribuição de entrada. Para o uso atual funciona; quando
> o app crescer, pode valer diferenciar alocação-de-entrada de alocação-de-transferência.

---

## Bloco 11 — Contas / dívidas (a Tela 3)

Três rotas. `POST /contas` cadastra uma obrigação (nasce não-paga). `GET /contas` lista.
`POST /contas/{conta_id}/pagar` paga: confere o saldo da caixinha, cria o lançamento de
`pagamento` nela (INSERT) e marca a conta como paga guardando de qual caixinha saiu (UPDATE).
Três proteções: a conta existe, ainda não foi paga, e a caixinha tem saldo.

```python
@app.post("/contas")
def criar_conta(item: NovaConta):
    con = conectar()
    con.execute(
        "INSERT INTO contas (nome, valor_centavos, vencimento, tipo) VALUES (?, ?, ?, ?)",
        (item.nome, item.valor_centavos, item.vencimento, item.tipo)
    )
    con.commit()
    con.close()
    return {"status": "conta criada"}

@app.get("/contas")
def listar_contas():
    con = conectar()
    linhas = con.execute(
        "SELECT id, nome, valor_centavos, vencimento, tipo, paga, caixinha_paga_id FROM contas"
    ).fetchall()
    con.close()
    return [
        {
            "id": l[0],
            "nome": l[1],
            "valor_reais": l[2] / 100,
            "vencimento": l[3],
            "tipo": l[4],
            "paga": bool(l[5]),
            "caixinha_paga_id": l[6]
        }
        for l in linhas
    ]

@app.post("/contas/{conta_id}/pagar")
def pagar_conta(conta_id: int, item: PagamentoConta):
    con = conectar()

    conta = con.execute(
        "SELECT id, valor_centavos, paga FROM contas WHERE id=?", (conta_id,)
    ).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")

    if conta[2] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="Essa conta já foi paga.")

    valor = conta[1]

    if saldo_da_caixinha(con, item.caixinha_id) < valor:
        con.close()
        raise HTTPException(status_code=400, detail="Saldo insuficiente nessa caixinha.")

    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id) VALUES (?, ?, ?, ?)",
        ("pagamento", valor, "pagamento de conta", item.caixinha_id)
    )
    con.execute(
        "UPDATE contas SET paga=1, caixinha_paga_id=? WHERE id=?",
        (item.caixinha_id, conta_id)
    )
    con.commit()
    con.close()
    return {"status": "conta paga"}
```

---

## Resumo dos tipos de lançamento

- `entrada` — dinheiro que chega de fora (salário). Não pertence a caixinha.
- `alocacao` — dinheiro colocado numa caixinha (dar destino ao dinheiro).
- `pagamento` — dinheiro que sai de uma caixinha (gasto, ou saída de transferência).

## Rotas disponíveis hoje

- `GET /` — teste de vida
- `POST /lancamentos` — grava um movimento
- `GET /lancamentos` — lista todos os movimentos
- `POST /caixinhas` — cria uma caixinha
- `GET /caixinhas` — lista caixinhas com saldo
- `POST /transferir` — move dinheiro entre caixinhas
- `DELETE /caixinhas/{id}` — apaga uma caixinha vazia
- `GET /saldo-livre` — quanto do dinheiro ainda não foi distribuído
- `POST /contas` — cadastra uma conta/dívida
- `GET /contas` — lista as contas
- `POST /contas/{id}/pagar` — paga uma conta puxando de uma caixinha
