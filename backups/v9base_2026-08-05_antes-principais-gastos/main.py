from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import date, datetime, timedelta, timezone
import sqlite3
import bcrypt
from jose import jwt, JWTError

# chave secreta para assinar os tokens de sessão.
# em uso real, isto deveria vir de uma variável de ambiente, não ficar no código.
CHAVE_SECRETA = "troque-esta-chave-por-uma-bem-aleatoria-e-longa"
ALGORITMO = "HS256"
HORAS_VALIDADE_TOKEN = 720  # 30 dias — cômodo para uso pessoal

app = FastAPI()
seguranca = HTTPBearer(auto_error=False)


# ========================================================
# FUNÇÕES DE APOIO (banco e cálculos) — ficam antes das rotas
# ========================================================

def conectar():
    return sqlite3.connect("financeiro.db")

def criar_tabelas():
    con = conectar()
    con.execute("""
        CREATE TABLE IF NOT EXISTS bancos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT
        )
    """)
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
    con.execute("""
        CREATE TABLE IF NOT EXISTS recorrentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            valor_centavos INTEGER,
            dia_vencimento INTEGER,
            tipo TEXT
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS config (
            chave TEXT PRIMARY KEY,
            valor TEXT
        )
    """)
    # D: itens de uma conta do tipo "fatura" (cartão). O total da fatura é a soma destes itens.
    con.execute("""
        CREATE TABLE IF NOT EXISTS fatura_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conta_id INTEGER,
            descricao TEXT,
            valor_centavos INTEGER,
            data TEXT
        )
    """)
    # Categorias das contas (rótulos gerenciáveis pelo usuário: fixa, cartão, etc.).
    con.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT
        )
    """)
    # semeia as categorias padrão UMA vez só (não recria se o usuário apagar depois)
    ja_semeou = con.execute("SELECT valor FROM config WHERE chave='categorias_iniciadas'").fetchone()
    if ja_semeou is None:
        for nome in ("Conta fixa", "Cartão", "Outros"):
            con.execute("INSERT INTO categorias (nome) VALUES (?)", (nome,))
        con.execute("INSERT OR REPLACE INTO config (chave, valor) VALUES ('categorias_iniciadas', '1')")
    con.commit()
    con.close()
    migrar()

# adiciona colunas novas a tabelas que já existem, sem apagar dados.
# só adiciona se a coluna ainda não existir (senão o ALTER daria erro na 2ª vez).
def migrar():
    con = conectar()
    # quais colunas a tabela caixinhas já tem?
    colunas = [c[1] for c in con.execute("PRAGMA table_info(caixinhas)").fetchall()]
    if "banco_id" not in colunas:
        con.execute("ALTER TABLE caixinhas ADD COLUMN banco_id INTEGER")
    # F1: passar a guardar a DATA de cada lançamento (só os novos terão data;
    # os antigos ficam com NULL, pois não dá pra inventar quando aconteceram).
    colunas_lanc = [c[1] for c in con.execute("PRAGMA table_info(lancamentos)").fetchall()]
    if "data" not in colunas_lanc:
        con.execute("ALTER TABLE lancamentos ADD COLUMN data TEXT")
    # D: tipo da conta — "simples" (valor único) ou "fatura" (soma de itens).
    # Contas antigas assumem "simples" (DEFAULT), preservando o comportamento atual.
    colunas_contas = [c[1] for c in con.execute("PRAGMA table_info(contas)").fetchall()]
    if "tipo_conta" not in colunas_contas:
        con.execute("ALTER TABLE contas ADD COLUMN tipo_conta TEXT DEFAULT 'simples'")
    # Metas: valor-alvo opcional de cada caixinha (0 = sem meta).
    if "meta_centavos" not in colunas:
        con.execute("ALTER TABLE caixinhas ADD COLUMN meta_centavos INTEGER DEFAULT 0")
    con.commit()
    con.close()

# ---- funções de login ----

def senha_ja_definida():
    con = conectar()
    r = con.execute("SELECT valor FROM config WHERE chave='senha_hash'").fetchone()
    con.close()
    return r is not None

def guardar_senha(senha_texto):
    hash_ = bcrypt.hashpw(senha_texto.encode("utf-8"), bcrypt.gensalt())
    con = conectar()
    con.execute(
        "INSERT OR REPLACE INTO config (chave, valor) VALUES ('senha_hash', ?)",
        (hash_.decode("utf-8"),)
    )
    con.commit()
    con.close()

def senha_confere(senha_texto):
    con = conectar()
    r = con.execute("SELECT valor FROM config WHERE chave='senha_hash'").fetchone()
    con.close()
    if r is None:
        return False
    return bcrypt.checkpw(senha_texto.encode("utf-8"), r[0].encode("utf-8"))

def criar_token():
    expira = datetime.now(timezone.utc) + timedelta(hours=HORAS_VALIDADE_TOKEN)
    return jwt.encode({"dono": True, "exp": expira}, CHAVE_SECRETA, algorithm=ALGORITMO)

# dependência que protege as rotas: exige um token válido
def exigir_login(cred: HTTPAuthorizationCredentials = Depends(seguranca)):
    if cred is None:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    try:
        jwt.decode(cred.credentials, CHAVE_SECRETA, algorithms=[ALGORITMO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
    return True

criar_tabelas()

# data de hoje no formato AAAA-MM-DD, usada ao gravar cada lançamento novo (F1)
def data_hoje():
    return date.today().isoformat()

# saldo de uma caixinha = alocações menos pagamentos dela
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

# D: total de uma conta. Fatura = soma dos itens; simples = o valor guardado.
def total_conta(con, conta_id, tipo_conta, valor_centavos):
    if tipo_conta == "fatura":
        return con.execute(
            "SELECT COALESCE(SUM(valor_centavos),0) FROM fatura_itens WHERE conta_id=?",
            (conta_id,)
        ).fetchone()[0]
    return valor_centavos

# gera as contas das recorrentes para o mês atual (uma vez por mês, sem duplicar)
def gerar_recorrentes_do_mes():
    con = conectar()
    hoje = date.today()
    ano = hoje.year
    mes = hoje.month
    recorrentes = con.execute(
        "SELECT nome, valor_centavos, dia_vencimento, tipo FROM recorrentes"
    ).fetchall()
    for r in recorrentes:
        nome, valor, dia, tipo = r[0], r[1], r[2], r[3]
        vencimento = f"{ano:04d}-{mes:02d}-{dia:02d}"
        ja_existe = con.execute(
            "SELECT id FROM contas WHERE nome=? AND vencimento=?",
            (nome, vencimento)
        ).fetchone()
        if ja_existe is None:
            con.execute(
                "INSERT INTO contas (nome, valor_centavos, vencimento, tipo) VALUES (?, ?, ?, ?)",
                (nome, valor, vencimento, tipo)
            )
    con.commit()
    con.close()


# ========================================================
# MODELOS (o formato do que chega em cada rota) — todos juntos
# ========================================================

class NovaCaixinha(BaseModel):
    nome: str
    banco_id: int
    meta_centavos: int = 0   # meta opcional (0 = sem meta)

class DefinirMeta(BaseModel):
    meta_centavos: int

class MoverCaixinha(BaseModel):
    banco_id: int

class NovoLancamento(BaseModel):
    tipo: str
    valor_centavos: int
    descricao: str
    caixinha_id: int | None = None
    data: str | None = None   # data escolhida (AAAA-MM-DD); se vazio, usa hoje

class NovaTransferencia(BaseModel):
    origem_id: int
    destino_id: int
    valor_centavos: int

class NovaConta(BaseModel):
    nome: str
    valor_centavos: int
    vencimento: str
    tipo: str
    tipo_conta: str = "simples"   # D: "simples" ou "fatura"

class EditarConta(BaseModel):
    nome: str
    valor_centavos: int
    vencimento: str
    tipo: str

class NovoItemFatura(BaseModel):
    descricao: str
    valor_centavos: int

class PagamentoConta(BaseModel):
    caixinha_id: int

class NovaRecorrente(BaseModel):
    nome: str
    valor_centavos: int
    dia_vencimento: int
    tipo: str

class NovoBanco(BaseModel):
    nome: str

class NovaCategoria(BaseModel):
    nome: str

class DefinirSenha(BaseModel):
    senha: str

class Login(BaseModel):
    senha: str


# ========================================================
# ROTAS GERAIS
# ========================================================

@app.get("/")
def raiz():
    return {"mensagem": "app financeiro vivo"}

@app.get("/app")
def servir_pagina():
    # no-store: o navegador nunca guarda o index.html em cache, então toda atualização
    # aparece na hora (evita o problema de "não muda nada" por cache do navegador).
    return FileResponse("index.html", headers={"Cache-Control": "no-store"})

# ---- rotas de login ----

@app.get("/auth/status")
def auth_status():
    # diz ao front se já existe senha (pra mostrar tela de criar ou de entrar)
    return {"senha_definida": senha_ja_definida()}

@app.post("/auth/definir-senha")
def definir_senha(item: DefinirSenha):
    if senha_ja_definida():
        raise HTTPException(status_code=400, detail="A senha já foi definida.")
    if len(item.senha) < 4:
        raise HTTPException(status_code=400, detail="A senha precisa ter ao menos 4 caracteres.")
    guardar_senha(item.senha)
    return {"token": criar_token()}

@app.post("/auth/login")
def login(item: Login):
    if not senha_confere(item.senha):
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    return {"token": criar_token()}


# ========================================================
# ROTAS DE LANÇAMENTOS
# ========================================================

@app.post("/lancamentos")
def criar_lancamento(item: NovoLancamento, _=Depends(exigir_login)):
    con = conectar()
    # usa a data escolhida (se veio) ou a de hoje
    data = item.data if item.data else data_hoje()
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id, data) VALUES (?, ?, ?, ?, ?)",
        (item.tipo, item.valor_centavos, item.descricao, item.caixinha_id, data)
    )
    con.commit()
    con.close()
    return {"status": "salvo"}

@app.get("/lancamentos")
def listar_lancamentos(_=Depends(exigir_login)):
    con = conectar()
    linhas = con.execute("SELECT id, tipo, valor_centavos, descricao, caixinha_id, data FROM lancamentos").fetchall()
    con.close()
    return [
        {"id": l[0], "tipo": l[1], "valor_reais": l[2] / 100, "descricao": l[3], "caixinha_id": l[4], "data": l[5]}
        for l in linhas
    ]

@app.delete("/lancamentos/{lancamento_id}")
def apagar_lancamento(lancamento_id: int, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM lancamentos WHERE id=?", (lancamento_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Esse lançamento não existe.")
    con.execute("DELETE FROM lancamentos WHERE id=?", (lancamento_id,))
    con.commit()
    con.close()
    return {"status": "lançamento apagado"}

@app.get("/saldo-livre")
def saldo_livre(_=Depends(exigir_login)):
    con = conectar()
    entradas = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='entrada'"
    ).fetchone()[0]
    alocado = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='alocacao'"
    ).fetchone()[0]
    saidas_livres = con.execute(
        "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE tipo='saida_livre'"
    ).fetchone()[0]
    con.close()
    livre = entradas - alocado - saidas_livres
    return {
        "entradas_reais": entradas / 100,
        "alocado_reais": alocado / 100,
        "saidas_livres_reais": saidas_livres / 100,
        "saldo_livre_reais": livre / 100,
        "tudo_distribuido": livre == 0
    }


# ========================================================
# ROTAS DE CAIXINHAS
# ========================================================

@app.post("/caixinhas")
def criar_caixinha(item: NovaCaixinha, _=Depends(exigir_login)):
    con = conectar()
    # o banco existe?
    banco = con.execute("SELECT id FROM bancos WHERE id=?", (item.banco_id,)).fetchone()
    if banco is None:
        con.close()
        raise HTTPException(status_code=400, detail="Esse banco não existe.")
    con.execute(
        "INSERT INTO caixinhas (nome, banco_id, meta_centavos) VALUES (?, ?, ?)",
        (item.nome, item.banco_id, item.meta_centavos)
    )
    con.commit()
    con.close()
    return {"status": "caixinha criada"}

@app.get("/caixinhas")
def listar_caixinhas(_=Depends(exigir_login)):
    con = conectar()
    caixas = con.execute("SELECT id, nome, banco_id, meta_centavos FROM caixinhas").fetchall()
    resultado = []
    for c in caixas:
        cid = c[0]
        meta = c[3] or 0
        resultado.append({
            "id": cid,
            "nome": c[1],
            "banco_id": c[2],
            "saldo_reais": saldo_da_caixinha(con, cid) / 100,
            "meta_reais": (meta / 100) if meta > 0 else None
        })
    con.close()
    return resultado

@app.post("/caixinhas/{caixinha_id}/meta")
def definir_meta(caixinha_id: int, item: DefinirMeta, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM caixinhas WHERE id=?", (caixinha_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa caixinha não existe.")
    meta = item.meta_centavos if item.meta_centavos > 0 else 0
    con.execute("UPDATE caixinhas SET meta_centavos=? WHERE id=?", (meta, caixinha_id))
    con.commit()
    con.close()
    return {"status": "meta atualizada"}

@app.post("/caixinhas/{caixinha_id}/mover")
def mover_caixinha(caixinha_id: int, item: MoverCaixinha, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM caixinhas WHERE id=?", (caixinha_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa caixinha não existe.")
    banco = con.execute("SELECT id FROM bancos WHERE id=?", (item.banco_id,)).fetchone()
    if banco is None:
        con.close()
        raise HTTPException(status_code=400, detail="Esse banco não existe.")
    con.execute("UPDATE caixinhas SET banco_id=? WHERE id=?", (item.banco_id, caixinha_id))
    con.commit()
    con.close()
    return {"status": "caixinha movida"}

@app.post("/transferir")
def transferir(item: NovaTransferencia, _=Depends(exigir_login)):
    if item.valor_centavos <= 0:
        raise HTTPException(status_code=400, detail="O valor precisa ser maior que zero.")
    if item.origem_id == item.destino_id:
        raise HTTPException(status_code=400, detail="Origem e destino não podem ser a mesma caixinha.")

    con = conectar()

    saldo_origem = saldo_da_caixinha(con, item.origem_id)
    if saldo_origem < item.valor_centavos:
        con.close()
        raise HTTPException(status_code=400, detail="Saldo insuficiente na caixinha de origem.")

    # tira da origem (pagamento) e põe no destino (alocacao)
    hoje = data_hoje()
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id, data) VALUES (?, ?, ?, ?, ?)",
        ("pagamento", item.valor_centavos, "transferência (saída)", item.origem_id, hoje)
    )
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id, data) VALUES (?, ?, ?, ?, ?)",
        ("alocacao", item.valor_centavos, "transferência (entrada)", item.destino_id, hoje)
    )
    con.commit()
    con.close()
    return {"status": "transferência feita"}

@app.delete("/caixinhas/{caixinha_id}")
def apagar_caixinha(caixinha_id: int, _=Depends(exigir_login)):
    con = conectar()

    # a caixinha existe?
    existe = con.execute("SELECT id FROM caixinhas WHERE id=?", (caixinha_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa caixinha não existe.")

    # tem algum lançamento ligado a ela?
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


# ========================================================
# ROTAS DE CONTAS / DÍVIDAS
# ========================================================

@app.post("/contas")
def criar_conta(item: NovaConta, _=Depends(exigir_login)):
    con = conectar()
    # fatura nasce com total 0 (o valor vem da soma dos itens); simples usa o valor informado.
    valor = 0 if item.tipo_conta == "fatura" else item.valor_centavos
    con.execute(
        "INSERT INTO contas (nome, valor_centavos, vencimento, tipo, tipo_conta) VALUES (?, ?, ?, ?, ?)",
        (item.nome, valor, item.vencimento, item.tipo, item.tipo_conta)
    )
    con.commit()
    con.close()
    return {"status": "conta criada"}

@app.delete("/contas/{conta_id}")
def apagar_conta(conta_id: int, _=Depends(exigir_login)):
    con = conectar()
    conta = con.execute("SELECT paga FROM contas WHERE id=?", (conta_id,)).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")
    if conta[0] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="Não dá pra apagar uma conta paga. Use 'desfazer' primeiro.")
    # se for fatura, apaga também os itens dela (não deixar itens órfãos)
    con.execute("DELETE FROM fatura_itens WHERE conta_id=?", (conta_id,))
    con.execute("DELETE FROM contas WHERE id=?", (conta_id,))
    con.commit()
    con.close()
    return {"status": "conta apagada"}

@app.put("/contas/{conta_id}")
def editar_conta(conta_id: int, item: EditarConta, _=Depends(exigir_login)):
    con = conectar()
    conta = con.execute("SELECT paga FROM contas WHERE id=?", (conta_id,)).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")
    if conta[0] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="Não dá pra editar uma conta paga. Use 'desfazer' primeiro.")
    con.execute(
        "UPDATE contas SET nome=?, valor_centavos=?, vencimento=?, tipo=? WHERE id=?",
        (item.nome, item.valor_centavos, item.vencimento, item.tipo, conta_id)
    )
    con.commit()
    con.close()
    return {"status": "conta editada"}

@app.get("/contas")
def listar_contas(_=Depends(exigir_login)):
    gerar_recorrentes_do_mes()
    con = conectar()
    linhas = con.execute(
        "SELECT id, nome, valor_centavos, vencimento, tipo, paga, caixinha_paga_id, tipo_conta FROM contas"
    ).fetchall()
    resultado = []
    for l in linhas:
        tipo_conta = l[7] or "simples"
        # fatura: valor exibido é a soma dos itens; simples: o valor guardado
        total = total_conta(con, l[0], tipo_conta, l[2])
        qtd_itens = 0
        if tipo_conta == "fatura":
            qtd_itens = con.execute(
                "SELECT COUNT(*) FROM fatura_itens WHERE conta_id=?", (l[0],)
            ).fetchone()[0]
        resultado.append({
            "id": l[0],
            "nome": l[1],
            "valor_reais": total / 100,
            "vencimento": l[3],
            "tipo": l[4],
            "paga": bool(l[5]),
            "caixinha_paga_id": l[6],
            "tipo_conta": tipo_conta,
            "qtd_itens": qtd_itens
        })
    con.close()
    return resultado

@app.post("/contas/{conta_id}/pagar")
def pagar_conta(conta_id: int, item: PagamentoConta, _=Depends(exigir_login)):
    con = conectar()

    # a conta existe?
    conta = con.execute(
        "SELECT id, valor_centavos, paga, tipo_conta FROM contas WHERE id=?", (conta_id,)
    ).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")

    # já foi paga?
    if conta[2] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="Essa conta já foi paga.")

    # valor a pagar: fatura = soma dos itens; simples = valor guardado
    valor = total_conta(con, conta_id, conta[3] or "simples", conta[1])
    if valor <= 0:
        con.close()
        raise HTTPException(status_code=400, detail="Essa fatura não tem itens para pagar.")

    # a caixinha tem saldo suficiente?
    if saldo_da_caixinha(con, item.caixinha_id) < valor:
        con.close()
        raise HTTPException(status_code=400, detail="Saldo insuficiente nessa caixinha.")

    # tira o dinheiro da caixinha (pagamento)
    con.execute(
        "INSERT INTO lancamentos (tipo, valor_centavos, descricao, caixinha_id, data) VALUES (?, ?, ?, ?, ?)",
        ("pagamento", valor, "pagamento de conta", item.caixinha_id, data_hoje())
    )
    # marca a conta como paga e guarda de qual caixinha saiu
    con.execute(
        "UPDATE contas SET paga=1, caixinha_paga_id=? WHERE id=?",
        (item.caixinha_id, conta_id)
    )
    con.commit()
    con.close()
    return {"status": "conta paga"}

@app.post("/contas/{conta_id}/desfazer-pagamento")
def desfazer_pagamento(conta_id: int, _=Depends(exigir_login)):
    con = conectar()
    conta = con.execute(
        "SELECT id, valor_centavos, paga, caixinha_paga_id, tipo_conta FROM contas WHERE id=?", (conta_id,)
    ).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")
    if conta[2] == 0:
        con.close()
        raise HTTPException(status_code=400, detail="Essa conta não está paga.")

    # o valor pago foi o total da conta (fatura = soma dos itens, que ficam congelados enquanto paga)
    valor = total_conta(con, conta_id, conta[4] or "simples", conta[1])
    caixinha_id = conta[3]

    # remove o lançamento de pagamento criado (o mais recente dessa caixinha com esse valor)
    lanc = con.execute(
        "SELECT id FROM lancamentos WHERE caixinha_id=? AND valor_centavos=? AND tipo='pagamento' AND descricao='pagamento de conta' ORDER BY id DESC LIMIT 1",
        (caixinha_id, valor)
    ).fetchone()
    if lanc is not None:
        con.execute("DELETE FROM lancamentos WHERE id=?", (lanc[0],))

    # marca a conta como não paga de novo
    con.execute("UPDATE contas SET paga=0, caixinha_paga_id=NULL WHERE id=?", (conta_id,))
    con.commit()
    con.close()
    return {"status": "pagamento desfeito"}


# ---- itens de fatura (D) ----

@app.get("/contas/{conta_id}/itens")
def listar_itens_fatura(conta_id: int, _=Depends(exigir_login)):
    con = conectar()
    linhas = con.execute(
        "SELECT id, descricao, valor_centavos, data FROM fatura_itens WHERE conta_id=? ORDER BY id",
        (conta_id,)
    ).fetchall()
    con.close()
    return [
        {"id": l[0], "descricao": l[1], "valor_reais": l[2] / 100, "data": l[3]}
        for l in linhas
    ]

@app.post("/contas/{conta_id}/itens")
def adicionar_item_fatura(conta_id: int, item: NovoItemFatura, _=Depends(exigir_login)):
    con = conectar()
    conta = con.execute(
        "SELECT tipo_conta, paga FROM contas WHERE id=?", (conta_id,)
    ).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")
    if (conta[0] or "simples") != "fatura":
        con.close()
        raise HTTPException(status_code=400, detail="Só dá pra adicionar itens em contas do tipo fatura.")
    if conta[1] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="A fatura já foi paga. Desfaça o pagamento para alterar os itens.")
    if item.valor_centavos <= 0:
        con.close()
        raise HTTPException(status_code=400, detail="O valor do item precisa ser maior que zero.")
    con.execute(
        "INSERT INTO fatura_itens (conta_id, descricao, valor_centavos, data) VALUES (?, ?, ?, ?)",
        (conta_id, item.descricao, item.valor_centavos, data_hoje())
    )
    con.commit()
    con.close()
    return {"status": "item adicionado"}

@app.delete("/contas/{conta_id}/itens/{item_id}")
def apagar_item_fatura(conta_id: int, item_id: int, _=Depends(exigir_login)):
    con = conectar()
    conta = con.execute("SELECT paga FROM contas WHERE id=?", (conta_id,)).fetchone()
    if conta is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa conta não existe.")
    if conta[0] == 1:
        con.close()
        raise HTTPException(status_code=400, detail="A fatura já foi paga. Desfaça o pagamento para alterar os itens.")
    existe = con.execute(
        "SELECT id FROM fatura_itens WHERE id=? AND conta_id=?", (item_id, conta_id)
    ).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Esse item não existe nessa fatura.")
    con.execute("DELETE FROM fatura_itens WHERE id=?", (item_id,))
    con.commit()
    con.close()
    return {"status": "item apagado"}


# ========================================================
# ROTAS DE RECORRENTES (assinaturas que se repetem todo mês)
# ========================================================

@app.post("/recorrentes")
def criar_recorrente(item: NovaRecorrente, _=Depends(exigir_login)):
    con = conectar()
    con.execute(
        "INSERT INTO recorrentes (nome, valor_centavos, dia_vencimento, tipo) VALUES (?, ?, ?, ?)",
        (item.nome, item.valor_centavos, item.dia_vencimento, item.tipo)
    )
    con.commit()
    con.close()
    return {"status": "recorrente criada"}

@app.get("/recorrentes")
def listar_recorrentes(_=Depends(exigir_login)):
    con = conectar()
    linhas = con.execute(
        "SELECT id, nome, valor_centavos, dia_vencimento, tipo FROM recorrentes"
    ).fetchall()
    con.close()
    return [
        {"id": l[0], "nome": l[1], "valor_reais": l[2] / 100, "dia_vencimento": l[3], "tipo": l[4]}
        for l in linhas
    ]

@app.delete("/recorrentes/{recorrente_id}")
def apagar_recorrente(recorrente_id: int, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM recorrentes WHERE id=?", (recorrente_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa assinatura não existe.")
    # apaga só o molde; as contas já geradas continuam existindo
    con.execute("DELETE FROM recorrentes WHERE id=?", (recorrente_id,))
    con.commit()
    con.close()
    return {"status": "assinatura apagada"}


# ========================================================
# ROTAS DE BANCOS
# ========================================================

@app.post("/bancos")
def criar_banco(item: NovoBanco, _=Depends(exigir_login)):
    con = conectar()
    con.execute("INSERT INTO bancos (nome) VALUES (?)", (item.nome,))
    con.commit()
    con.close()
    return {"status": "banco criado"}

@app.get("/bancos")
def listar_bancos(_=Depends(exigir_login)):
    con = conectar()
    linhas = con.execute("SELECT id, nome FROM bancos").fetchall()
    con.close()
    return [{"id": l[0], "nome": l[1]} for l in linhas]

@app.delete("/bancos/{banco_id}")
def apagar_banco(banco_id: int, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM bancos WHERE id=?", (banco_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Esse banco não existe.")
    # tem caixinhas dentro dele?
    qtd = con.execute("SELECT COUNT(*) FROM caixinhas WHERE banco_id=?", (banco_id,)).fetchone()[0]
    if qtd > 0:
        con.close()
        raise HTTPException(
            status_code=400,
            detail="Esse banco tem caixinhas. Mova ou apague as caixinhas antes."
        )
    con.execute("DELETE FROM bancos WHERE id=?", (banco_id,))
    con.commit()
    con.close()
    return {"status": "banco apagado"}


# ========================================================
# ROTAS DE CATEGORIAS (rótulos das contas/assinaturas)
# ========================================================

@app.get("/categorias")
def listar_categorias(_=Depends(exigir_login)):
    con = conectar()
    linhas = con.execute("SELECT id, nome FROM categorias ORDER BY id").fetchall()
    con.close()
    return [{"id": l[0], "nome": l[1]} for l in linhas]

@app.post("/categorias")
def criar_categoria(item: NovaCategoria, _=Depends(exigir_login)):
    nome = item.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Dê um nome à categoria.")
    con = conectar()
    # evita duplicar (ignorando maiúsculas/minúsculas)
    ja_existe = con.execute("SELECT id FROM categorias WHERE lower(nome)=lower(?)", (nome,)).fetchone()
    if ja_existe is not None:
        con.close()
        raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome.")
    con.execute("INSERT INTO categorias (nome) VALUES (?)", (nome,))
    con.commit()
    con.close()
    return {"status": "categoria criada"}

@app.delete("/categorias/{categoria_id}")
def apagar_categoria(categoria_id: int, _=Depends(exigir_login)):
    con = conectar()
    existe = con.execute("SELECT id FROM categorias WHERE id=?", (categoria_id,)).fetchone()
    if existe is None:
        con.close()
        raise HTTPException(status_code=404, detail="Essa categoria não existe.")
    # remoção permitida mesmo em uso — contas antigas mantêm o rótulo (o campo é só texto)
    con.execute("DELETE FROM categorias WHERE id=?", (categoria_id,))
    con.commit()
    con.close()
    return {"status": "categoria apagada"}
