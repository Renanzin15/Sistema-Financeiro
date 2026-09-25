# Diário do projeto — Sistema financeiro pessoal

Documento vivo. Cresce a cada etapa. Registra o que foi feito, por que foi feito
e o que aprendi no caminho. Projeto de estudo, uso pessoal, roda local na máquina (Windows).

---

## Visão geral do projeto

App de controle financeiro pessoal baseado em **orçamento base zero** + **caixinhas
(envelopes)**: todo dinheiro que entra recebe um destino até o saldo livre chegar a R$ 0,00,
e todo gasto sai de uma caixinha específica.

**Stack escolhida:**
- Back-end: Python + FastAPI
- Banco: SQLite (arquivo local, sem servidor)
- Front-end (etapa futura): HTML + CSS + JavaScript consumindo a API
- Sem login/hospedagem — uso pessoal, tudo no `localhost`

---

## Decisões de projeto (e o porquê de cada uma)

### Dinheiro em centavos, como número inteiro
Todo valor é guardado em centavos inteiros (R$ 2.000 = 200000, R$ 60 = 6000).
**Motivo:** o computador não representa números decimais com exatidão (0,10 + 0,20
pode dar 0,30000000000000004). Em finanças, esses erros se acumulam. Inteiros somam e
subtraem com precisão perfeita. A conversão para reais (`/ 100`) acontece só na hora
de exibir. No front-end futuro, o usuário digita reais e o JavaScript multiplica por 100
antes de enviar. Cada camada com o formato que faz sentido pra ela.

### Saldo calculado a partir dos lançamentos, nunca editado "na mão"
O saldo é sempre a soma dos lançamentos (entradas menos pagamentos). Isso mantém
histórico e saldo sempre coerentes e dá a tela de histórico "de graça".

---

## Etapa 1 — Ambiente e primeiro servidor  ✅

**O que foi feito:**
- Instalado Python (Windows) e VS Code.
- Instaladas as bibliotecas com `python -m pip install fastapi uvicorn`.
- Criada pasta do projeto e aberta no VS Code via File → Open Folder.
- Criado `main.py`.
- Servidor rodado com `python -m uvicorn main:app --reload`.
- Testado em `http://127.0.0.1:8000/docs` (interface de testes automática do FastAPI).

**Aprendizados / tropeços resolvidos:**
- `fastapo` → erro de digitação; o certo é `fastapi`.
- `uvicorn não reconhecido` / `No module named uvicorn` → resolvido usando
  `python -m ...`, que amarra o comando ao mesmo Python onde instalei os pacotes.
- `Could not import module "main"` → o terminal precisa estar na mesma pasta do
  `main.py`. Solução: abrir a pasta pelo Open Folder e usar o terminal de dentro do VS Code.
- `127.0.0.1` (localhost) **não** é internet — é a própria máquina. Nada fica exposto.

---

## Etapa 2 — Banco de dados e primeiras rotas  ✅

**O que foi feito:**
- Adicionado SQLite (já vem embutido no Python).
- Criada a tabela `lancamentos` (id, tipo, valor_centavos, descricao).
- Criadas as rotas:
  - `POST /lancamentos` — grava um movimento.
  - `GET /lancamentos` — lista tudo (convertendo centavos → reais na exibição).
  - `GET /saldo` — soma entradas, subtrai pagamentos.
- O arquivo `financeiro.db` é criado sozinho na pasta.

**Aprendizados / observações dos testes:**
- Cada Execute grava uma linha nova — o banco guarda tudo até eu mandar apagar
  (foi o caso do saldo 5940: três salários registrados sem querer).
- Para zerar: parar o uvicorn (Ctrl+C), deletar `financeiro.db`, rodar de novo
  (a tabela se recria pelo `CREATE TABLE IF NOT EXISTS`).
- Um tipo diferente de "entrada"/"pagamento" é gravado, mas **ignorado** no cálculo do saldo.
- Valor como texto ("abc") é **recusado** pelo Pydantic (validação automática).
- Saldo pode ficar **negativo** — o app hoje deixa gastar mais do que se tem.

---

## Código atual completo (`main.py`)
```python
from fastapi import FastAPI
from pydantic import BaseModel
import sqlite3

app = FastAPI()

# ---- BANCO ----
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
    con.commit()
    con.close()

criar_tabelas()

# ---- MODELOS ----
class NovaCaixinha(BaseModel):
    nome: str

class NovoLancamento(BaseModel):
    tipo: str
    valor_centavos: int
    descricao: str
    caixinha_id: int | None = None

# ---- ROTAS GERAIS ----
@app.get("/")
def raiz():
    return {"mensagem": "app financeiro vivo"}

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

# ---- ROTAS DE CAIXINHAS ----
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
        entrou = con.execute(
            "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo='alocacao'",
            (cid,)
        ).fetchone()[0]
        saiu = con.execute(
            "SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE caixinha_id=? AND tipo='pagamento'",
            (cid,)
        ).fetchone()[0]
        resultado.append({
            "id": cid,
            "nome": c[1],
            "saldo_reais": (entrou - saiu) / 100
        })
    con.close()
    return resultado
```

---

## Etapa 3 — Caixinhas (envelopes)  ✅

**Decisão importante desta etapa — como controlar o saldo da caixinha:**
Escolhido o **Método 2: calcular o saldo somando os lançamentos** (em vez de guardar
um campo de saldo e atualizar). Motivo: só existe uma fonte de verdade (os lançamentos),
então saldo e realidade nunca se contradizem. É o mesmo princípio do saldo geral e de um
extrato bancário — o saldo é consequência dos movimentos, não um número editável à parte.
Custa um pouco mais de processamento, irrelevante para uso pessoal.

**O que foi feito:**
- Criada a tabela `caixinhas` (id, nome) — sem coluna de saldo, de propósito.
- Adicionada a coluna `caixinha_id` na tabela `lancamentos` (a "etiqueta" que liga
  o movimento ao bolso).
- Surgiu um tipo novo de lançamento: `alocacao` (colocar dinheiro numa caixinha).
  Agora são três tipos: `entrada`, `alocacao`, `pagamento`.
- Rotas novas:
  - `POST /caixinhas` — cria uma caixinha (só o nome).
  - `GET /caixinhas` — lista cada caixinha com o saldo calculado na hora
    (soma das alocações menos soma dos pagamentos daquela caixinha).
- `caixinha_id` no modelo é opcional (`int | None`): uma entrada de salário não
  pertence a caixinha nenhuma; um pagamento sai de uma caixinha específica.

**Teste que confirmou o funcionamento:**
Criada caixinha "Contas" (id 1) → alocados R$ 300 (30000) → paga luz R$ 60 (6000)
→ `GET /caixinhas` mostrou saldo **240**. "Paguei a luz com o dinheiro de contas"
virou código. ✅

**Tropeços resolvidos nesta etapa:**
- `Internal Server Error` no `GET /caixinhas` → o banco antigo continuava na pasta com
  a estrutura velha (o `CREATE TABLE IF NOT EXISTS` não altera tabela já existente).
  Solução: apagar o `financeiro.db` e deixar recriar com a estrutura nova.
- Não conseguia deletar `financeiro.db` → o arquivo estava em uso pelo uvicorn.
  Solução: parar o servidor com Ctrl+C antes de deletar (ou renomear o arquivo).
- O "string" que aparece no `/docs` é só um exemplo de preenchimento, não a resposta;
  a resposta real aparece no "Response body" depois do Execute.

---

## Etapa 4 — Transferência entre caixinhas e apagar caixinha  ✅

**Transferência (`POST /transferir`):**
Um movimento que mexe em dois bolsos ao mesmo tempo. Registrado como **dois lançamentos**:
um `pagamento` na origem (dinheiro sai) e uma `alocacao` no destino (dinheiro entra).
Assim o cálculo de saldo das caixinhas não precisou de nenhuma regra nova — cada caixinha
continua sendo a soma dos seus próprios lançamentos. Transferência não cria nem destrói
dinheiro, só muda de bolso; a soma total das caixinhas permanece igual.

Introduzido `HTTPException` (import: `from fastapi import FastAPI, HTTPException`) para
recusar operações inválidas com mensagem clara. Criada também a função auxiliar
`saldo_da_caixinha(con, caixinha_id)` para não repetir o cálculo de saldo.

**Três proteções da transferência (regras de negócio):**
1. Valor precisa ser maior que zero.
2. Origem e destino não podem ser a mesma caixinha.
3. A origem precisa ter saldo suficiente (senão recusa "saldo insuficiente").

**Teste que confirmou:** Contas tinha 240 → transferidos R$ 50 para Lazer →
Contas ficou 190, Lazer subiu 50. (Susto do "190": era só o valor inicial certo ser 240,
não 200 — os dados batiam. Lição: quando o número parece estranho, olhar o
`GET /lancamentos` em vez de entrar em pânico.) ✅

**Apagar caixinha (`DELETE /caixinhas/{caixinha_id}`):**
Decisão: **só apaga caixinha vazia** (sem nenhum lançamento na história), para não deixar
lançamentos órfãos nem estragar o histórico. Se a caixinha tem movimentos, recusa e
orienta a transferir o saldo antes. Encaixa com a transferência: esvazia-se a caixinha
transferindo o saldo, e aí ela fica apagável.

Novidades técnicas: verbo HTTP `@app.delete`, e o id vindo pela URL (`/caixinhas/2`)
em vez de pelo corpo do pedido.

**Teste que confirmou:** duas caixinhas vazias foram apagadas; a Contas (com dinheiro e
histórico) foi recusada. ✅

---

## Etapa 5 — Saldo livre não-alocado (o fecho do base zero)  ✅

**Conceito:** no orçamento base zero, todo dinheiro que entra precisa receber um destino.
O saldo livre é quanto ainda não foi distribuído:

    saldo livre = soma das entradas − soma das alocações

Quando chega a zero, todo real tem propósito → "orçamento fechado".

**O que foi feito:**
- Rota `GET /saldo-livre` que devolve: total de entradas, total alocado, saldo livre,
  e um campo `tudo_distribuido` (verdadeiro quando o saldo livre é zero — será o
  indicador que fica verde no front-end).
- Usa só os tipos `entrada` e `alocacao`; `pagamento` não entra nessa conta (o gasto
  acontece dentro da caixinha, depois que o dinheiro já foi distribuído).

**Teste que confirmou:** salário de R$ 2.000 → saldo livre 2000 → alocado R$ 300 →
saldo livre 1700 → distribuído todo o dinheiro → saldo livre 0 e `tudo_distribuido = true`. ✅

**Ponto a revisitar no futuro (anotado):** a transferência entre caixinhas cria uma
`alocacao` no destino, e o saldo livre soma todas as alocações. Isso significa que uma
transferência infla artificialmente o "alocado" nessa conta. Para o uso atual (salário +
alocações diretas) funciona, mas quando o app crescer talvez seja preciso diferenciar
"alocação vinda de entrada" de "alocação vinda de transferência" (ex.: um tipo próprio
para transferência, ou marcar esses lançamentos).

**Tropeços resolvidos nesta etapa:**
- Erro de sintaxe ao colar a rota → indentação / onde o código cai no arquivo. A rota
  precisa começar colada à margem, depois do fim da função anterior.
- Site "carregando infinito" mesmo com o terminal dizendo "running" → havia um processo
  uvicorn antigo pendurado de reinícios anteriores. Solução: fechar o terminal por
  inteiro (ícone de lixeira) para matar o processo velho, abrir um novo e subir uma vez só.
  (Alternativas: aba anônima, ou `--port 8001`.)

---

## Etapa 6 — Contas / dívidas e pagamento (a Tela 3)  ✅

**Decisão desta etapa — como pagar uma conta:**
Escolhida a opção "pagar já tira da caixinha, tudo num movimento só" (em vez de a conta
ser só um lembrete e o pagamento ser feito à parte). Motivo: uma fonte de verdade, sem
risco de os dois lados discordarem, e é fiel ao popup B da ideia original. É o mesmo
padrão da transferência — um movimento que mexe em dois lugares com checagens antes.

**O que foi feito:**
- Nova tabela `contas` (id, nome, valor_centavos, vencimento, tipo, paga, caixinha_paga_id).
  - `paga INTEGER DEFAULT 0`: o SQLite não tem "sim/não"; usa-se 0 (não) e 1 (sim),
    e `DEFAULT 0` faz toda conta nascer não-paga.
  - `caixinha_paga_id`: vazio no cadastro; preenchido no pagamento (de qual caixinha saiu).
- Rotas:
  - `POST /contas` — cadastra uma conta (nasce não-paga).
  - `GET /contas` — lista as contas (converte 0/1 em falso/verdadeiro com `bool()`).
  - `POST /contas/{conta_id}/pagar` — paga a conta.
- No pagamento, três coisas em sincronia: confere saldo da caixinha → cria lançamento
  de `pagamento` na caixinha (INSERT) → marca a conta como paga e grava a caixinha (UPDATE).
- Comando SQL novo: `UPDATE` (alterar uma linha existente; antes só havia INSERT e SELECT).

**Três proteções do pagamento:**
1. A conta precisa existir (senão 404).
2. A conta não pode já estar paga (senão pagaria duas vezes e tiraria o dobro da caixinha).
3. A caixinha precisa ter saldo suficiente (reusa `saldo_da_caixinha`).

**Testes que confirmaram:** conta de luz (R$ 60) paga a partir de uma caixinha →
conta ficou `paga=true` com `caixinha_paga_id` preenchido, caixinha caiu R$ 60,
pagamento apareceu no histórico. Proteções testadas: pagar de novo recusou,
e pagar sem saldo suficiente recusou. ✅

**Tropeços resolvidos (todos de organização de código — lição sobre estrutura):**
- Tabela nova colada FORA da função `criar_tabelas()` (depois do `con.close()` e da
  chamada da função) → tudo que pertence a uma função precisa estar recuado e antes do
  fim dela; no Python, o recuo define o que está dentro e o que está fora.
- Rota `POST /contas` faltando enquanto `GET /contas` aparecia → a rota não tinha sido
  colada; colar sempre no fim do arquivo, na margem, para não cair dentro de outra função.
- `pagamentoConta` vs `PagamentoConta` → Python diferencia maiúsculas. Convenção:
  classes começam com maiúscula (`PagamentoConta`), funções com minúscula (`pagar_conta`).
- Rota `pagar_conta` sem a linha `@app.post(...)` em cima → a função existia mas o FastAPI
  não a registrava como rota; por isso não dava erro e simplesmente não aparecia no `/docs`.
  A dupla `@app.post(...)` + `def` tem que estar sempre junta.
- Havia um `class NovaConta` duplicado (um certo lá em cima, um sobrando no meio das rotas)
  → removido.

**Arrumações pendentes no `main.py` (anotado para depois, não urgente):**
- A função `saldo_da_caixinha` está definida no meio do arquivo, depois de já ser usada.
  Funciona (as rotas só rodam quando chamadas), mas o ideal é mover as funções auxiliares
  para cima, junto de `conectar`. Organização, não correção.
- Vale reagrupar: todos os modelos (`class ... BaseModel`) juntos, depois as funções
  auxiliares, depois as rotas. Hoje estão um pouco espalhados de tanto colar em etapas.

---

## Pendências / decisões a tomar no futuro
- Diferenciar alocação-de-entrada de alocação-de-transferência no saldo livre.
- Bloquear (ou avisar) saldo negativo em pagamentos avulsos de caixinha (transferência
  e pagamento de conta já checam saldo).
- **Front-end (HTML/CSS/JS)** — a lógica das quatro telas está essencialmente completa
  no back-end; próximo grande passo é dar cara visual a tudo isso.
- Reorganizar o `main.py` (ver arrumações acima).

---

## Etapa 7 — Reorganização do `main.py`  ✅

Sem mudar nenhuma funcionalidade, o arquivo foi arrumado para uma base limpa antes do front-end:
- A função `saldo_da_caixinha` subiu para o topo, junto das funções de apoio, antes de
  qualquer rota usá-la (era a única correção que importava — antes estava definida no meio).
- Blocos reagrupados por assunto, com comentários de seção: funções de apoio → modelos
  (todos juntos) → rotas (gerais, lançamentos, caixinhas, contas).
- `GET /caixinhas` passou a usar `saldo_da_caixinha` em vez de repetir o cálculo.
- Não foi preciso apagar o banco (a estrutura das tabelas não mudou, só a ordem do código).

O `main.py` agora corresponde à ordem mostrada no documento "código comentado".

---

## Etapa 8 — Front-end (as quatro telas)  ✅

**O que foi feito:**
- Criada a página `index.html` (HTML + CSS + JavaScript num arquivo só), na mesma pasta
  do `main.py`.
- Ajuste no `main.py` para o próprio FastAPI servir a página:
  - import: `from fastapi.responses import FileResponse`
  - rota: `@app.get("/app")` que retorna `FileResponse("index.html")`
- O app é acessado em `http://127.0.0.1:8000/app` (um endereço só, tudo no mesmo servidor).
- Quatro abas: Visão geral, Caixinhas, Dívidas, Histórico. Saldo livre em destaque no topo
  (fica verde quando `tudo_distribuido`). Todas as ações (entrada, criar caixinha, guardar,
  transferir, cadastrar conta, pagar, apagar) chamam as rotas da API por trás.

**Detalhe importante:** o usuário digita valores em reais (ex.: 2000,00) e o JavaScript
converte para centavos antes de enviar (`Math.round(valor * 100)`). É a conversão "na borda"
combinada lá no começo: quem usa vê reais, o motor trabalha em centavos.

**Tropeços resolvidos:**
- `Internal Server Error` / "File at path index.html does not exist" → o `index.html` não
  estava na mesma pasta do `main.py`. O `FileResponse` procura o arquivo na pasta onde o
  servidor roda. Solução: criar/colocar o `index.html` junto do `main.py` (aparecendo na
  barra lateral do VS Code ao lado dele).
- Abrir o arquivo `index.html` direto (preview) mostra a página com os dados vazios (—),
  porque assim ela não passa pelo servidor e não busca dados. O jeito certo é acessar
  `http://127.0.0.1:8000/app`, para o pedido passar pelo FastAPI.

---

## Estado do projeto
**App completo e funcionando de ponta a ponta:** back-end (FastAPI + SQLite) organizado e
testado, e front-end (uma página com as quatro telas) consumindo a API. As quatro telas da
ideia original existem e funcionam. O ciclo do orçamento base zero — entrada → distribuir em
caixinhas → pagar contas puxando das caixinhas → histórico — está inteiro e visível na tela.

## Próxima GRANDE etapa planejada — Separação por bancos (Itaú / Nubank)

**A visão:** cada banco funciona quase como um "app dentro do app" — uma tela do Itaú com
as caixinhas do Itaú, uma tela do Nubank com as caixinhas do Nubank. No front-end, as abas
atuais ganhariam um seletor de banco no topo; ao escolher um banco, a tela mostra só as
caixinhas e o saldo daquele banco.

**Modelo escolhido (o mais simples e que bate com o uso real):**
Cada caixinha pertence a UM banco. Não há caixinha com dinheiro espalhado entre bancos —
"Lazer do Nubank" e "Lazer do Itaú" seriam caixinhas separadas. Isso mantém cada real com
um lugar único (está numa caixinha, que pertence a um banco), o que é bem mais fácil de
programar do que o cenário onde uma caixinha se espalha por vários bancos.

**Conceito-chave:** "banco" e "caixinha" respondem perguntas diferentes sobre o mesmo dinheiro.
- Banco = ONDE o dinheiro está (Itaú, Nubank).
- Caixinha = PARA QUE serve (lazer, reserva, contas).
Aqui o banco é o nível de cima e a caixinha o de baixo.

**Mudanças previstas (grandes — tocam quase tudo):**
- Nova tabela `bancos` (Itaú, Nubank).
- Caixinha ganha um campo `banco_id` (a qual banco pertence).
- Contas a pagar poderiam ganhar `banco_id` (por qual banco pago essa conta).
- Entradas (salário) passariam a ter banco (o dinheiro cai em um banco específico).
- Nova operação: transferência ENTRE BANCOS (ex.: Pix/TED do Itaú para o Nubank).
  Parecida com a transferência entre caixinhas, mas de um banco para outro.
- Front-end: seletor de banco no topo; cada tela filtra pelo banco selecionado.

**Perguntas de design a resolver quando começar:**
- O salário cai em qual banco? (entrada com banco)
- Como registrar mover dinheiro de verdade de um banco para o outro?
- As caixinhas atuais (sem banco) — migram para um banco padrão ou recomeço?

**Nota de método:** é a maior mudança do projeto até hoje — não é difícil no conceito
(são etiquetas, somas por grupo e transferências, coisas já dominadas), mas é trabalhosa
porque "de qual banco" atravessa quase todas as tabelas e telas. Fazer com calma, em partes,
testando cada uma — como foi com caixinhas e contas.

---

## Etapa 9 — Contas recorrentes (assinaturas)  ✅

**A necessidade:** assinaturas como Prime Video (R$ 19,90 todo dia 10) que não devem ser
recadastradas na mão todo mês.

**Decisão de design — quem cria a conta a cada mês:**
Como o app roda local (só quando ligado), não dá para gerar "sozinho de verdade" na virada
do mês sem um servidor sempre ligado (isso exigiria hospedagem). Solução escolhida:
o app **gera as contas do mês automaticamente quando é aberto**. Sem clique — basta abrir
o app pelo menos uma vez no mês. É o mais próximo de "aparece sozinha" possível num app local.

**O que foi feito:**
- Nova tabela `recorrentes` (nome, valor_centavos, dia_vencimento, tipo) — é o "molde" da
  assinatura. Não tem campo "paga": o que se paga é a conta gerada a partir dela, na tabela `contas`.
- Import novo: `from datetime import date` (para saber o mês/ano atual).
- Função `gerar_recorrentes_do_mes()`: para cada recorrente, monta o vencimento do mês atual
  (`ano-mes-dia`) e cria a conta — mas só se ainda não existir uma conta com aquele nome e
  vencimento. Essa checagem "já existe neste mês?" é o que impede duplicar.
- A geração é chamada no início da rota `GET /contas`, que roda toda vez que o app carrega —
  por isso as contas aparecem sozinhas ao abrir.
- Rotas `POST /recorrentes` e `GET /recorrentes` para cadastrar e listar os moldes.

**Teste que confirmou:** Prime Video cadastrada como recorrente → apareceu sozinha na aba
Dívidas com vencimento no dia 10 → recarregar várias vezes NÃO duplicou. ✅

**Lição:** o padrão "verificar antes de criar" (checar se já existe antes de inserir) é o que
torna a geração segura mesmo rodando muitas vezes. Mesma ideia do susto dos 3 salários no começo.

---

## Etapa 10 — Tema escuro e visual de dashboard  ✅
Reformulação do `index.html`: tema escuro com roxo/violeta, menu lateral (no lugar das abas
de topo), cards de resumo grandes no topo, e uma pizza de distribuição das caixinhas
(biblioteca Chart.js, carregada da internet — o gráfico precisa de internet, o resto não).
Decisão honesta: NÃO foi incluído o gráfico de evolução por mês nem "% vs mês anterior",
porque dependem de dados por mês que o app ainda não agrupa — seria enfeite sem dado real.

## Etapa 11 — Correções e saídas  ✅
- Apagar lançamento (`DELETE /lancamentos/{id}`) e desfazer pagamento de conta
  (`POST /contas/{id}/desfazer-pagamento`) — corrigir erros. Saldos se recalculam sozinhos
  (Método 2). Fragilidade anotada: desfazer acha o pagamento por caixinha+valor; com dois
  pagamentos idênticos, pega o mais recente.
- Apagar assinatura/recorrente (`DELETE /recorrentes/{id}`) — apaga só o molde; contas já
  geradas continuam (decisão do usuário).
- Dois botões de saída na aba Caixinhas: "Gastar de caixinha" (pagamento de uma caixinha,
  sem criar conta) e "Tirar do saldo livre" (tipo novo `saida_livre`). O saldo livre passou
  a descontar as saídas livres: entradas − alocações − saidas_livres.

## Etapa 12 — Separação por bancos  ✅
- Modelo: cada caixinha pertence a UM banco. Bancos criáveis/apagáveis livremente.
- **Migração de dados reais** (primeira vez que mexemos com dados que não eram teste):
  backup do `financeiro.db` feito ANTES; coluna `banco_id` adicionada às caixinhas via
  `ALTER TABLE` só se não existir (função `migrar()`, testada: preserva dados, idempotente).
- Tabela `bancos`; rotas criar/listar/apagar banco (apagar só banco sem caixinhas).
- Rota `POST /caixinhas/{id}/mover` para colocar caixinha num banco. Criar caixinha passou
  a exigir `banco_id`.
- Front: seletor de banco no topo; escolher o banco filtra as caixinhas e a pizza daquele
  banco. Escopo escolhido: **Opção 1** — só as caixinhas por banco (contas, entradas e saldo
  livre continuam gerais). Painel "Meus bancos" na aba Caixinhas.

## Etapa 13 — Login completo (senha + sessão)  ✅
- Motivo: passo pedido pelo usuário rumo a acessar de fora. Decidido: uma senha só (é o
  próprio usuário acessando de vários lugares, não vários usuários com dinheiro separado).
- Bibliotecas novas: `bcrypt` (hash de senha) e `python-jose` (token JWT).
  Instalação: `python -m pip install bcrypt "python-jose[cryptography]"`.
  (Obs.: a `passlib` deu conflito com o bcrypt novo; usamos o `bcrypt` direto.)
- Peças: tabela `config` guarda o hash da senha (nunca o texto); rotas `/auth/status`,
  `/auth/definir-senha`, `/auth/login`; as 19 rotas de dados exigem token
  (`Depends(exigir_login)`); token válido por 30 dias.
- Front: tela de login sobreposta. Primeiro acesso mostra "criar senha"; depois pede senha.
  Botão "Sair" no menu. Token guardado em memória e enviado em toda requisição.
- Testado: senha certa/errada, token válido/falso/expirado, rotas recusam sem token (401).
- **CHAVE_SECRETA** no `main.py` está com valor de exemplo — trocar por texto aleatório
  longo se um dia for expor. Sem "recuperar senha": se esquecer, resetar apagando o registro
  no banco. Guardar a senha em lugar seguro.
- **Aviso importante:** o login protege o acesso, mas NÃO basta para expor na internet 24h
  (faltam conexão criptografada/HTTPS, proteção contra tentativas repetidas, etc.). Uso
  segue local por enquanto.

## Etapa 14 — Rodar sem o VS Code (atalho .bat)  ✅
- O servidor não depende do VS Code (o VS Code é só o editor). Rodando pelo `MeuOrcamento.bat`,
  o servidor vive numa janela própria e o VS Code pode ser fechado.
- Problema resolvido: o caminho `D:\PROGRAMAÇÃO\Financeiro` tem acento, e o `.bat` não lidava
  bem com isso. Solução: pôr o `.bat` DENTRO da pasta do projeto e usar `cd /d "%~dp0"`
  (a pasta do próprio .bat), evitando escrever o caminho com acento.
- `.bat` final: sobe o servidor com `start ""`, espera alguns segundos, abre o navegador.
  A janela preta precisa ficar aberta (pode minimizar) enquanto usa; fechar = desligar.

## Etapa 15 — Tabela de dívidas com status + refino visual  ✅

Inspiração: um design do Figma (produto "FINVEXYS", que na verdade era um sistema financeiro
EMPRESARIAL — com CNPJ, usuários, suporte, etc.). Decisão consciente: **manter o app pessoal**
e pegar só o capricho visual, sem trazer as telas empresariais (que não teriam função aqui).

- Tela de Dívidas virou uma **tabela** (descrição, vencimento, valor, status), no estilo da
  tela de "Boletos" do design.
- **Status colorido calculado pela data de vencimento** (função `statusConta` no front):
  Pago (verde), Vencido/Hoje (vermelho), vence em ≤5 dias mostra a contagem (amarelo),
  resto "A vencer". Isso entregou de brinde o "alerta de vencimento" que estava nas ideias.
- Contas ordenadas pelas que vencem primeiro.
- Refino visual: listra roxa na lateral dos cards do topo.
- Só mexeu no `index.html`; o back-end já mandava tudo (inclusive o `vencimento`).
- Ressalva: contas antigas SEM data de vencimento aparecem como "A vencer" (não dá pra
  calcular status sem data); as novas, com data, funcionam certinho.

---

## Pensamentos para o futuro (registrados — não decididos)

Três ideias conectadas entre si (uma depende da outra):

**1. Usar longe de casa.**
- Via túnel seguro: resolve sem nuvem, gratuito, dados no PC — mas PC precisa ligado e
  NÃO serve para o WhatsApp (o app não fica publicamente acessível).
- Via nuvem: resolve e serve para o WhatsApp também. É o caminho maior.

**2. Nuvem 24h (pré-requisito dos outros dois).**
- Empreitada grande: preparar app, trocar SQLite por banco de nuvem (ex.: PostgreSQL),
  escolher serviço, configurar HTTPS, segurança (limitar tentativas de senha), manutenção.
- Com dados financeiros: estudar segurança a fundo ANTES. Planos gratuitos costumam "dormir"
  e/ou não guardar dados de forma permanente (risco de perder dados).

**3. Integrar WhatsApp (lançar gastos por mensagem).** — a mais ambiciosa e espinhosa:
- Depende da nuvem (o WhatsApp precisa alcançar o app num endereço público → túnel não serve).
- WhatsApp não permite conexão livre: a via oficial é a **API do WhatsApp Business**, com
  processo de aprovação e normalmente custo. Vias não-oficiais violam os termos e podem
  ser derrubadas a qualquer momento — não confiável.
- Precisa "entender" a mensagem (ex.: "gastei 40 no mercado" → lançamento estruturado):
  um mini-projeto de interpretação de texto à parte.
- Conclusão honesta: parece simples, é o mais complexo do projeto. Encarar só bem no futuro,
  com o resto maduro, ciente de limitações que não dependem de nós (regras do WhatsApp).

**Ordem natural se for encarar:** nuvem primeiro → usar longe de casa (vem junto) →
WhatsApp por último. Nenhum é impossível; todos são grandes, o WhatsApp especialmente.

---

## Etapa 16 — Apagar dívida, Editar dívida, Visão geral de bancos  ✅ (feito na máquina)

Três mudanças construídas e TESTADAS na máquina (as "rápidas" do roteiro):

- **A — Apagar dívida:** `DELETE /contas/{id}` (recusa conta paga → usar "desfazer" antes).
  Botão "Apagar" nas dívidas não-pagas, com confirmação (`confirm()`) antes.
- **B — Editar dívida:** `PUT /contas/{id}` (recusa conta paga). Botão "Editar" abre os
  campos via `prompt()` (nome, valor, vencimento, tipo) preenchidos com os valores atuais.
  Nota: usei prompt por simplicidade; a tela será reformulada na fatura detalhada (D), aí
  dá pra deixar mais elegante.
- **C — Visão geral de todos os bancos:** opção "Todos" no seletor (padrão ao abrir).
  No modo "Todos": caixinhas de todos os bancos juntas com etiqueta do banco; card "Guardado"
  soma tudo; painel "Dinheiro por banco" com barras de proporção + %. Escolher um banco
  específico volta a filtrar só ele. Bate com a maquete aprovada.

Aprendizado da sessão: o "not found" ao apagar era o `.bat` rodando um main.py
desatualizado/de outra pasta (servidor no ar ≠ arquivo editado). Sintoma diagnóstico:
a rota nova não aparece no `/docs`. Passou a rodar pelo VS Code com `uvicorn --reload`
durante a construção (recarrega sozinho ao salvar).

Faltam do roteiro: D (fatura detalhada ⚠), F (histórico ⚠), E (ícones, polimento).

---

## ROTEIRO DE EXECUÇÃO (checklist para quando estiver na máquina)

**Visão geral de tudo que está planejado (ordem recomendada):**
- A — Apagar dívida (rápida)
- B — Editar dívida (rápida)
- C — Visão geral de todos os bancos (média, visual já aprovado)
- F1 — Data nos lançamentos (⚠ fundação do histórico; backup antes)
- D — Fatura detalhada (GRANDE, ⚠ várias sessões; backup antes)
- F2/F3/F4 — Histórico: visual, filtros, análise (dependem de F1)
- E — Padronização de ícones (polimento visual, POR ÚLTIMO)

Sugestão de bom senso: fazer as rápidas primeiro (A, B, C) para ganhar ritmo; depois usar
o app um tempo para sentir o que realmente importa antes de encarar as grandes (D e F).
Não tentar fazer tudo de uma vez — são muitos blocos. Um bloco por vez, testar, seguir.

Regra geral: fazer UM bloco por vez, testar o "como testar", só então ir ao próximo.
Antes de qualquer bloco que mexa em estrutura de dados (marcados com ⚠): fazer BACKUP do
financeiro.db (copiar/colar o arquivo na pasta).

### MUDANÇA A — Apagar dívida (rápida, sem mexer em estrutura)
- Bloco A1: rota `DELETE /contas/{id}` (só apaga dívida NÃO-paga) + botão na tela de dívidas.
  - Como testar: cadastrar dívida de teste → apagar → some da lista. Tentar apagar uma paga
    → recusa (ou botão nem aparece). Backup não é necessário (não muda estrutura).

### MUDANÇA B — Editar dívida (rápida, sem mexer em estrutura)
- Bloco B1: rota de edição (`PUT /contas/{id}`, só NÃO-pagas) + formulário de edição no front.
  - Como testar: editar nome/valor/vencimento de uma dívida pendente → muda certo. Conta
    paga não é editável. Backup não é necessário.

### MUDANÇA C — Visão geral de todos os bancos (média)
- Bloco C1: opção "Todos" no seletor de banco (ou visão no dashboard) que soma todos os
  bancos: total geral + quanto em cada banco.
  - Como testar: escolher "Todos" → ver soma de todas as caixinhas de todos os bancos e o
    total por banco. Escolher um banco → volta a filtrar só ele. Backup não é necessário.
  - **Visual aprovado (maquete de 13/07):** seletor de banco com opção "Todos". Ao escolher
    "Todos": os 4 cards do topo passam a SOMAR todos os bancos (total geral, saldo livre,
    guardado, contas a pagar); aparecem 2 painéis — "Dinheiro por banco" (barra de proporção
    + % por banco) e "Caixinhas (todos os bancos)" (lista com etiqueta do banco em cada uma).
    Escolher um banco específico volta a filtrar só ele. Tudo com dados que o app já tem.
    Decisão a tomar ao construir: "Todos" como opção no próprio seletor (mais elegante) vs.
    tela/aba separada.

### MUDANÇA D — Fatura detalhada (GRANDE, várias sessões, ⚠ mexe em estrutura)
⚠ FAZER BACKUP do financeiro.db ANTES de começar o bloco D1.
- Bloco D1 ⚠: adicionar campo `tipo_conta` (simples/fatura) na tabela contas + criar tabela
  de itens de fatura. Via migração (ALTER TABLE só se não existir), preservando dados.
  - Como testar: abrir o app → dados antigos intactos (GET /contas normal). Contas antigas
    assumem "simples". Sem erro ao subir.
- Bloco D2: cadastrar conta escolhendo o tipo (simples ou fatura). Fatura nasce com total 0.
  - Como testar: criar uma conta "simples" (funciona como hoje) e uma "fatura" (nasce zerada).
- Bloco D3: adicionar item à fatura; total da fatura = soma dos itens.
  - Como testar: na fatura, adicionar item R$80 → total 80; adicionar R$20 → total 100.
- Bloco D4: tela de dívidas mostra a fatura expansível (clicar → ver os itens dentro).
  - Como testar: clicar na fatura → lista de itens aparece; conta simples continua linha única.
- Bloco D5: pagar a fatura do mês inteira; virada de mês cria fatura nova vazia (histórico
  do mês anterior preservado).
  - Como testar: pagar a fatura → fica paga com os itens registrados; no mês seguinte, fatura
    nova zerada; a antiga continua consultável.

- ✅ D CONCLUÍDO (16/07/2026, Claude Code) — mexeu em `main.py` E `index.html`.
  - Estrutura: coluna `contas.tipo_conta` ('simples' DEFAULT / 'fatura') via migração
    idempotente; nova tabela `fatura_itens` (conta_id, descricao, valor_centavos, data).
  - Back-end: `total_conta()` (fatura = soma dos itens; simples = valor guardado). Conta fatura
    nasce com valor 0. `GET /contas` devolve `tipo_conta`, total calculado e `qtd_itens`.
    Rotas de item: `GET/POST /contas/{id}/itens`, `DELETE /contas/{id}/itens/{item_id}`.
    `pagar_conta` e `desfazer_pagamento` usam o total (fatura). Pagar fatura vazia é recusado;
    adicionar/apagar item em fatura paga é recusado. Apagar a fatura apaga os itens junto.
  - Front-end: cadastro tem seletor "Tipo de conta" (some o campo Valor na fatura). Na tela de
    Dívidas, fatura vira LINHA EXPANSÍVEL (seta ▸/▾ + etiqueta "fatura" + nº de gastos); ao abrir,
    lista os itens, mostra o total e (se não paga) um mini-formulário "Adicionar gasto". Fatura
    paga fica só-leitura. `recarregarMantendoFatura` mantém o painel aberto após add/remover item.
  - Testado: back-end 9 casos (migração, itens, proteções, pagar/desfazer, apagar cascata) +
    front-end (criar fatura, expandir, 2 gastos=R$100, pagar → caixinha −100, só-leitura após paga).
  - DECISÃO DE ESCOPO: a virada AUTOMÁTICA de mês (gerar fatura nova sozinha) NÃO foi feita —
    faturas são criadas por mês manualmente (ex.: "Fatura Nubank Julho"). O histórico por mês
    funciona (cada fatura é uma conta separada). Auto-geração fica como refinamento futuro.

---

## Etapa 17 — Data no lançamento + Histórico por mês + Metas nas caixinhas  ✅ (04/08/2026, Claude Code)

Três melhorias, feitas e testadas juntas (back-end + front, entregues numa leva). ⚠ teve migração (backup antes).

**1. Escolher a data do lançamento.** Antes todo lançamento novo usava "hoje" (F1). Agora os 4 formulários
manuais (entrada, guardar, gastar de caixinha, tirar do saldo livre) têm um campo **Data (opcional)** —
em branco = hoje. `NovoLancamento` ganhou `data: str | None`; `criar_lancamento` usa `item.data or hoje`.
Transferência e pagar conta seguem automáticos. Sem migração (coluna `data` já existia). Testado:
data escolhida grava certo, sem data cai em hoje.

**2. Histórico agrupado por mês.** Escolhido "cabeçalho de mês + resumo". Agora o histórico tem um
divisor por mês ("JULHO 2026") com um mini-resumo à direita (**+ entradas  − saídas** daquele mês), e os
dias (Hoje/Ontem/data) aninhados dentro. Só `index.html`. Helper `rotuloMes` (AAAA-MM → "JULHO 2026");
`renderHistorico` agrupa por mês → por dia; resumo do mês = entradas e (pagamentos não-transferência +
saídas livres), mesma lógica da Análise. Grupo "Registros antigos (sem data)" continua no fim. Testado com
2 meses: Agosto +2500/−90, Julho +2000/−150.

**3. Metas nas caixinhas.** Cada caixinha ganha uma **meta opcional** (valor-alvo). ⚠ migração: coluna
`caixinhas.meta_centavos` (DEFAULT 0). `NovaCaixinha` aceita `meta_centavos`; `GET /caixinhas` devolve
`meta_reais` (null se 0); nova rota `POST /caixinhas/{id}/meta` pra definir/alterar/remover (0 = remover).
Front: campo "Meta (R$)" ao criar, e na lista de caixinhas uma **barra de progresso** (saldo/meta, %),
com botão "Definir meta" (ícone alvo, via prompt). Só a aba Caixinhas mostra a barra (dashboard fica
limpo). Testado: migração de caixinha antiga (meta=None), criar com meta, alterar, remover, barra 300/1000=30%.

Backups datados em `backups/v7base_2026-07-21_antes-mes-metas-data`.

---

## Etapa 18 — Categorias gerenciáveis (tela nova)  ✅ (04/08/2026, Claude Code)

Antes as categorias de conta (Conta fixa / Cartão / Outros) eram fixas no HTML. Agora são gerenciáveis.
Escopo confirmado com o Renan: gerenciar só as CATEGORIAS (o rótulo `tipo` das contas); o "Tipo de conta"
(Simples/Fatura) continua fixo por ser estrutural. Remoção permitida mesmo em uso (contas antigas mantêm o
texto do rótulo — o campo é só string, sem FK).

- Back-end: nova tabela `categorias` (id, nome). Semeadas 3 padrão UMA vez (flag `config.categorias_iniciadas`,
  pra não recriar se o usuário apagar todas). Rotas `GET/POST/DELETE /categorias`. POST valida nome não-vazio e
  bloqueia duplicata (case-insensitive). DELETE remove mesmo em uso.
- Front: nova tela "Categorias" no menu (ícone tag) com lista (apagar) + form de adicionar. Os dropdowns de
  categoria do cadastro de CONTA (`ct-tipo`) e de ASSINATURA (`r-tipo`) passam a ser preenchidos por
  `carregarCategorias()` (não mais hard-coded). `carregarCategorias` entrou no `carregarTudo`.
- Nota cosmética: contas criadas ANTES têm `tipo` nos valores antigos ("fixa"/"cartao"/"outro"); as novas usam
  os nomes das categorias ("Conta fixa"/"Cartão"/"Outros"). Sem problema funcional (o `tipo` é só rótulo).
- Testado (back + navegador): seed das 3, criar, duplicata bloqueada, vazio bloqueado, apagar; dropdowns de
  conta e assinatura puxando das categorias; criar conta com categoria nova grava o rótulo; apagar categoria
  some do dropdown e a conta antiga mantém o rótulo.

Backup em `backups/v8base_2026-08-04_antes-categorias`.

---

## Etapa 19 — Principais gastos do mês na Análise  ✅ (05/08/2026, Claude Code)

Só `index.html`. No painel "Resumo do mês" (aba Análise) havia um espaço vazio; agora mostra a lista
"Principais gastos do mês": top 5 gastos do mês atual agrupados por DESCRIÇÃO (soma descrições iguais),
do maior pro menor. Complementa o painel da direita (que agrupa por CAIXINHA) — aqui é "no que" gastou.
Considera pagamentos (não-transferência) + saídas livres; ignora alocações e transferências. Div
`#an-principais` abaixo de `#an-insight`; lógica dentro de `carregarAnalise`. Testado: Faculdade 490,
Mercado 200 (somou 120+80), Saque 100, Uber 50, Cinema 40 — ordenado e correto.

Backup em `backups/v9base_2026-08-05_antes-principais-gastos`.

---

## Pendência — Validações de entrada (blindagem) [anotado 04/08/2026]

Fechar buracos de validação antes de expor pra mais gente (importa muito no multi-usuário). Estado ATUAL
conferido no código:

1. **Saldo negativo.** JÁ travado: `transferir` (recusa "saldo insuficiente") e `pagar_conta` (checa saldo).
   FALTA: o **"gastar de caixinha" avulso** (POST /lancamentos tipo=pagamento) NÃO checa saldo — deixa a
   caixinha ficar negativa. Decidir: travar (recusar) ou só avisar. (Já estava numa pendência antiga do topo
   do diário — "Bloquear/avisar saldo negativo em pagamentos avulsos de caixinha".) Ver também "tirar do saldo
   livre", que pode deixar o saldo livre negativo.
2. **Valor zero ou negativo.** JÁ validam `> 0`: transferência e itens de fatura. FALTA validar em
   `criar_lancamento` (entrada/guardar/gastar/saida_livre) e em `criar_conta` — hoje aceitam 0 e negativos.
   Travar no back-end (recusar com mensagem clara) e reforçar no front (min="0.01" nos campos).
3. **Datas inconsistentes.** Nenhuma validação hoje: `vencimento` (contas) e `data` (lançamentos, da Etapa 17)
   aceitam qualquer coisa (ex.: ano 1990 por engano). Adicionar sanidade simples: recusar datas fora de um
   intervalo razoável (ex.: entre 2000 e ano atual + alguns anos) e/ou formato AAAA-MM-DD válido.

Tamanho: pequeno/médio, só back-end + um reforço no front. Sem migração. A regra do app é sempre validar no
BACK-END (fonte da verdade); o front é só conveniência. Construir junto quando encarar a blindagem/multi-usuário.

---

## Próxima etapa planejada — "Mover conta para a fatura" (assinatura no cartão) [DESENHO CONFIRMADO 21/07/2026]

Necessidade real: assinaturas/contas que são cobradas no cartão devem entrar na FATURA do cartão
(somando), em vez de ficarem como conta avulsa separada. Ex.: fatura tem R$ 30, a Prime (R$ 19,90)
entra na fatura → vira R$ 49,90. Escolhido o caminho MANUAL (mais simples e flexível) em vez da
automação, pra o usuário poder escolher em qual cartão vincular a cada mês.

**Comportamento confirmado (mês a mês):**
- A assinatura continua nascendo automaticamente todo mês (recorrente, como já é).
- Ação nova "mover conta para uma fatura": ao adicionar a conta numa fatura, ela SAI da lista de
  contas a pagar NA HORA (vira item da fatura; nunca conta duas vezes).
- Pagar a fatura resolve tudo.
- No mês seguinte a assinatura REAPARECE como uma conta nova, SEM vínculo — o usuário decide de novo
  (mesmo cartão, outro cartão, ou pagar avulsa).

**Não precisa** da virada de mês automática nem de flag "cartão" na assinatura. É só a ação de mover.

**Detalhe de implementação (cuidar):** ao "mover" a conta pra fatura, NÃO apagar de vez — senão a
geração de recorrentes (`gerar_recorrentes_do_mes`, que dedupa por nome+vencimento) recria a conta se
o app reabrir no mesmo mês. Solução: marcar a conta como "movida" (ex.: coluna `movida` ou
`fatura_destino_id`), escondê-la da lista de pendências e do total "a pagar", mas mantê-la no banco
pra a dedup do mês continuar funcionando. Mês novo = vencimento novo = conta nova gerada normalmente.

**Provável desenho técnico:** rota `POST /contas/{id}/mover-para-fatura` {fatura_id} → valida (conta
não paga, não é fatura; fatura existe, é fatura, não paga) → cria `fatura_item` com nome+valor+data da
conta → marca a conta como movida. Front: botão/seletor "mover para fatura" na conta avulsa. ⚠ migração
(coluna nova) + backup. Ainda NÃO construído — construir depois do Renan testar um mês no manual.

Ordem recomendada: A → B → C → (usar um tempo) → D em blocos. Não misturar D com as outras
no mesmo dia. Depois de cada mudança concluída, atualizar este diário.

### Decisões de interface (tomadas via maquetes, 13/07)
- **Fatura fica DENTRO de Dívidas** (não em tela separada), como linha expansível: a fatura
  (cartão) tem etiqueta "fatura" + setinha; clicar abre os itens dentro (com "Adicionar
  gasto" e o total). Conta simples continua linha única. Confirmado pelo usuário.
- **Ações de cada conta = Opção 2 (ícones pequenos à mostra):** "Pagar" como botão + lápis
  (editar) e lixeira (apagar) como ícones discretos ao lado. Escolhido por equilibrar
  visibilidade e espaço (importa no celular). Vale para as mudanças A (apagar) e B (editar).
- **MUDANÇA E (polimento visual, fazer POR ÚLTIMO, depois de A/B/C/D):** padronizar ícones
  pelo app — mesmos ícones de editar/apagar em todo lugar (caixinha, lançamento, assinatura),
  ícones no menu lateral, ícones de entrada/saída no histórico. Critério: ícone nas AÇÕES e
  na NAVEGAÇÃO, não em títulos/valores (evitar poluir). Requer uma biblioteca de ícones
  (vem da internet, como o Chart.js — depende de internet, +1 linha no topo). É só refino
  visual, não muda função. Fazer como última camada.
  - ✅ CONCLUÍDA (16/07/2026, Claude Code). Só `index.html`. DECISÃO MELHOR que o plano: em vez
    de biblioteca via CDN (dependência de internet), usei **ícones SVG embutidos** no próprio
    arquivo (paths estilo Lucide/MIT) — consistentes, no tema, e funcionam OFFLINE. Helper
    `ico(nome, size)` + dicionário `ICONES`. Menu lateral com ícones (via data-ico, populado no
    load). Badge do histórico usa `ico()` (entrada=seta baixo, saída=seta cima, caixinha=carteira,
    transferência=setas). Botões Editar (lápis) e Apagar (lixeira) viraram ícones com tooltip
    (title) em TODO lugar: contas, caixinhas, bancos, assinaturas, itens de fatura, lançamentos.
    "Pagar"/"Desfazer" continuam com texto (clareza). Testado no navegador: 6 ícones no menu,
    badges e botões renderizando SVG, nenhum botão de texto sobrando, zero erro no console.

### MUDANÇA F — Histórico melhorado (várias frentes, ⚠ uma mexe em estrutura)
Motivo: usuário achou o histórico atual simples demais. Quer as 4 frentes: visual, filtros/
busca, mais informação (data), e análise. ELAS TÊM DEPENDÊNCIA — fazer na ordem abaixo.

- Bloco F1 ⚠ (FUNDAÇÃO, backup antes): passar a gravar DATA em cada lançamento novo
  (coluna `data` na tabela lancamentos, via migração preservando dados). Pegadinha honesta:
  lançamentos ANTIGOS ficam sem data (não dá pra inventar quando aconteceram) — aparecem
  como "registro antigo/sem data". Só os novos terão data.
  - Como testar: registrar algo novo → tem data; antigos → sem data, sem quebrar.
  - ✅ CONCLUÍDA (16/07/2026, feita no Claude Code). Coluna `data TEXT` adicionada via
    `migrar()` (idempotente). Helper `data_hoje()` (AAAA-MM-DD). Gravam data: criar_lancamento,
    transferir (2 lançamentos) e pagar_conta. `GET /lancamentos` devolve `data` (None nos
    antigos). Testado com banco antigo real (migração não quebrou, antigo=None, novos=data de
    hoje, transferência e pagamento com data, migrar() 2x sem erro). Só mudou o `main.py`;
    `index.html` inalterado (o visual do histórico é a F2).
- Bloco F2 (visual): ícones por tipo de movimento, cores, agrupar por dia (usa a data).
  - Como testar: histórico agrupado por dia, com visual mais rico.
  - ✅ CONCLUÍDA (16/07/2026, Claude Code). Só `index.html`. Histórico agrupado por dia
    (cabeçalho "Hoje"/"Ontem"/data por extenso via `rotuloDia`), grupo à parte "Registros
    antigos (sem data)" no fim para lançamentos com data=null. Cada movimento com ícone
    circular colorido (`.ico-circ`) por tipo via `visualLanc`: ↓ verde entrada, ▣ roxo
    guardado (alocação), ↑ vermelho saída (pagamento/gasto/saida_livre), ⇄ roxo transferência
    (detectada pela descrição). Cor/sinal no valor (+verde / −vermelho / roxo). Dentro do dia,
    mais novo primeiro. Testado no navegador com datas variadas (hoje/ontem/antiga/sem data,
    transferência) — 4 grupos e 9 movimentos renderizaram certo; CSS do círculo confirmado.
- Bloco F3 (filtros e busca): filtrar por tipo (entrada/saída/etc.), por caixinha, por
  período; campo de busca.
  - Como testar: aplicar cada filtro → lista reduz ao esperado.
  - ✅ CONCLUÍDA (16/07/2026, Claude Code). Só `index.html`. Barra com chips Tudo/Entradas/
    Saídas/Caixinhas + campo de busca por descrição. Estado em `filtroHist`/`buscaHist`;
    `carregarHistorico` guarda tudo em `HIST` e `renderHistorico()` aplica filtro+busca e
    reagrupa (F2). `categoriaLanc`: entrada→entradas, alocação→caixinhas, pagamento/saida_livre
    →saidas, transferência (por descrição)→caixinhas. Mensagem própria quando nada casa.
    Testado no navegador: tudo=9, entradas=3, saidas=3, caixinhas=3, busca isolada e combinada
    com filtro, e estado vazio — todos corretos. (Escopo entregue: filtro por tipo + busca; o
    "por caixinha/por período" do plano original fica para F4/refino se quiser.)
- Bloco F4 (análise): totais e insights ("entrou X, saiu Y no mês"). O mais complexo;
  brilha só com meses de dados acumulados. Deixar por último (ou adiar).
  - ✅ CONCLUÍDA (16/07/2026, Claude Code). Só `index.html`. Nova tela "Análise" no menu
    (`carregarAnalise`, chamada no `carregarTudo`). Filtra lançamentos do mês atual pela `data`
    (prefixo AAAA-MM). Cards: Entrou (soma entradas), Saiu (pagamentos não-transferência +
    saidas_livres), Sobrou. Insight: % gasto do que entrou, com barra e cor (verde/amarelo/
    vermelho; alerta se >100%). "Para onde foi o dinheiro": gastos do mês por caixinha +
    saídas livres, barras com %. Transferências e meses anteriores são excluídos. Testado no
    navegador: entrou=2500, saiu=150 (transferência e mês passado fora), sobrou=2350, 6% gasto,
    ranking de gastos correto.

Ordem interna obrigatória: F1 (data) → F2 → F3 → F4. Sem a data (F1), F2/F3/F4 não se
sustentam.

**Visual aprovado (maquete 13/07):** histórico agrupado por dia ("Hoje", "Ontem", ...),
cada movimento com ícone circular colorido por tipo (entrada = seta verde p/ baixo, saída =
seta vermelha p/ cima, caixinha = carteira roxa, conta = ícone de fatura) + cor no valor
(+verde / −vermelho / roxo). Barra de filtros no topo (Tudo / Entradas / Saídas / Caixinhas)
+ busca. Registros antigos sem data ficam num grupo à parte ("Registros antigos (sem data)").

---

## Próxima GRANDE etapa planejada — Contas tipo "fatura detalhada" (cartão)

Origem: necessidade real do usuário — gastar mais no cartão e ACUMULAR na conta existente
(ex.: fatura de R$80 vira R$100), vendo cada gasto, sem pagar nem criar conta nova.
Escolhido o caminho mais completo (fatura detalhada), ciente de ser a maior mudança do app
até hoje (maior que bancos e login).

**Decisões de design já tomadas:**
- **Dois tipos de conta**, escolhidos no cadastro:
  - "Conta simples" — valor único (luz, água). É como funciona hoje; não muda.
  - "Fatura" — acumula ITENS (cartão). O valor é a SOMA dos itens, não digitado.
- **Fatura por mês, com histórico** (o mais fiel): cada mês tem sua própria fatura do
  cartão com seus itens. Ao virar o mês, nasce uma fatura nova vazia; a antiga fica
  registrada (paga ou não). Permite ver "gastos do cartão em junho vs julho".
- Adicionar gasto = adicionar item à fatura do mês (total cresce sozinho).
- Pagar = quita a fatura do mês inteira de uma vez.

**Estrutura provável (a detalhar ao construir):**
- Conta ganha um campo "tipo_conta" (simples/fatura).
- Tabela nova para os ITENS da fatura (relação um-para-muitos: uma fatura tem vários itens:
  descrição, valor, data, ligação com a fatura/mês).
- Para faturas: o valor exibido é a soma dos itens do mês; a tela de dívidas mostra a
  fatura expansível (clicar → ver os itens).
- Requer BACKUP do financeiro.db + MIGRAÇÃO (não recriar o banco), como nos bancos.

**Como construir (em blocos, testando cada um — há dados reais):**
1. Campo tipo_conta + tabela de itens (migração, preservando dados).
2. Adicionar item à fatura / total somado dos itens.
3. Tela de dívidas: fatura expansível mostrando os itens.
4. Pagar fatura do mês; virada de mês criando fatura nova.
5. Ajustes de front e testes de cada parte.

Obs.: planejado fora da máquina. É uma sequência de VÁRIAS sessões, não uma tacada só.

---

## Próximas mudanças planejadas (decididas, faltam construir/testar na máquina)

**1. Apagar dívida.** Lacuna: dá pra apagar caixinha/lançamento/assinatura, mas não uma
dívida cadastrada por engano. Decisão: permitir apagar só dívida NÃO-paga (para desfazer
uma paga, usar o "desfazer pagamento" que já existe). Rota `DELETE /contas/{id}` + botão.

**2. Editar dívida.** Corrigir nome/valor/vencimento/tipo sem apagar e recriar. Decisão:
só editar dívidas NÃO-pagas (não mexer no que já aconteceu). Precisa de rota de edição
(ex.: `PUT /contas/{id}`) + um formulário de edição no front.

**3. Visão geral de todos os bancos.** A que mais agrega. Hoje o seletor mostra um banco
por vez; falta a "visão de cima" do dinheiro inteiro. Somaria: total geral em todos os
bancos + quanto em cada banco. A decidir na hora: vira uma opção "Todos" no seletor de
banco, ou um lugar próprio (ex.: no dashboard).

**Sobre "caixinha de dívidas":** provavelmente já resolvido — basta criar uma caixinha
comum chamada "Contas"/"Dívidas" e pagar as contas puxando dela (fluxo que já existe).
Confirmar com o usuário se isso cobre, ou se ele quer algo especial (caixinha que se liga
automaticamente às contas).

Obs.: planejado fora da máquina; construir e TESTAR cada uma quando estiver no PC
(há dados reais — testar é essencial).

---

## Decisão consciente — entrada de dinheiro fica "geral" (sem banco)

Notado no uso: a entrada de dinheiro não pertence a um banco (fica geral), enquanto as
caixinhas pertencem a bancos. É consequência da Opção 1 (só caixinhas por banco).
Avaliado e **decidido manter assim de propósito** — não é esquecimento.

Motivo: dar banco à entrada obrigaria a repensar o saldo livre (viraria saldo livre POR
banco) e a distribuição (só guardar no banco X o que entrou no banco X) = avançar para a
Opção 2/3, bastante complexidade. Como não atrapalha o uso real, não compensa corrigir.
Lição: nem toda inconsistência precisa de correção; se não atrapalha, corrigir pode custar
mais do que vale. Forma de enxergar sem estranhar: a entrada é "dinheiro que chegou"; a
distribuição em caixinhas (de bancos) é quando se decide onde ele vai morar.

Se um dia incomodar de verdade → é a Opção 2/3 da seção de bancos.

---

## Onde o projeto está agora
App completo e protegido por login, rodando de forma independente do VS Code (local).
Cobre: bancos, caixinhas por banco, entradas, saídas (de caixinha e livres), transferências,
contas, contas recorrentes, pagar/desfazer, apagar, saldo livre, histórico, tema escuro,
distribuição em pizza.

## Ideias para o futuro
- Acesso externo (fora de casa): exige HTTPS e mais segurança ANTES de expor — estudar a fundo.
- Agrupar histórico por mês → habilita gráfico de evolução e "% vs mês anterior" (o do dashboard).
- Tela de análise ("gastando muito ou pouco") — depende de meses de dados.
- Metas nas caixinhas (barra de progresso) — combina com reserva de emergência.
- Expandir bancos para contas/entradas (Opção 2/3), se o uso pedir.
- Trocar a CHAVE_SECRETA; considerar backup automático do `financeiro.db`.

---

## Investigação — acessar o app de vários lugares / celular (adiado)

Motivo de o app não abrir no celular: roda em `127.0.0.1` (só a própria máquina).

Três caminhos avaliados, do mais simples ao mais complexo:

1. **Rede de casa (mesmo Wi-Fi):** simples e seguro (dado não sai de casa), mas só funciona
   dentro de casa e com o PC ligado. Ajuste pequeno no comando do servidor.
2. **Túnel seguro (ex.: Tailscale ou similar):** cria uma rede privada entre os aparelhos;
   o celular acessa o PC de qualquer lugar, criptografado, sem expor à internet aberta.
   Gratuito para uso pessoal, não "dorme", dados ficam no PC. Limitação: PC precisa estar
   ligado; adiciona um serviço de terceiros (avaliar/estudar a ferramenta antes).
3. **Hospedar na nuvem 24h:** app sempre no ar, independe do PC. É a maior empreitada:
   preparar o app, trocar SQLite por banco de nuvem (ex.: PostgreSQL), escolher serviço,
   configurar HTTPS, limitar tentativas de senha, manutenção contínua.

**Ponto-chave sobre "nuvem gratuita":** os planos gratuitos costumam (a) fazer o app "dormir"
(demora a responder no 1º acesso) e (b) NÃO guardar arquivos de forma permanente — o que
arrisca o SQLite (perda de dados). Ou seja, "24h de verdade + gratuito + dados seguros"
tende a se contradizer no plano free. Serviços mudam de plano com frequência: conferir no
site de cada um antes (checar: tem free real? o app dorme? como fica o banco permanente?).

**Recomendação registrada:** para "usar no celular em vários lugares", o **túnel seguro** é
provavelmente o melhor equilíbrio (acesso de qualquer lugar, sem expor, gratuito, sem migrar
banco). A nuvem 24h vale mais pelo aprendizado; com dados financeiros reais, exige estudar
segurança a fundo antes. **Decisão atual: adiado.**

A reserva de emergência é apenas uma **caixinha comum**. Não precisa de funcionalidade nova:
- Criar uma caixinha chamada "Reserva de emergência" na aba Caixinhas.
- Alocar dinheiro nela todo mês e não tirar de lá — a disciplina de não mexer é o que a
  torna reserva.
- Dica de método (base zero): tratar a reserva como um "gasto obrigatório" — alocar um valor
  fixo nela ANTES de distribuir o resto (lazer etc.). É o "pague-se primeiro"; faz a reserva
  crescer de forma consistente em vez de receber só o que sobra.
- Futuro opcional: metas na caixinha (barra de progresso rumo a um valor-alvo) — ver ideias abaixo.

---

## Ideia registrada — Tela de análise ("estou gastando muito ou pouco?")

**A ideia:** uma tela que não só mostra os números, mas ajuda a interpretar se o gasto está
saudável. Diferente das telas atuais (que registram o que aconteceu), esta compara e orienta.

**Ponto a pensar quando for construir — "muito comparado a quê?":** "gastar muito" exige uma
referência. Opções de comparação, da mais simples à mais elaborada:
- Contra a renda: quanto % do salário foi para gastos vs. guardado/investido no mês.
- Contra os meses anteriores: gastei mais este mês do que a média dos últimos? (exige olhar
  o histórico por mês — hoje o app não agrupa por mês, seria um passo antes.)
- Contra um limite definido por caixinha: ex.: "Lazer estourou o que eu tinha planejado".
- Contra uma regra conhecida (ex.: 50/30/20 — necessidades/desejos/poupança) como referência.

**O que provavelmente seria necessário:** somar lançamentos por mês e por tipo/caixinha,
e mostrar isso de forma visual (uma barra, uma cor de alerta, uma comparação simples).
Combina bem com agrupar o histórico por mês, que já está nas ideias.

**Nota:** é uma tela de "insight", não de registro — o tipo de coisa que dá personalidade ao
app. Vale fazer depois que as funções básicas estiverem redondas e houver alguns meses de
dados registrados (senão não há o que comparar).

---

## Etapa 20 — Lote grande de melhorias do documento "Sistema de Orçamento.docx" (06/08/2026)

O Renan trouxe um `.docx` com um backlog de ideias (consolidado em `backlog_ideias.md`).
Combinamos implementar **tudo, menos a parte de segurança/online** (que fica pra fase de subir
pra nuvem). Tudo escrito e **testado nesta máquina** (servidor isolado + navegador embutido),
sem entregar arquivo a cada passo — só no fim. Trabalhei em lotes; cada lote testado antes do
seguinte. **Nenhum erro de JS do nosso código** (só o Chart.js do CDN, bloqueado no sandbox).

**Lote 1 — sem migração (testado na porta 8231):**
- **M2 — Rendimento (tipo próprio):** novo `tipo='rendimento'` no lançamento. `saldo_da_caixinha`
  passou a somar `('alocacao','rendimento')`. Rendimento entra na caixinha como dinheiro novo,
  **NÃO** conta como entrada (não infla "Entrou no mês") e **NÃO** reduz o saldo livre. Form novo
  na tela Caixinhas + ícone/rótulo próprio no histórico. Testado: entrada 1000/aloca 500/rend 12,34
  → caixinha 512,34, saldo livre 500 intacto. ✓
- **M4 — Contagem regressiva (7 dias):** `statusConta` mostra "Faltam X dias" quando `venc−hoje<=7 e >0`
  (era 5). Puro front. ✓
- **E1 — Termômetro/Runway:** painel novo na tela Caixinhas (o espaço vazio do print). Calcula
  gasto do mês ÷ dias decorridos = ritmo/dia; projeta a data em que a caixinha zera. ✓
- **E5 — Streaks:** badge no dashboard "N meses seguidos poupando" (entrou > saiu por mês, do mais
  recente pra trás). ✓
- **E9 — Atalhos de teclado:** tecla **E** abre Entrada (foca o campo), **G** abre Gasto, **Esc**
  tira o foco, **Enter** salva no campo de valor. Dicas "(tecla E/G)" nos títulos. ✓

**Lote 2 — migrações (porta 8232, testado sobre banco já populado):**
- **M1 — Arquivar contas (nunca apagar):** coluna `arquivada` em `contas`. `UPDATE arquivada=1`
  some da tela mas mantém no banco (histórico/Análise intactos). Rotas: `/contas/{id}/arquivar`
  (só pagas), `/desarquivar`, `GET /contas/arquivadas`, `POST /contas/arquivar-antigas` (pagas de
  meses anteriores). UI: botão Arquivar nas pagas + "Arquivar pagas antigas" + toggle "Ver arquivadas". ✓
- **E8 — Metas com prazo (IPVA):** coluna `meta_prazo` em `caixinhas`. `definir_meta` grava a data;
  a UI calcula meses até o prazo e mostra "guarde R$ X/mês pra atingir até <mês>". Testado 1200 até
  jan/2027 → "5 meses · guarde R$ 164,33/mês". ✓

**Lote 3 — E4 Gatilhos de salário (porta 8233):** tabela `regras_salario` (gatilho, modo
percentual|fixo, valor, caixinha_id). Ao registrar uma **entrada** cujo nome bate com o gatilho
(case-insensitive exato), `aplicar_regras_salario` cria alocações automáticas. Tela nova "Regras".
Testado: regra "Salário → 10%", entrada Salário 2000 → alocou 200 automático; saldo livre ajustado;
entrada "Freela" não disparou; % > 100 barrado. ✓

**E6 — Retrospectiva mensal / "Wrapped" (porta 8234):** SEM tabela nova — só a config
`wrapped_visto_ate`. Rotas `GET /wrapped-status` e `POST /wrapped-visto`. O resumo é calculado no
front a partir dos lançamentos. Modal automático 1x por sessão quando entra num mês novo e o mês
passado tem dados (senão marca visto e não incomoda). Botão manual "Ver retrospectiva" na Análise
+ seletor de meses. Testado: modal de julho (entrou 3000/guardou 2600/maior gasto Mercado);
reabertura manual não mexe na flag. ✓

**E2 — Assinatura na fatura (portas 8235/8236):** FK `conta_fatura_id` em `recorrentes`.
`gerar_recorrentes_do_mes` reescrito: se a assinatura está vinculada a uma fatura VÁLIDA, ela entra
como **item da fatura** do mês (dedup por nome+mês, respeita fatura paga), **nunca** vira conta
avulsa; senão, comportamento avulso de sempre. Rota `POST /recorrentes/{id}/fatura` pra vincular/
desvincular (valida que é fatura). **Cuidado implementado:** ao vincular, apaga a conta avulsa NÃO
paga do mês com o mesmo nome (evita cobrança dupla). UI: campo "Cobrar em" no cadastro + seletor em
cada assinatura. Testado: Spotify vinculado → item da fatura (não avulsa); Netflix avulsa → conta;
vincular Netflix removeu a conta avulsa e somou na fatura; sem duplicar em 2ª geração. ✓

**E3 — Leitor de extrato (portas 8237/8238):** **OFX e CSV**, sem dependência externa (`re`+`csv`).
`parse_ofx` (blocos `<STMTTRN>`) e `parse_csv` (detecta `;`/`,`, acha colunas por cabeçalho ou
heurística posicional). `_sugerir_caixinha` casa a descrição com o nome da caixinha ou com um mapa
de palavras (uber→transporte, ifood→alimentação...). Rotas `POST /importar/analisar` (devolve prévia,
não grava) e `POST /importar/confirmar` (grava só o que o usuário marcou; entrada→saldo livre,
gasto→caixinha escolhida ou saída livre; **não** dispara regras de salário). Tela nova "Importar"
com arrastar-e-soltar. Testado OFX e CSV`;` ponta a ponta (valores/datas/sinais corretos, sugestão
funcionando, import parcial). **Ressalva:** CSV com vírgula servindo de separador E de decimal é
ambíguo — orientar OFX ou CSV `;` (é como os bancos BR exportam). **PDF NÃO implementado** — exigiria
biblioteca externa (`pdfplumber`); combinar com o Renan se vale instalar.

**Teste integrado final:** base **zerada** (porta 8238) criou todas as tabelas/migrações do zero;
todas as rotas responderam 200; a UI carregou as 8 telas + 9 itens de menu sem erro. `main.py` foi
de 847 → **1318 linhas**; `index.html` de 1396 → **1934 linhas**.

**FORA deste lote (fase online, ver [[plano_online_gratuito]] e backlog_ideias.md):** segurança
(.env, rate-limit, XSS/Pydantic), Supabase/Postgres, hospedagem, **E7 Web Push** e o tratamento de
**Cold Start** — todos dependem de estar hospedado. **M2-investimento além do rendimento manual** e
**PDF no importador** ficaram anotados.

**⚠ Ao aplicar na máquina do Renan:** fazer backup do `financeiro.db` antes (a Etapa 20 adiciona
colunas `arquivada`, `meta_prazo`, `conta_fatura_id` e a tabela `regras_salario` — migração
idempotente e testada sobre banco populado, mas backup é regra).

### Etapa 20.1 — Validações de entrada + docs atualizados (06/08/2026)

Ao revisar o código a pedido do Renan ("se tiver correções pode fazer"), implementei parte das
**validações pendentes** (anotadas na "Pendência — Validações de entrada"):
- Nova função `data_valida(s)`: recusa data fora do formato `AAAA-MM-DD` ou com ano fora de 2000–2100
  ("datas malucas").
- `criar_lancamento`: recusa `valor_centavos <= 0` e data inválida (antes aceitava qualquer coisa).
- `criar_conta`: recusa valor ≤ 0 em conta simples (fatura segue nascendo com 0) e vencimento inválido.
- `editar_conta`: valida o vencimento.
Testado (porta 8240): valor 0/negativo → 400; datas `1990-01-01`, `abc`, `9999-99-99` → 400; válidos
passam; fatura com valor 0 continua normal. **AINDA pendente** desta lista: travar "gastar de caixinha"
avulso quando não há saldo (deixei de fora pra não arriscar quebrar o importador, que insere pagamentos
direto). Os inserts diretos (transferir, pagar_conta, importar, regras) não passam por essas validações
de propósito.

**Troubleshooting (06/08/2026) — login não funcionava na máquina do Renan:** o log mostrava só
`GET /app 200` + `GET /favicon.ico 404` (favicon 404 é normal, ignorar) e **nenhuma** chamada
`/auth/...` — sinal de que o JS do `index.html` não rodava. Causa real: o `git pull` foi puxado
pra uma **pasta errada**, então o servidor subia uma cópia antiga/incompleta do `index.html`.
**Lição:** a pasta onde se roda o `uvicorn` tem que ser exatamente a que o git atualiza — manter
UMA cópia só como fonte pra não rodar a versão errada.

**Documentação atualizada e versionada:** `documentacao_tecnica.md` reescrita pro estado atual;
`guia_projeto_financeiro.md` virou **manual do usuário** das 8 telas; `codigo_comentado.md` reescrito
cobrindo os blocos novos (migração, rendimento, regras de salário, E2 fatura, E3 parsers, E6 wrapped) +
as validações. Fluxo combinado com o Renan: **toda mudança → documentar no Obsidian → push no GitHub**
([[feedback-git-repo-financeiro]]). Repo: `Renanzin15/Sistema-Financeiro` (privado).

## Etapa 21 — Leitor de conta por foto/PDF (OCR local) — implementado (07/08/2026)

Depois do estudo (`estudo_ocr_conta_imagem.md`, POC feita numa sessão/máquina anterior), o Renan
confirmou as 4 decisões pendentes: instalar o Tesseract, idioma **inglês + português**, escopo
**imagem + PDF já** (não só Fase 1), e a conta lida vira registro em **Dívidas** (via `POST /contas`
já existente) — nunca lançamento direto.

**Instalação nesta máquina:** Tesseract 5.4.0 via `winget install -e --id UB-Mannheim.TesseractOCR`
(`C:\Program Files\Tesseract-OCR\`). Idioma `por.traineddata` baixado à parte (o shell desta sessão
não tem permissão de admin pra gravar em `Program Files\Tesseract-OCR\tessdata`) e colocado numa
pasta própria; a variável de ambiente opcional `TESSDATA_DIR` no `main.py` aponta pra lá só quando
necessário — **na máquina real do Renan (com admin), não é preciso definir nada**, o Tesseract já
acha os idiomas na pasta padrão se `por.traineddata` for colocado lá.

**Back-end (`main.py`):** import de `pytesseract`/`Pillow`/`PyMuPDF` é **opcional e protegido**
(`try/except ImportError` → `OCR_DISPONIVEL`); sem essas libs instaladas o app inteiro continua
funcionando normal, só a rota nova fica indisponível (mensagem clara de erro). Funções:
- `ocr_texto_imagem`/`_preprocessar_imagem`: escala de cinza + auto-contraste + upscale se a foto
  for pequena (< 1000px) — melhora bastante o OCR sem exigir deskew (isso ficou pra uma Fase 2 futura).
- `ocr_texto_pdf`: usa PyMuPDF; se a página **tem** camada de texto, lê direto (rápido, sem OCR —
  cobre a maioria dos boletos gerados por sistema); se **não tem** (PDF escaneado/foto virou PDF),
  renderiza a página como imagem (300 DPI) e cai no OCR.
- `extrair_conta`/`_melhor_valor`/`_melhor_vencimento`: regex com **contexto** — um valor "R$ x,xx"
  perto de "valor a pagar"/"total" pesa mais que um solto; mesma ideia pra data perto de "vencimento".
  Sem contexto, cai no maior valor / primeira data encontrados (heurística de fallback).
  `_sugerir_nome_conta` chuta um nome (Energia/Água/Internet/...) pela palavra-chave no texto lido.
- Rota `POST /importar/conta-imagem`: recebe a imagem/PDF em base64 (data URL), roda o pipeline,
  **devolve só a prévia** (nome, valor, vencimento, texto bruto) — não grava nada sozinho, igual ao
  importador de extrato. Limite de 15 MB por arquivo.

**Front-end (`index.html`):** novo painel "Ler conta por foto ou PDF 📷" na tela Importar, mesmo
padrão visual/drag-and-drop do bloco de OFX/CSV. Prévia com campos **editáveis** (nome/valor/
vencimento/categoria) + `<details>` colapsável com o texto bruto lido (transparência/debug) + botão
"Cadastrar como conta" que reaproveita o `POST /contas` já existente — nenhuma rota nova de gravação.

**Testado (ambiente isolado desta máquina, porta 8199), os 3 caminhos batendo exatamente com o
esperado (R$ 187,45 / vencimento 20/08/2026):**
1. Imagem PNG gerada com texto sintético → OCR → extração correta.
2. PDF com camada de texto (gerado com PyMuPDF) → leitura direta, sem OCR → correta.
3. PDF **sem** camada de texto, só a imagem embutida (simula boleto escaneado) → cai no fallback
   de OCR → correta.
Testado também pela UI real no navegador (login, tela Importar, bloco novo renderizando certo).
**Não** testado o "arrastar arquivo de verdade no navegador" (mecanismo de automação do teste não
consegue simular upload de arquivo real) — mas usa a mesma `FileReader.readAsDataURL` já comprovada
no importador de OFX/CSV, risco baixo.

**Bug encontrado e corrigido durante o teste:** o `pytesseract` passa a string de `config` **direto**
pro subprocesso do Tesseract (sem shell) — colocar o caminho do `--tessdata-dir` entre aspas fazia as
aspas virarem **parte literal** do caminho e o Tesseract não achava a pasta. Correção: não envolver
o caminho em aspas (só seria necessário se o caminho tivesse espaço, o que não é o caso aqui).

**Pendências que ficaram de fora (documentadas no próprio `estudo_ocr_conta_imagem.md`):**
"linha digitável" como segunda fonte de valor/vencimento (mencionada no estudo como ideia pra
explorar, mais confiável que ler o texto solto) e deskew de foto torta — ambas de Fase 2, não
bloqueiam o uso normal (foto reta/print funciona bem).

Dependências agora em `requirements.txt` (seção opcional, descomentada): `pytesseract`, `Pillow`,
`PyMuPDF`. Segue o fluxo combinado: documentar no Obsidian → push no GitHub
([[feedback-git-repo-financeiro]]).

### Etapa 21.1 — Deploy na pasta de execução + config de idioma robusta (07/08/2026)

Descobri que nesta máquina o app **roda de fato** a partir de `D:\PROGRAMAÇÃO\Financeiro\` (o
`MeuOrçamento.bat` faz `cd` pra lá e sobe `uvicorn main:app`), e que existem **dois clones git** do
projeto na mesma máquina: o do vault (`D:\Obsidian\Pessoal\Sistema Financeiro\`, onde eu edito) e um
segundo dentro de `D:\PROGRAMAÇÃO\Financeiro\Sistema-Financeiro\`. A raiz de execução tem cópias de
`main.py`/`index.html` alimentadas por esse segundo clone. **Corrigi minha memória** (antes eu achava
que a pasta de execução ficava em outra máquina).

**Fluxo de deploy que usei (e que vale repetir):** `git pull` no clone
`D:\PROGRAMAÇÃO\Financeiro\Sistema-Financeiro\` → copiar `main.py`/`index.html`/`requirements.txt`
pra raiz `D:\PROGRAMAÇÃO\Financeiro\`. **Nunca** copiar/sobrescrever o `financeiro.db` da raiz (dados
reais + hash de senha). Conferi por hash (md5) que o código nos 3 lugares ficou idêntico.

**Instalei as libs de OCR no Python global** (3.13.3, o que o `.bat` usa): `pytesseract Pillow PyMuPDF`.

**Config de idioma agora é auto-detectada e à prova de falha** (antes dependia de setar `TESSDATA_DIR`
na mão, o que não acontece quando o app sobe pelo `.bat`):
- A pasta de idiomas é resolvida na ordem: env `TESSDATA_DIR` → **pasta `tessdata` ao lado do
  `main.py`** → pasta padrão do Tesseract. Assim os idiomas "viajam junto" com o app, sem precisar de
  admin pra gravar em `Program Files`. Coloquei `eng.traineddata`+`por.traineddata` em
  `D:\PROGRAMAÇÃO\Financeiro\tessdata\`.
- Nova função `_idiomas_ocr()`: usa `por+eng` **só se** o `por.traineddata` existir; senão cai pra
  `eng` sozinho (números e datas, que é o que importa, saem bem só com inglês). Evita quebrar o OCR
  numa máquina que só tenha o inglês.
- `tessdata/` e `*.traineddata` entraram no `.gitignore` (são ~19 MB, cada máquina baixa o seu).

**Testado:** OCR rodando com o **Python global** apontando pra pasta `tessdata` real → leu R$ 187,45
e vencimento 20/08/2026 certos; e uma simulação de startup da pasta de execução confirmou
`OCR_DISPONIVEL=True`, idiomas `por+eng`, `tesseract_cmd` correto — tudo **sem tocar no `financeiro.db`
real** (testes em cópia isolada, porque `criar_tabelas()` roda no import e abriria o banco do cwd).
## Etapa 22 — Mini-calendário de vencimentos na Visão geral (10/08/2026)

Pedido do Renan (ele trouxe o desenho da "Opção 1: mini-calendário estilo widget"): um calendário do
mês na tela **Visão geral**, com um **pontinho colorido** em cada dia que tem conta vencendo e, ao
**clicar no dia**, poder **pagar a conta ali mesmo**. Decisões confirmadas por ele: fica na **Visão
geral** (não na Análise) e a ação do dia é **pagar direto** (não pular pra Dívidas).

**Só front-end — nenhuma rota nova, nenhuma migração.** O widget lê o array `CONTAS` (já carregado por
`carregarContas`) e o pagamento reaproveita `POST /contas/{id}/pagar` (o mesmo da tela de Dívidas). Por
isso **não precisa backup do `financeiro.db`** pra essa etapa. `main.py` ficou **intocado**.

**O que foi feito no `index.html`:**
- **HTML:** a coluna direita do dashboard virou um wrapper com 2 painéis — o novo *"Vencimentos do mês
  📅"* (`#cal-widget`) em cima e o de *"Distribuição das caixinhas"* (pizza) embaixo. Estrutura da pizza
  e do `#painel-bancos` preservada (só ganhou um nível de aninhamento).
- **CSS:** bloco `.cal-*` (grade 7 colunas com `aspect-ratio:1/1`, cabeçalhos Dom–Sáb, `.cal-ponto`,
  anel roxo `.cal-dia.hoje`, seleção `.cal-dia.sel`, `.cal-detalhe`/`.cal-item`). Reusa as variáveis de
  cor e classes existentes (`.status-tag`, `.nome`, `.sub`, `.grupo-dia`).
- **JS:** `renderCalendario()` (chamada dentro de `carregarContas`, logo após `CONTAS = contas`),
  `corDoDia()` (cor do pontinho = status mais urgente, priorizando não pagas), `calMudarMes(±1)` (setas
  ‹ ›), `calAbrirDia(ds)` (abre/fecha o detalhe do dia), `renderCalDetalhe()` (lista as contas do dia +
  select de caixinha + botão Pagar; conta paga aparece sem botão) e `pagarContaCal(id)`. Tooltip nativo
  (`title`) no dia mostra "Nome — R$ x,xx (Status)"; dia com várias contas lista todas.

**Regras de cor (derivadas de `statusConta`, sem duplicar lógica):** vermelho = Vencido/Vence hoje;
amarelo = A vencer/Faltam ≤7 dias; verde = Pago. Dia com contas mistas usa a cor da **mais urgente
não paga**.

**Teste (ambiente isolado, porta 8266, base zerada):** criei banco+caixinha (com saldo) e 5 contas de
agosto/2026 (Cartão 04 vencido, Luz 10 paga=hoje, Prime 17, Aluguel 17, Internet 25). Verificado pelo
DOM real (login programático + inspeção): mês "agosto de 2026"; pontinhos certos nos dias 4/10/17/25 com
as cores certas; dia 17 com **2 contas** no tooltip; clicar no 17 abre o detalhe "17 de agosto" com
select+Pagar por conta; **pagar o Prime pelo calendário** → virou Pago, dia 17 continuou amarelo
(Aluguel pendente), detalhe reabriu atualizado; navegação de meses (setembro/outubro vazios, sem anel de
hoje) e volta pra agosto OK; trocar de mês limpa o dia selecionado. Front `index.html` cresceu ~118
linhas. *(Não deu pra tirar screenshot — o Browser pane não estava visível; validação foi via DOM +
prévia estática entregue ao Renan.)*

**Pendente / ideias que surgiram:** no celular não há hover, então o tooltip não abre no toque — o
**clique já resolve** (abre o detalhe), então funciona no celular; o tooltip é só um extra no desktop.
Possível evolução futura: mostrar mais de um pontinho por dia (hoje é 1 só, colorido pela conta mais
urgente).

## Etapa 23 — SaaS multi-usuário (Postgres + Supabase Auth + isolamento por user_id) (10/08/2026)

Renan hospedou o FastAPI no Render puxando deste repo e criou um banco no Supabase. Descobri que o
repo (o que roda no Render) ainda era a versão **SQLite** — ou seja, não persistia no Supabase de
verdade. Então "virar SaaS multi-usuário" virou um pacote grande, feito e **testado** aqui antes de subir.

**1) Backend fala Postgres/Supabase OU SQLite** (`main.py`): detecção por env (`PGHOST`/`DATABASE_URL`).
Wrapper `_ConexaoPG` faz a conexão psycopg2 se comportar como a do sqlite3 e traduz `?`→`%s`, então os
~115 `con.execute` ficaram intactos. DDL Postgres própria; `migrar()` no-op no PG. `.env` carregado por
`_carregar_env_local()` (no Render as vars vêm do painel). `requirements.txt` ganhou `psycopg2-binary`.

**2) Autenticação = Supabase Auth** (saiu a senha única). `exigir_login` verifica o access_token do
Supabase (HS256 com a JWT Secret, `aud=authenticated`) e devolve o `user_id` (`sub`). Rotas `/auth/*`
antigas removidas. Front: tela de login e-mail/senha que chama `POST {SUPABASE_URL}/auth/v1/token`
(header `apikey` = publishable key, ambos PÚBLICOS e hardcoded no index.html), guarda o token no
`localStorage` (não desloga no refresh) e manda como `Bearer`. `pedir()` volta pro login em 401.

**3) Isolamento por `user_id`** — o coração. `user_id UUID` em todas as tabelas + `config` por usuário
(PK `(user_id, chave)`) + índices. **Toda** query filtra/insere por `user_id` (rotas, e os helpers
`saldo_da_caixinha`, `total_conta`, `aplicar_regras_salario`, `gerar_recorrentes_do_mes`). Categorias
padrão agora são semeadas **por usuário** (`_garantir_usuario`, 1x). Ações sobre ids alheios validam
posse (`WHERE id=? AND user_id=?` → 404). Como o backend conecta como role `postgres` (que **ignora
RLS**), o isolamento REAL é no código; RLS fica como rede de segurança.

**4) Rota `/`** passa a servir o `index.html` (o `/app` também continua).

**5) `migrar_para_supabase.py`** atualizado: lê o `financeiro.db` (schema antigo, só-leitura), cria o
schema no Supabase e copia tudo **carimbando `user_id = <SEU UUID>`** em cada linha; descarta a linha
`senha_hash` (obsoleta). Uso: `python migrar_para_supabase.py <SEU_UUID> [financeiro.db]`.

**Testes (contra o Supabase real, com 2 usuários SIMULADOS — tokens que assinei com a JWT Secret):**
- Isolamento: **19 checks OK** — cada usuário só vê o seu (bancos/caixinhas/lançamentos/contas/
  saldo-livre/categorias); usuário A **não** consegue pagar/editar/apagar/transferir/ver itens de B
  (tudo 404), e B fica intacto. Token inválido → 401.
- Postgres CRUD + cálculos (saldo, saldo-livre, fatura somando itens) corretos; fallback SQLite OK.
- Front: login Supabase (erro com credencial falsa; sucesso injetando token → app carrega os dados do
  usuário). `sair()` limpa. Sem erros de console.
- Migração: db schema-antigo → Supabase, todas as linhas com `user_id`, `senha_hash` descartado.

**⚠ Deploy (o app só funciona no ar depois disto):** setar no **Render** as env vars
`PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSLMODE` (Session Pooler sa-east-1) e
`SUPABASE_JWT_SECRET` (valores no `.env`/[[CREDENCIAIS_SUPABASE.local]]); **criar seu usuário** em
Authentication → Add user (signups desativados); rodar a **migração** com o seu UUID. Sem env vars o
login dá erro (fail-closed, não vaza). Segredos nunca vão pro git (`.env`/`*.local.md` gitignored).

### Etapa 23.1 — Fix do login: tokens do Supabase são ES256, não HS256 (10/08/2026)

No primeiro deploy o login não entrava (logava e voltava pra tela de login). **Causa:** o projeto do
Renan é novo e usa as chaves no formato novo (`sb_publishable_...`) — e assina os access_tokens com
**ES256 (chave assimétrica)**, publicada no JWKS (`/auth/v1/.well-known/jwks.json`, confirmado:
`"alg":"ES256"`). O back verificava em **HS256** com a "JWT Secret" → rejeitava o token real → 401 →
o front (`pedir()` em 401 chama `sair()`) jogava de volta pro login. Meus testes de isolamento tinham
passado porque usei tokens que EU assinei em HS256 — premissa errada minha.

**Correção (`main.py`):** `_verificar_token()` tenta **ES256 via JWKS** (busca a chave pública 1x,
cacheia; casa pelo `kid`; recarrega o JWKS 1x se a chave rotacionou) e cai pra **HS256 (JWT Secret)**
como reserva/legado. `exigir_login` usa isso. Novas envs: `SUPABASE_URL` (necessária p/ o JWKS — o
endpoint é público, nem precisa de apikey) e `SUPABASE_PUBLISHABLE_KEY` (opcional). Provei a mecânica
ES256 localmente (gerei chave EC + token ES256 → aceita; rejeita adulterado e chave errada). Confirmação
com token REAL do Supabase fica com o Renan testando o login após o deploy.

**⚠ Render:** adicionar `SUPABASE_URL=https://jrchngwumnyqohrtrzrr.supabase.co` (sem ela o back cai no
HS256 e o login ES256 falha).

### Etapa 23.2 — Migração de dados executada e verificada (10/08/2026)

Rodei de verdade o `migrar_para_supabase.py` levando o `financeiro.db` real do Renan
(`D:\PROGRAMAÇÃO\Financeiro\financeiro.db`) pro Postgres do Supabase, carimbando o `user_id` do
Renan. **Nota de ambiente:** a pasta de execução `D:\PROGRAMAÇÃO\Financeiro` hoje está **na mesma
máquina** deste vault (a memória antiga dizia "outra máquina" — desatualizado); o `financeiro.db` real
estava ali e foi lido **só-leitura** (não alterado). O `.env` com as credenciais do Supabase (Session
Pooler sa-east-1) foi montado a partir das env vars do painel do Render e fica **fora do git**
(`.gitignore`); **segredos nunca entram neste diário nem em arquivo versionado.**

**Resultado (origem SQLite × destino Supabase, tudo com o `user_id` do Renan):** bancos 4, caixinhas 8,
lançamentos 47, contas 12, recorrentes 4, fatura_itens 2, categorias 4, regras_salario 2, config 2
(a antiga `senha_hash` foi descartada, por isso 3→2) — **todas as tabelas OK, contagem batendo.**
Verificação independente reconectando no Supabase e filtrando por `user_id`: mesmos números, bancos
reais (Itau, Nubank, PicPay, Mercado Pago), 47 lançamentos somando R$ 11.315,61, e **0 linhas sem
`user_id`** (nada vaza pra outros usuários). O TRUNCATE do destino (o script limpa antes de copiar)
foi avisado ao Renan antes de rodar; o destino só tinha teste/vazio.

**Estado:** o app no Render agora tem os dados reais do Renan no Supabase, isolados pela conta dele.
Próximo passo do Renan: entrar no site com o login (e-mail/senha do Supabase Auth) e conferir que as
telas mostram os dados migrados.

## Etapa 24 — Trava de saldo: não deixar guardar/gastar sem dinheiro (10/08/2026)

Pedido do Renan: "toda vez que eu for colocar dinheiro numa caixinha, não conseguir se não tiver
dinheiro — e o mesmo pra gastar, em todo o site." Era a pendência antiga das validações (faltava
travar alocar/gastar avulso; transferir e pagar conta já travavam).

**Onde:** todas as ações interativas de guardar/gastar passam por um ponto só — `POST /lancamentos`
(`criar_lancamento`), com o `tipo` dizendo a ação. Então a trava entrou lá, cobrindo os 3 casos:
- `alocacao` (guardar na caixinha) e `saida_livre` (gasto do saldo livre) → barram se `valor > saldo
  livre`. Novo helper `calcular_saldo_livre(con, user_id)` (mesma conta da rota `/saldo-livre`,
  extraída pra reuso): `entradas − alocado − saídas_livres`.
- `pagamento` (gastar de uma caixinha) → barra se `valor > saldo_da_caixinha` (helper que já existia);
  também barra se não escolheu caixinha.
- `entrada` e `rendimento` adicionam dinheiro → sem trava.
As mensagens dizem quanto há disponível (ex.: "Saldo livre insuficiente para guardar: você tem R$
X livre."). O front já mostra isso: `pedir()` extrai o `detail` do 400 e as telas fazem `aviso(...)`.

**Cobertura "todo o site":** `/transferir` (saldo da caixinha de origem) e `/contas/{id}/pagar`
(saldo da caixinha que paga) **já validavam** — confirmado. O **importador** de extrato (OFX/CSV) e
a criação de conta por OCR **continuam sem essa trava de propósito** (importar é histórico e insere
direto no banco, não via `criar_lancamento`; conta é dívida, não saída de caixinha).

**Testado (9/9 OK, SQLite isolado, chamando a função direto — sem depender de token do Supabase):**
alocar sem saldo barra; entrada permite; alocar acima do livre barra; alocar dentro permite; gastar
de caixinha acima do saldo dela barra; gastar dentro permite; saída livre acima do livre barra;
saída livre dentro permite; pagamento sem caixinha barra. Saldos finais conferidos (livre R$ 0,10 e
caixinha R$ 0,50, batendo com as contas). Só mudou o `main.py` (back-end); o front não precisou mudar.
### Etapa 25 — Pop-up "com a nossa cara" no lugar dos prompt() nativos (10/08/2026)

O Renan reclamou (com print) dos `prompt()` cinzas do navegador (que às vezes vinham escuros, pois o
navegador decide o estilo). Criei um **modal de formulário estilizado reutilizável** `abrirFormModal({titulo,
campos:[{id,label,valor,tipo,placeholder}], rotulo})` -> Promise (objeto de valores no Salvar, null no
Cancelar), no mesmo visual do modal de confirmação. Troquei os prompt() de **editar dívida** (nome, valor,
vencimento com date-picker, categoria — tudo numa tela só em vez de 4 caixinhas seguidas) e **meta da
caixinha** (valor + prazo). Esc fecha, Enter salva, clicar fora cancela. Testado no navegador (abre,
campos/tipos certos, retorna valores, cancela=null; zero erros). Sobraram zero dialogs nativos.

### Etapa 26 — Entradas automáticas (renda recorrente + distribuição) (10/08/2026)

Pedido do Renan: "todo dia 5 eu ganho R$ 1.700 de salário" — renda que entra sozinha num dia fixo. E a
sacada dele: se a entrada automática for salário, **bater na regra de distribuição** e automatizar tudo.

**Back-end:** nova tabela `entradas_recorrentes` (nome, valor_centavos, dia, user_id) — DDL Postgres +
SQLite (criada automaticamente no deploy pelo `criar_tabelas`). Helper `gerar_entradas_recorrentes(user_id)`:
pra cada renda cujo `dia` já chegou no mês, cria 1 `entrada` (dedup por nome+mês) e **chama
`aplicar_regras_salario`** — ou seja, se o nome casar com um gatilho, distribui nas caixinhas na hora.
Rotas: `GET/POST/DELETE /entradas-recorrentes` + `POST /entradas-recorrentes/gerar`. Migração
(`migrar_para_supabase.py`) atualizada com a tabela nova.

**Front:** painel "Entradas automáticas 💰" na tela **Regras** (nome, valor, dia + lista). `carregarTudo`
chama `/entradas-recorrentes/gerar` ANTES de calcular saldos/histórico, então a renda do dia já aparece.

**Testado (SQLite isolado, 7/7):** cria a entrada; **dispara a distribuição** (10% → caixinha); NÃO
lança renda de dia futuro; saldos certos (caixinha R$170, livre R$1530); 2ª geração não duplica. Front:
sem erros, painel/campos/validação OK. Nada de deploy manual — a tabela nasce no Supabase no startup.

### Etapa 27 — Importar extrato: filtro de mês + datas + card do mês (10/08/2026)

Um amigo do Renan testou o importador de extrato e o mês inteiro veio inflado com o ano todo. Diagnóstico
(2 causas): (1) o card do topo **"Entradas do mês"** vinha de `/saldo-livre`, que soma TODAS as entradas
(sem filtro de mês) — rótulo mentia; (2) no `importar/confirmar`, data que não batia o formato virava
`data_hoje()`, jogando lançamentos antigos no mês atual.

**Correções:**
- **Card "Entradas do mês"** agora é preenchido por `carregarAnalise` (que já filtra `l.data.startsWith(mesAtual)`);
  tirei o `ct-entradas` do `carregarSaldoLivre`. Passa a mostrar só o mês corrente.
- **Parser de datas (`_data_iso`) mais esperto:** além de dd/mm/aaaa e aaaa-mm-dd, agora cobre ISO com
  hora, aaaa/mm/dd, dd-mm-aaaa, dd.mm.aaaa, dd/mm/aa e mês por extenso em pt ("15 ago 2026", "15 de
  agosto de 2026", "15 ago"). Testado 12/12.
- **Filtro de mês na importação (pedido do amigo):** a prévia agrupa por mês e por padrão marca só o
  **mês atual** (ou o mês mais recente do arquivo). Seletor pra trocar de mês, ver "sem data — usa hoje"
  ou "Todos os meses". Assim não puxa o extrato do ano inteiro de uma vez. Testado no navegador (default
  = mês atual, só as linhas do mês marcadas; "Todos" marca tudo).

Só front + `_data_iso`; o `importar/confirmar` segue com o fallback "hoje" só pra linhas que o usuário
escolher explicitamente na aba "sem data".

### Etapa 28 — Split do front em 3 arquivos (economia de tokens) (10/08/2026)

O `index.html` tinha ~2.500 linhas (HTML+CSS+JS+fonte base64). Separei em **index.html + styles.css +
app.js** (a fonte Inter foi pro styles.css). Rotas `GET /styles.css` e `GET /app.js` no `main.py`
(content-type certo + no-store). Como o app agora é hospedado, servir 3 arquivos é trivial. Ganho:
toda edicao de front passa a ler/mexer so no arquivo certo (JS no app.js, estilo no styles.css) em vez
do monstro unico. Testado: CSS aplicado, Inter carrega, JS roda, zero erros — app identico.

### Etapa 29 — Fix: desvincular assinatura da fatura duplicava a conta (10/08/2026)

Bug (print do Renan, 3x o mesmo pagamento de R$20): ao desvincular uma assinatura da fatura, o
`vincular_fatura` so zerava o `conta_fatura_id` mas NAO removia o item que ja estava na fatura daquele
mes. Ai a assinatura ficava cobrada na fatura E como conta avulsa (que o `gerar_recorrentes` recria) ->
dava pra pagar as duas (ou mais, em ciclos de vincular/desvincular). Fix: ao desvincular ou TROCAR de
fatura, remove o `fatura_itens` daquele mes da fatura antiga (se nao paga). Testado 3/3 SQLite. Nota:
corrige daqui pra frente; duplicatas ja criadas antes o usuario apaga/desfaz na mao.

### Etapa 30 — Responsividade/zoom: calendario e largura do conteudo (10/08/2026)

Print do Renan: em zoom baixo (tela larga) o calendario esticava com celulas gigantes. Causa: `.cal-dia`
tem `aspect-ratio:1/1`, entao num painel largo as celulas viravam quadroes. Fixes (so styles.css):
`#cal-widget { max-width: 340px }` (calendario nao passa disso, mas encolhe no mobile) e
`.principal { max-width: 1600px }` (conteudo nao estica infinito no zoom 25%). Testado com resize da
viewport (= zoom): 380px (mobile/500%), 1280px, 2400px (25%) -> calendario ~40px/celula, `.principal`
capa em 1600, e as 8 telas com ZERO overflow horizontal a 380px.

### Etapa 31 — OCR no Render: detectar Tesseract + esconder painel + msg amigavel (10/08/2026)

No site (Render/Linux) o "ler conta por foto" dava erro tecnico feio: o codigo forcava o caminho do
Tesseract no Windows (`C:\Program Files\...`) e o Render nao tem Tesseract instalado. Fixes: (1) deteccao
Linux-aware — usa TESSERACT_CMD, senao o caminho do Windows SE existir, senao "tesseract" no PATH; nova
flag `OCR_PRONTO` = libs importam E o binario existe (`shutil.which`); (2) rota `GET /ocr-status`; o front
(`carregarTudo`) esconde o painel "Ler conta por foto" quando `disponivel:false`; (3) mensagens tecnicas
trocadas por "A leitura por foto ainda nao esta disponivel neste servidor; cadastre manualmente" (503).
Testado: com binario ausente -> OCR_PRONTO False, /ocr-status false, rota 503 amigavel. Para HABILITAR o
OCR no Render seria preciso um Dockerfile com `apt-get install tesseract-ocr tesseract-ocr-por` (deploy
Docker) — oferecido ao Renan como opcao.

### Etapa 32 — "Guardado em caixinhas" desconta os gastos (10/08/2026)

Pedido do Renan: ao gastar de uma caixinha, o card "Guardado em caixinhas" tem que cair. Estava vindo
de `/saldo-livre` como `alocado = SUM(alocacao)` (total ja alocado, sem descontar pagamentos das
caixinhas). Fix (so app.js): o card agora e a SOMA dos saldos ATUAIS das caixinhas (`TODAS_CAIXINHAS`
.saldo_reais, que ja e alocacao+rendimento - pagamento). Tirei o `ct-alocado` do carregarSaldoLivre e
pus no carregarCaixinhas. Transferencia entre caixinhas continua neutra (sai de uma, entra em outra).

### Etapa 33 — Importar OFX: botao "Saldo inicial" (10/08/2026)

Importar extrato num app base-zero deixava o saldo livre negativo (gastos do banco viram saida_livre,
mas o dinheiro que os pagou — o saldo da conta — nao existe no app). Fix: `importar/analisar` le o
`<LEDGERBAL><BALAMT>` do OFX e devolve `saldo_conta_reais`; a previa mostra um botao "Adicionar Saldo
inicial de R$ X" que cria uma entrada com esse valor, tirando o livre do negativo. Testado no OFX real
(saldo 2093.82).

### Etapa 34 — Recolher menu lateral + centralizar conteudo no zoom baixo (12/08/2026)

Dois pedidos do Renan (prints em 200% e 50% de zoom): (1) poder esconder o painel lateral e (2) a tela
adaptar melhor conforme tira/poe zoom. Fixes:

- **Botao de recolher menu** (index.html + styles.css + app.js): botao hamburger no topo, ao lado do
  titulo, sempre visivel (inclusive com o menu escondido, pra trazer de volta). `toggleMenu()` poe/tira
  a classe `menu-oculto` no `<body>` (`body.menu-oculto .lateral { display:none }`) e salva no
  localStorage (`sb_menu_oculto`), entao persiste no reload. Atalho de teclado tecla **M** (junto dos
  E/G que ja existiam). Com o menu escondido o conteudo ocupa a largura toda automatico (body e flex,
  `.principal` e flex:1).

- **Zoom baixo (tela larga) deixava um vao vazio a direita**: a Etapa 30 ja tinha posto
  `.principal { max-width:1600px }`, mas sem margem o conteudo ficava grudado a esquerda e sobrava um
  buraco enorme a direita (era o que a print de 50% mostrava). Fix: `margin-inline:auto` no `.principal`
  — agora centraliza quando a viewport passa de 1600 e continua se ajustando no zoom. Tambem adicionei um
  breakpoint em 640px (cards de resumo viram 1 coluna, padding menor, topo com flex-wrap) pra ficar mais
  suave no zoom alto. O breakpoint de 1000px (menu vira trilho de icones) ja existia — e o que aparece na
  print de 200%, comportamento correto.

Arquivos: index.html, styles.css, app.js. So front-end, nada no back/DB. Assets tem `Cache-Control:
no-store`, entao basta recarregar.

### Etapa 35 — Revisao do zoom: bug no 200%, vao vazio e botao "andando" (12/08/2026)

Feedback do Renan (3 prints) sobre a Etapa 34: (1) em 200% "bugava a tela", (2) abaixo de 100% ficava com
espacos vazios e (3) o botao de esconder o painel "mudava de lugar" (marcou em vermelho um vao entre a
lateral e o conteudo). Testei ao vivo com http.server local + browser, medindo a geometria em varias
larguras (= niveis de zoom). Diagnostico e fix:

- **Bug do 200% (trilho):** em ~960px o breakpoint de 1000px vira a lateral num trilho de 66px e esconde
  os rotulos via `.marca span, .item-menu span { display:none }`. So que o texto "Orcamento" da marca
  estava solto na div (nao num span), entao nao sumia e VAZAVA pra fora do trilho (scrollWidth 80 x 35 de
  largura), invadindo a topbar. Fix: envolvi "Orcamento" num `<span>` (index.html) + `overflow:hidden;
  white-space:nowrap` na `.marca` (styles.css). Medido: marcaSpill agora false, zero overflow horizontal.

- **Vao vazio + botao andando:** a Etapa 34 tinha posto `margin-inline:auto` no `.principal` pra
  centralizar. Só que com o teto de 1600px numa tela larga isso criava dois vaos — e o vao da ESQUERDA
  (entre a lateral e o conteudo) era exatamente o retangulo vermelho: o botao hamburger, que fica no
  inicio do conteudo, "descia" pra depois desse buraco. Fix: tirei o `margin-inline:auto` (conteudo volta
  a colar na lateral, alinhado a esquerda) e subi o teto pra `max-width:2400px`. Assim, na faixa real de
  zoom do Renan (70-100% => viewport ~1920-2740px) o conteudo PREENCHE a tela com zero vao e o botao fica
  colado na lateral. Só abaixo de ~70% sobra um vao pequeno a direita (2900px => 268px), e o teto de 2400
  evita cards gigantes no zoom extremo (25%).

Medicoes finais (viewport => resultado): 960 => trilho limpo, sem spill; 1920 => preenche 1688, vao 0,
toggle esconde e conteudo ocupa 1920; 2400 => preenche 2168, vao 0; 2900 => capa 2400, vao dir 268, sem
overflow. So front-end (index.html + styles.css), nada no back/DB.

### Etapa 36 — Atalho: cards do topo levam pra Caixinhas e Dividas (12/08/2026)

Pedido do Renan: um atalho pra Caixinhas e Dividas no dashboard. Em vez de botao novo, transformei os
dois cards de resumo do topo (que ja mostram os valores) em atalhos clicaveis: "Guardado em caixinhas" ->
tela Caixinhas, "Contas a pagar" -> tela Dividas. Cada card ganhou `role=button`, `tabindex=0`, uma seta
(->) no canto (opacity .5, vai a 1 no hover/foco) e navegacao por teclado (Enter/Espaco). No app.js, a
funcao `irPara(tela)` reaproveita o clique do `.item-menu` correspondente (mantendo o highlight do menu e
o titulo em sincronia) e da um scrollTo topo suave. Como o `.cards-topo` fica fora das `<section>`, o
atalho vale de qualquer tela — bonus. Testado no browser: clicar em cada card troca tela/menu/titulo
certos; 2 setas presentes. So front-end (index.html + styles.css + app.js).

### Etapa 37 — Fix: assinatura paga avulsa + vinculada a fatura cobrava DUAS vezes (12/08/2026)

Bug (print do Renan): pagou "teste_assinatura_1" (R$30) como conta avulsa e depois vinculou/lancou ela na
fatura "teste_fatura_1". Resultado: a avulsa ficou marcada "Pago" E o mesmo R$30 entrou como item da
fatura -> pagar a fatura cobraria os R$30 de novo (duplicado; fatura somava 50 = 20 do gasto real + 30 da
assinatura ja paga). Causa: o `vincular_fatura` so removia a conta avulsa duplicada quando `paga=0`; se ja
tinha sido paga (`paga=1`), ela nao era removida e o `gerar_recorrentes_do_mes` ainda adicionava o item na
fatura.

Regra nova (invariante): **cada assinatura e cobrada em UM lugar so por mes — ou como conta avulsa, ou
como item da fatura, nunca nos dois.** Fixes em main.py:

- **`gerar_recorrentes_do_mes` (branch vinculada):** antes de add o item, verifica se ja existe conta
  avulsa do mesmo nome/mes. Se a avulsa ja foi PAGA -> nao adiciona o item e REMOVE o item duplicado que
  por acaso ja tenha entrado (isso limpa sozinho o estado do print na proxima abertura de Dividas, se a
  assinatura estiver vinculada). Se a avulsa NAO foi paga -> migra pra fatura (apaga a avulsa, vira item).
  Sem avulsa -> comportamento normal (add 1x, com dedup). Idempotente.

- **`adicionar_item_fatura` (o "Adicionar gasto" manual):** bloqueia lancar um item cujo nome ja foi PAGO
  como conta avulsa neste mes (HTTP 400 com msg amigavel), pra nao cobrar duas vezes pelo caminho manual.

Testado com script SQLite isolado (4 cenarios, 10 checks, todos OK): (1) avulsa paga + item duplicado ->
fatura cai de 50 pra 20 e a avulsa paga fica de historico; (2) avulsa nao paga -> migra; (3) sem avulsa ->
add 1x mesmo rodando varias vezes; (4) guard manual detecta a avulsa paga e libera gasto novo sem
conflito. `py_compile` OK. So back-end (main.py). Obs: se um duplicado antigo tiver sido lancado a mao numa
fatura SEM a assinatura estar vinculada, o gerador nao mexe nele — nesse caso e so apagar o item pela
lixeirinha na fatura.

### Etapa 38 — Historico: "pagamento de conta" agora mostra o NOME da conta (12/08/2026)

Pedido do Renan (print do historico): todo pagamento aparecia como "pagamento de conta" (generico) — nao
dava pra saber o que foi pago. Agora o lancamento carrega o nome: descricao vira "Pagamento: <nome da
conta>" e no historico o titulo mostra so o nome (ex.: "Conta de luz") com o subtitulo "Pagamento de
conta".

Detalhe importante: pagamento-de-conta e gasto-de-caixinha usam o MESMO `tipo='pagamento'` no banco; o
front so os separava pela igualdade exata `descricao === 'pagamento de conta'`. Entao mudei o
discriminador junto. Fixes:

- **main.py `pagar_conta`:** busca o `nome` da conta e grava `descricao = f"Pagamento: {nome}"` (antes era
  fixo "pagamento de conta").
- **main.py `desfazer_pagamento`:** procurava o lancamento por `descricao='pagamento de conta'`; agora
  aceita `descricao IN ("Pagamento: <nome>", "pagamento de conta")` — desfaz os novos E os antigos.
- **app.js `visualLanc`:** classifica como "Pagamento de conta" quando a descricao começa com
  "Pagamento: " OU é a antiga "pagamento de conta" (retrocompat); senao "Gasto de caixinha".
- **app.js `linhaHistorico`:** tira o prefixo "Pagamento: " do titulo (o subtitulo ja diz "Pagamento de
  conta"), evitando redundancia.

Testado com script SQLite isolado (8 checks, todos OK): desfazer acha/remove o pagamento novo sem tocar no
gasto de caixinha, ainda desfaz os antigos, e o front monta titulo/subtitulo certos nos 3 casos (novo,
gasto de caixinha, antigo). `py_compile` OK. Pagamentos ja feitos antes continuam como "pagamento de
conta" no historico (nao dava pra reconstruir o nome retroativo); os novos ja saem com o nome.

### Etapa 39 — Botoes de guardar/gastar direto na linha da caixinha (12/08/2026)

Pedido do Renan: alem dos formularios "Guardar dinheiro" e "Gastar de uma caixinha", ter botoes de
adicionar/retirar do lado de cada caixinha na lista. Feito: cada linha da caixinha agora tem 4 botoes na
ordem — **+ (Guardar, verde)**, **− (Gastar/tirar, vermelho)**, meta e apagar. Clicar abre um modal
(reaproveita o `abrirFormModal` do "definir meta") pedindo valor (+ descricao no gastar, + data opcional) e
chama os mesmos endpoints dos formularios: guardar -> POST /lancamentos tipo 'alocacao'; gastar -> tipo
'pagamento'. Adicionei 2 icones novos ao `ICONES` (mais/menos, so 2 linhas SVG). Validado no browser:
botoes renderizam na ordem certa com os SVGs; guardar R$300 gera body {tipo:'alocacao',
valor_centavos:30000,...}; gastar "Cinema" R$40 gera {tipo:'pagamento', descricao:'Cinema',
valor_centavos:4000,...}; valor 0/invalido e bloqueado com aviso e nao faz request. So front-end
(app.js). Os formularios antigos continuam (nada removido).

### Etapa 40 — Atrelar uma conta JÁ CRIADA a uma fatura (12/08/2026)

Pedido do Renan: antes so dava pra vincular uma ASSINATURA (recorrente) a uma fatura; uma conta avulsa ja
criada nao tinha como. Agora tem. Cada conta avulsa NAO paga ganha um botao "Atrelar a fatura" (icone de
cartao), que so aparece se existir alguma fatura nao paga. Clicar abre um modal com um select das faturas
disponiveis; ao confirmar, a conta vira ITEM da fatura e some da lista de contas avulsas (passa a ser
cobrada dentro da fatura, sem duplicar).

Implementacao:
- **main.py:** nova rota `POST /contas/{id}/mover-fatura` (reaproveita o model VincularFatura). Guards:
  404 se a conta nao existe; 400 se a conta e uma fatura, se ja foi paga, se a fatura alvo e invalida ou
  ja foi paga. Usa o vencimento da conta como data do item (senao hoje), faz dedup por nome+mes pra nao
  duplicar item, insere o `fatura_itens` e APAGA a conta avulsa.
- **app.js:** `abrirFormModal` agora aceita campo `tipo:'select'` (com `opcoes:[{valor,texto}]`); nova
  funcao `atrelarFatura(id)` (lista so faturas nao pagas de CONTAS, abre o modal, chama a rota); botao na
  linha da conta avulsa nao paga (so quando ha fatura disponivel).

Testado: backend com script SQLite (4 cenarios, 8 checks — mover ok/vira item e some; bloqueia conta paga;
bloqueia fatura paga; dedup nao duplica). Front no browser: modal lista so a fatura nao paga, gera POST
/contas/1/mover-fatura {conta_fatura_id:10}, sem fatura avisa; botao aparece na conta avulsa e NAO na
fatura. `py_compile` OK. Back + front (main.py, app.js).

### Etapa 41 — Ao atrelar conta de assinatura, oferecer vincular pra todo mês (12/08/2026)

Continuacao da Etapa 40. Quando a conta que o Renan atrela a uma fatura veio de uma ASSINATURA (recorrente
avulsa de mesmo nome), agora o app pergunta se quer vincular a assinatura tambem — pra ela cair direto na
fatura nos proximos meses, nao so agora. Se recusar, so a conta deste mes vai pra fatura (comportamento da
Etapa 40).

So front (app.js): expus as assinaturas num global `RECORRENTES` (setado em carregarRecorrentes); no
`atrelarFatura`, depois do mover-fatura dar certo, procuro uma recorrente com o mesmo nome e ainda avulsa
(conta_fatura_id null) e, se achar, abro o `confirmar(...)`. Se o usuario aceitar, chamo
POST /recorrentes/{id}/fatura com a mesma fatura. Um `carregarTudo()` so no fim.

Testado no browser (4 cenarios): (A) assinatura correspondente + aceita -> chama mover-fatura E
recorrentes/{id}/fatura; (B) aparece o confirm mas recusa -> so mover-fatura; (C) conta sem assinatura ->
sem confirm; (D) assinatura ja vinculada -> sem confirm. Nao duplica no mes atual porque o item ja foi
movido e o gerador ve o ja_item (Etapa 37). So app.js.

### Etapa 42 — Date picker com a nossa cara (calendário custom) (12/08/2026)

Pedido do Renan (print): o `<input type="date">` abria o calendario BRANCO nativo do navegador, destoando
do tema roxo/escuro. Como CSS nao estiliza o popup nativo, fiz um date picker custom que SUBSTITUI o
calendario nativo mantendo o `<input type="date">` por baixo — o `.value` continua "AAAA-MM-DD", entao
nada que le/grava data quebra.

Como funciona (app.js + styles.css):
- `dpInit()` cria um popup unico (`#dp-pop`) no body e usa **delegacao** de mousedown em captura: ao
  clicar num `input[type="date"]`, faz `preventDefault` (mata o nativo) e abre o nosso `dpAbrir(input)`.
  Delegacao cobre ate inputs de data criados dinamicamente (modais).
- Popup no tema do app (`--painel`, `--borda-2`, `--grad` no dia selecionado, `--roxo` no "hoje"),
  com navegacao de mes (‹ ›), grade 7 colunas, e acoes "Limpar"/"Hoje".
- Escolher um dia grava `AAAA-MM-DD` no input e dispara input/change. Fecha ao escolher, clicar fora, Esc,
  rolar ou redimensionar. Posiciona embaixo do campo (ou em cima se nao couber) e nao vaza pela direita.
- CSS: `color-scheme: dark` no input e `::-webkit-calendar-picker-indicator { opacity:0; pointer-events:none }`
  (o popup nativo so abre pelo iconezinho — desabilitando ele, so o nosso abre).

Testado no browser: popup abre "agosto de 2026", 31 dias, marca o hoje; navega meses; escolher dia 15
grava 2026-08-15 e fecha; "Hoje"/"Limpar" ok; fecha clicando fora. Estilos computados confirmam o tema
(fundo #141024, raio 16px, z-index 600, hoje com borda #8b5cf6). So front (app.js, styles.css). Obs: no
teste local via http.server o CSS pegou cache (o FastAPI real manda Cache-Control:no-store, entao em
producao carrega fresco).

### Etapa 43 — Ajuste do calendário de vencimentos (título e centralização) (12/08/2026)

Print do Renan ("tá estranho") do widget "Vencimentos do mes". Dois problemas:
1. **"Agosto De 2026"** — o `.cal-mes` tinha `text-transform: capitalize`, que deixava o conector "de"
   maiusculo (errado em pt-BR). O date picker novo (Etapa 42) tinha o mesmo bug no `.dp-mes`.
2. **Calendario grudado a esquerda** — o `#cal-widget` e capado em 400/340px, e como a Etapa 35 aumentou
   o `max-width` do `.principal` pra 2400 (preencher no zoom baixo), o painel do calendario ficou bem
   largo e o calendario sobrava um vao vazio grande a direita (medido: 251px no 1920).

Fixes (styles.css + app.js):
- Tirei `text-transform: capitalize` de `.cal-mes` e `.dp-mes`; agora capitalizo so a 1a letra no JS
  (`nomeMesRaw.charAt(0).toUpperCase()+slice(1)` no renderCalendario; idem no dpRender) -> "Agosto de 2026".
- `#cal-widget { max-width: 400px; margin-inline: auto }` — centraliza e um pouco maior (celula 44->53px).

Testado no browser (1920): titulo "Agosto de 2026", calendario 400px centralizado (96px de vao de cada
lado, simetrico), celula 53px. So front (styles.css, app.js).

### Etapa 44 — Renda automática não lança retroativo + rótulo claro da regra (13/08/2026)

Bug reportado pelo Renan: cadastrou uma renda automática (salário R$1700, dia 5) hoje (dia 13) e o app
"do nada" botou R$1700 nas entradas do mês e R$1200 numa caixinha (a regra de salário distribuindo),
dinheiro que ele nao colocou de proposito — e achou que nao aparecia no historico.

Diagnostico: reproduzi em SQLite e o BACKEND ESTAVA CORRETO/consistente — a entrada (1700) E a alocacao
da regra (1200) sao ambas lancamentos, aparecem no historico (mesma fonte /lancamentos que "entradas do
mes"), saldo livre = 500, caixinha = 1200. Nao era fantasma; o 1200 e a regra distribuindo parte do
salario. O incomodo real era o comportamento RETROATIVO: cadastrar dia 13 uma renda de dia 5 despejava o
salario do mes na hora. (O "nao aparece no historico" provavelmente era a entrada estar datada em 05/08,
la embaixo na lista, nao no topo — ou um filtro ativo.)

Decisao do Renan (perguntei): renda automatica deve **começar no proximo mes** quando o dia ja passou.

Fixes (main.py):
- Coluna nova `criada_em` em entradas_recorrentes (Postgres: no CREATE + `ALTER ... ADD COLUMN IF NOT
  EXISTS` pros bancos ja existentes; SQLite: no migrar() com PRAGMA). A rota de criar grava `data_hoje()`.
- `gerar_entradas_recorrentes`: pula se a data-alvo do mes for anterior a `criada_em` (nao lanca
  retroativo). Legado (criada_em NULL) continua lancando, sem regressao.
- `aplicar_regras_salario`: rotulo do lancamento passou de "regra: salário" pra "Regra salário → Reserva"
  (inclui a caixinha de destino), pra ficar claro no historico o que entrou e onde.

Testado com script SQLite (3 casos): criada dia 13 p/ dia 5 nao lanca agosto mas lanca setembro; criada
dia 3 lanca agosto; legado NULL lanca. `py_compile` OK. So back-end (main.py). Obs pro Renan: a renda de
teste que ele ja criou gerou os lancamentos deste mes (antes do fix); pra limpar, e so apagar no historico
a entrada "salário" e a alocacao da regra (botao de lixeira em cada linha), ou apagar/recriar a renda.

## Etapa 26 — Pagamento parcial de conta/fatura (10/08/2026)

Pedido do Renan: poder pagar **parte** de uma fatura (ex.: "quero pagar R$100 agora, não paguei tudo
ainda"), em vez de só quitar o total de uma vez.

**Modelo de dados:** nova coluna `conta_paga_id` em `lancamentos` (Postgres via `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`; SQLite via migração idempotente). Cada lançamento `pagamento` passa a **apontar
para a conta** que ele paga. Assim "quanto já foi pago" = soma dos pagamentos com aquele `conta_paga_id`
(helper novo `total_pago_conta`) — mantém a filosofia do app (nada de saldo guardado; tudo calculado
dos lançamentos). `financeiro.db` **não** precisa de nada manual: a coluna é criada sozinha no boot.

**Backend (`main.py`):**
- Rota nova `POST /contas/{id}/pagar-parcial` {caixinha_id, valor_centavos}: valida conta não-paga,
  `0 < valor ≤ restante` (restante = total − já_pago), caixinha do usuário com saldo; cria o pagamento
  ligado à conta; se o pagamento **zera** o restante, marca `paga=1`. Devolve `restante_reais` e `quitada`.
- `pagar_conta` (o "Pagar tudo") agora paga o **restante** (não o total cheio) e também grava
  `conta_paga_id` — então funciona certinho depois de parciais.
- `desfazer_pagamento` reescrito: apaga **todos** os pagamentos ligados à conta (devolvendo o dinheiro
  a cada caixinha de origem, porque saldo é calculado dos lançamentos) e volta `paga=0`. Funciona tanto
  numa conta quitada quanto **parcialmente** paga. Mantém fallback pro formato ANTIGO (pagamentos sem
  `conta_paga_id`, feitos antes desta mudança: casa por descrição+valor).
- `listar_contas` passa a devolver `pago_reais` e `restante_reais` por conta.

**Front (`app.js`):** na linha de cada conta não-paga, um campo de valor ("tudo") ao lado do seletor de
caixinha — vazio = paga tudo que falta (comportamento de sempre); com valor = pagamento **parcial**.
Conta parcialmente paga mostra "**pago R$X · faltam R$Y**" e ganha botão **Desfazer**. O card "Contas a
pagar" do topo passa a somar o **restante** (desconta o que já foi pago).

**Testado:** 17/17 no fluxo de pagamento parcial (parcial→parcial→quitar→desfazer, não deixa pagar acima
do restante, funciona em fatura E conta simples, desfazer devolve às caixinhas certas) + os 33 do smoke
test geral sem regressão + **teste visual no navegador**: paguei R$100 de R$500 pela UI → linha mostrou
"pago R$ 100,00 · faltam R$ 400,00", botão Desfazer apareceu, e o total caiu pra R$ 400,00; zero erros
de console.

## Etapa 27 — Anexar comprovante no cadastro da conta (auto-preenche) (12/09/2026)

Pedido do Renan: no cadastro de uma conta, poder **anexar um documento/comprovante** pra ler e preencher
as informações. Decisões dele: (1) o anexo **preenche** os campos (nome/valor/vencimento) pra conferir;
(2) **só lê na hora**, não guarda o arquivo (sem file storage); (3) **mantém** o painel separado "Ler
conta por foto ou PDF" que já existia na tela Importar.

**Só frontend** — reaproveita a rota `/importar/conta-imagem` (OCR) que já existe; **zero mudança no
backend**. No painel "Cadastrar conta" (tela Dívidas), um bloco novo `#ct-ocr-bloco`: área tracejada
"📎 Anexar foto ou PDF da conta" (clique ou arrasta). Ao anexar, `ctLerAnexo` lê como DataURL, manda pro
OCR e **preenche** `ct-nome`/`ct-valor`/`ct-venc` do próprio formulário, com um status ("✓ Li o comprovante
e preenchi nome, valor, vencimento. Confira antes de cadastrar." / aviso se não achou / erro). O bloco é
escondido quando o servidor não tem OCR (mesma checagem `/ocr-status` que já esconde o painel — importante:
**no Render sem Tesseract, o anexo não aparece**, igual ao painel existente). Status limpa ao cadastrar.

**Testado:** endpoint com a imagem real de exemplo → Energia / R$187,45 / 2026-08-20 ✓; no navegador
(SQLite + OCR local, token HS256): anexo dispara o fluxo real e **preenche o formulário** com esses
valores + mensagem de sucesso; bloco visível quando OCR disponível. Erro de arquivo inválido é tratado
com mensagem amigável (não quebra). Só mudou `index.html` + `app.js`.

## Etapa 28 — Tela de Licenças (assinaturas com periodicidade → agenda/fatura) (23/09/2026)

Pedido do Renan: uma tela de **controle de licenças** que a gente assina, conectada às faturas —
"cria a licença → bate na agenda → cria a fatura". Como as **Assinaturas** existentes já fazem
"recorrência mensal → conta/fatura", alinhei o que diferencia: **tela dedicada**, **periodicidade**
(mensal/trimestral/semestral/anual — o motor antigo só fazia mensal), campos **opcionais** e foco em
**uso pessoal** (nada de seats/enterprise). Decisões dele: tela nova; escolhe na hora se cai em conta
avulsa ou fatura; campos extras = **fornecedor** + **data de renovação** (juntei a renovação com o
vencimento numa data só — a próxima cobrança É a renovação; pra uso pessoal, duas datas confundem).

**Backend (`main.py`):** tabela nova `licencas` (nome, fornecedor, valor_centavos, periodicidade,
proximo_vencimento, tipo, conta_fatura_id, user_id) — criada sozinha no boot (SQLite `CREATE TABLE IF
NOT EXISTS` + DDL Postgres), **sem migração manual**. Helper `_avancar_periodo(data, periodicidade)`
soma 1/3/6/12 meses ajustando fim de mês (31/01 +mês → 28/02). `gerar_licencas(user_id)` gera, para
cada licença, as cobranças com vencimento ≤ fim do mês atual (este mês + atrasadas), como **conta
avulsa** (dedup por nome+vencimento) OU **item de fatura** (dedup por conta+desc+mês), e **avança o
próximo vencimento** pelo período. Roda ao criar a licença e dentro de `listar_contas` (junto de
`gerar_recorrentes_do_mes`), então as cobranças aparecem na agenda sozinhas. Rotas: `POST/GET/PUT/DELETE
/licencas` (isoladas por `user_id`, validam periodicidade/valor/data/fatura). Apagar a licença NÃO
apaga as cobranças já geradas (igual às assinaturas).

**Front (`index.html` + `app.js`):** item de menu "Licenças" (ícone novo `licenca`=medalha), tela com
lista + formulário (nome, fornecedor opcional, valor, periodicidade, vencimento/renovação, categoria,
"cobrar em" = avulsa ou fatura). `carregarLicencas` popula o select de faturas a partir de `CONTAS`
(chamado dentro de `carregarContas`). `criarLicenca`/`apagarLicenca` no padrão das assinaturas.

**Testado:** 20/20 no backend isolado (SQLite) — `_avancar_periodo` nas 4 periodicidades c/ ajuste de
fim de mês; criar licença avulsa gera a conta na agenda deste mês e avança o próximo p/ +1 ano; mensal
na fatura vira item (não vira avulsa); não duplica em recargas; validações; isolamento A×B; apagar
mantém a cobrança gerada. **Teste visual no navegador**: tela renderiza, criei "Windows 11 Pro" (anual,
avulsa) → conta R$99 na agenda + próx. 2027; "Figma" (mensal, na fatura) → item de R$45 na fatura;
"Contas a pagar R$144" batendo; zero erros de console.

## Etapa 29 — Previsão Financeira (Mudança 1 do plano de evolução) (23/09/2026)

Primeira das 7 mudanças do plano. Objetivo: mostrar **para onde o saldo vai**, projetando os eventos
certos até uma data. Decisões combinadas com o Renan: base = **saldo total** (livre + caixinhas);
entram **só eventos certos** (contas a pagar pelo restante, assinaturas, licenças, renda automática);
períodos **7 / 30 / 60 dias + fim do mês + próximo mês**; apresentação = **cards + gráfico + alerta de
saldo negativo**. "Próximo mês" = projeta até o fim do mês seguinte; valor desconhecido = R$0.

**Backend (`main.py`):** `import calendar`. Motor `projetar_financas(user_id, ate_iso)` + helpers
`saldo_total` (livre + soma das caixinhas), `_dia_no_mes` (dia seguro no mês, ajusta fim de mês) e
`_iter_meses`. Antes de projetar, materializa o presente (`gerar_entradas_recorrentes`,
`gerar_recorrentes_do_mes`, `gerar_licencas`) e só **projeta o futuro** — evita contar em dobro. Eventos:
(1) contas não pagas no horizonte pelo **restante**; (2) entradas recorrentes (mês atual ainda não
recebido + futuras, dedup por nome+mês); (3) recorrentes só para meses **após** o atual; (4) licenças a
partir do `proximo_vencimento` avançando pela periodicidade. Ordena, monta a **série** do saldo no tempo
e detecta o 1º dia de **saldo negativo**. Rota `GET /previsao?ate=AAAA-MM-DD` (só leitura, valida a data).
Decisão registrada: contas **vencidas e não pagas** (vencimento no passado) não entram na projeção pra
frente — a previsão é de hoje em diante (dívidas atrasadas podem virar alerta próprio na Mudança 4).

**Front (`index.html` + `app.js`):** item de menu "Previsão" (ícone novo `previsao`=linha subindo) entre
Análise e Categorias. Tela com chips de período (7/30/60/fim do mês/próximo mês), banner de alerta
(negativo/positivo), 4 cards (saldo atual → +entradas → −saídas → saldo projetado), gráfico de linha do
saldo no tempo (Chart.js, vermelho se cruza o zero) e lista de eventos com origem. `carregarPrevisao`
chamado ao abrir a aba; `prevAteDate` calcula a data final por período.

**Testado:** 14/14 no backend isolado (SQLite) — saldo total como base, contas como saída pelo restante,
filtro de horizonte, renda futura do mês, alerta de negativo, série ordenada, validação de data,
isolamento A×B. **Navegador**: cenário saldo R$2.450 + salário + 2 contas + assinatura → cards (atual
R$2.450 / +R$1.700 / −R$327,25 / projetado R$3.822,75), gráfico e eventos corretos; "próximo mês" soma
o salário 2× (R$3.400) corretamente; zero erros de console. Mudou `main.py` + `index.html` + `app.js`.

## Etapa 30 — Orçamento por categoria (Mudança 2 do plano de evolução) (23/09/2026)

Segunda mudança. Objetivo: teto de gasto por categoria, comparando limite × quanto já gastei no mês.

**Descoberta que guiou o desenho:** hoje só as **dívidas/contas** têm categoria (o campo `tipo`); o
**gasto livre** (`saida_livre`) não guardava categoria, e a pizza da Análise mostra caixinhas, não
gasto por categoria. Ou seja, "quanto gastei por categoria" não existia de verdade. Decisões combinadas
com o Renan: base = **mistura** (gasto livre passa a ter categoria **auto-sugerida pela palavra, editável**
— uber→transporte etc.); limite **mensal, editável, valendo do mês em diante** (meses passados guardam o
que tinham); alerta em **dois níveis** (amarelo ≥80%, vermelho ao estourar); pagar dívida **consome** o
teto da categoria (tipo da conta); gastos antigos ficam "sem categoria" (não dá pra recategorizar o
passado); orçamento é só teto de **despesa**.

**DB:** coluna `categoria` em `lancamentos` (SQLite migrar + Postgres ALTER; só o gasto livre usa, antigos
NULL). Tabela nova `orcamentos` (categoria, mes 'AAAA-MM', limite_centavos, user_id) — criada no boot.

**Backend (`main.py`):** `sugerir_categoria(con,user,desc)` mapeia palavra→categoria mas só retorna se o
usuário tiver essa categoria (case-insensitive). `criar_lancamento` grava a categoria do gasto livre (a
que veio do front ou a sugerida). `gasto_por_categoria(con,user,mes)` soma gasto livre (por categoria) +
dívidas pagas (categoria = `tipo` da conta ligada por `conta_paga_id`) no mês. `limite_categoria` pega a
linha mais recente com mes ≤ o pedido ("vale deste mês em diante"). Rotas `GET /orcamento?mes=` (por
categoria: limite, gasto, restante, pct, status ok/atencao/estourou/sem_teto; razão crua decide o status
p/ não disparar alerta por arredondamento), `POST /orcamento` (define/edita), `DELETE /orcamento`. Apagar
categoria remove seus tetos.

**Front (`index.html` + `app.js`):** menu "Orçamento" (ícone alvo) + tela com seletor de mês (◀▶ e
input month), resumo (teto/gasto/resta/%), barras por categoria (verde/🟡≥80%/🔴 estourou), edição do
teto inline e botão de remover. No "Tirar do saldo livre": campo Categoria com auto-sugestão ao digitar
(espelho do MAPA_PALAVRAS; não sobrescreve se o usuário escolher na mão).

**Testado:** 24/24 no backend isolado (SQLite) — teto, gasto livre + dívida paga consumindo, auto-sugestão,
80%/estouro, "vale deste mês em diante" (out=900→nov herda→set 800→ago sem teto), remoção herda anterior,
isolamento A×B, validações, limpeza ao apagar categoria. **Navegador** (salário R$8.000; tetos
Alim.R$800/Transp.R$300/Contas R$400): Alimentação 🟡 R$680 (85%), Transporte 🔴 R$350 (117%, estourou
R$50), Contas R$220 vindo de uma dívida (Luz) paga; auto-sugestão uber→Transporte, mercado→Alimentação,
netflix/pizza→vazio; editar teto inline e navegar de mês (herança) OK; zero erros reais no console.
(Obs.: instalei `httpx` no Python local — dependência do TestClient de teste, não afeta o app.)

## Etapa 31 — Orçamento: redesenho do front (23/09/2026)

O Renan achou o front do Orçamento cru ("está ruim"): lista achatada, input "teto" minúsculo sempre
visível em cada linha, sem hierarquia. Redesenhei (só `app.js` + `styles.css`, sem tocar no backend):
- **Resumo hero** com barra geral colorida por status + 3 números (Consumido / Resta / Categorias com teto).
- **Cards por categoria** (grade responsiva, 1 coluna no celular): nome + pill de status
  ("No limite · 55%" verde / "Atenção · 85%" amarelo / "Estourou · 117%" vermelho), gasto/teto grande,
  barra com gradiente por status, "Resta"/"Estourou" embaixo.
- **Edição só ao clicar**: input aparece ao tocar em ✏️ (editar) ou "+ Definir teto"; tem prefixo R$,
  botões salvar (✓) e cancelar (✕), Enter salva / Esc cancela. Categorias sem teto ficam em card
  tracejado discreto. Ícones novos `salvar` (check) e `fechar` (X).

**Testado no navegador (desktop + mobile 375px):** hero/cards/pills/barras corretos; edição abre-salva-
cancela; salvar recalcula na hora (Alimentação 800→900 → pill verde 76%, hero R$1.600/78%); empilha no
celular; zero erros de console.

**Ajuste (23/09/2026):** o seletor de mês (`input type=month`) aparecia branco no tema escuro; corrigido
com `color-scheme: dark` + `filter` no ícone do calendário (`#orc-mes` no styles.css).

## Etapa 32 — Comparação entre meses (Mudança 3 do plano de evolução) (23/09/2026)

Terceira mudança. Objetivo: comparar dois meses e ver onde subiu/caiu. Decisões do Renan: mostrar
**resumo (entrou/saiu/sobrou) + por categoria**; formato **gráfico + tabela**; **ele escolhe os dois meses**.

**Backend (`main.py`):** `totais_mes(con,user,mes)` — entrou = entradas; saiu = gasto livre + dívidas
pagas (fora transferências, `descricao NOT LIKE 'transferência%'`); sobrou = entrou - saiu (poupar em
caixinha não conta). Rota `GET /comparar?mes_a=&mes_b=` devolve resumo dos dois meses + gasto por
categoria em cada (reaproveita `gasto_por_categoria` da Mudança 2; une categorias do cadastro e as que
tiveram gasto; ordena pelo gasto do mês B). Sem mexer no banco.

**Front (`index.html`+`app.js`+`styles.css`):** menu "Comparar" (ícone barras) + tela com dois seletores
de mês (base vs comparar com; padrão mês anterior × atual), 3 cards de resumo com variação colorida,
gráfico de barras agrupadas (Chart.js) e tabela por categoria (categoria · mês A · mês B · variação).
Regra de cor: a **seta** (▲/▼) mostra a direção e a **cor** mostra se é bom/ruim — gastar mais = vermelho
(mesmo com seta pra cima), gastar menos = verde; entrar/sobrar mais = verde. `cmpVar(a,b,maiorEhBom)`.

**Testado:** 13/13 no backend isolado — totais, exclusão de transferência e de poupança, dívida paga na
categoria, união/ordenação de categorias, isolamento A×B, validação. **Navegador** (ago × set): Entrou
R$6.000 ▲+20% (verde), Saiu R$920 ▲+5% (vermelho), Sobrou R$5.080 ▲+23% (verde); tabela Alimentação
▲+70% (vermelho), Transporte/Lazer ▼−50% (verde); gráfico agrupado OK; zero erros de console.
Comparação por categoria só é fiel de set/2026 em diante (quando o gasto passou a ter categoria).

## Etapa 33 — Alertas financeiros (Mudança 4 do plano de evolução) (23/09/2026)

Quarta mudança. Objetivo: juntar num lugar só os pontos de atenção, usando os motores que já existem
(sem "IA", tudo por regras). Decisões do Renan: os **4 gatilhos**; exibir em **sino no topo + card na
Visão geral**; **só no app** por enquanto (mas com estrutura pronta pra notificação futura); "gasto fora
do padrão" = **+50% e ≥R$50**.

**Backend (`main.py`):** `import json`. `gerar_alertas(con,user)` junta: (1) contas não pagas vencendo
≤5 dias (média) ou atrasadas (alta), pelo restante; (2) saldo negativo nos próximos 60 dias via
`projetar_financas` (alta); (3) categoria do mês estourando (alta) / ≥80% (média) via `gasto_por_categoria`
+ `limite_categoria`; (4) categoria +50% e ≥R$50 vs mês anterior (média). Cada alerta tem `chave` estável,
`tipo`, `severidade`, `titulo`, `mensagem`, `tela`; ordenados por gravidade. Rotas `GET /alertas` (lista +
`nao_lidos`, marca `novo` por alerta) e `POST /alertas/marcar-lidos` (guarda as chaves ativas em
`config['alertas_vistos']` — base pra, no futuro, só notificar o que é novo). `reais_txt`, `_mes_anterior`,
`_fmt_data_br` auxiliares. Sem mexer no banco (usa a tabela `config`).

**Front (`index.html`+`app.js`+`styles.css`):** sino no cabeçalho (ícone `sino`) com badge de não-lidos e
painel dropdown (pip colorido por gravidade; fecha ao clicar fora; abrir chama marcar-lidos e zera o
badge). Card "Alertas" na Visão geral com os 3 principais + "+N outros" (some sem alertas). Clicar num
alerta leva pra tela relacionada (contas/previsao/orcamento/comparar). `carregarAlertas` roda no
`carregarTudo`.

**Testado:** 12/12 no backend isolado — 4 gatilhos, conta a 40 dias não alerta, ordenação, contador de
não-lidos, marcar-lidos zera, alerta novo reconta, isolamento A×B. **Navegador**: badge=6, card na Visão
geral, painel com 6 alertas ordenados e mensagens claras; abrir zera badge; clicar navega e fecha; ok no
mobile; zero erros de console. Alertas de categoria/padrão só valem de set/2026 em diante.

## Etapa 34 — Cartão de crédito (Mudança 5 do plano de evolução) (23/09/2026)

Quinta mudança, a mais complexa. Decisões do Renan: cartão como **entidade nova**; escopo **completo**
(limite + disponível, parcelas, fatura mensal automática, vincular assinaturas/licenças); **tela nova
"Cartões"**; fechamento **padrão de cartão** (depois do fechamento vai pro mês seguinte); disponível =
**limite − tudo em aberto** (incl. parcelas futuras). Construído e testado em partes.

**DB:** tabela `cartoes` (nome, limite_centavos, dia_fechamento, dia_vencimento). Colunas novas:
`contas.cartao_id` + `contas.competencia` (a fatura mensal é uma conta tipo_conta='fatura' ligada ao
cartão e marcada com AAAA-MM); `recorrentes.cartao_id` e `licencas.cartao_id`. Tudo aditivo (IF NOT EXISTS
/ migração SQLite), compatível com faturas/assinaturas/licenças antigas.

**Backend (`main.py`):** helpers `_competencia_compra` (fechamento decide o mês), `_somar_meses`,
`_vencimento_fatura`, `_achar_ou_criar_fatura`, `_usado_cartao`. Rotas `POST/GET/PUT/DELETE /cartoes` e
`POST /cartoes/{id}/compra` (à vista ou parcelada: parcela 1 na competência da compra, demais nos meses
seguintes; divide igual e a última absorve a sobra). `GET /cartoes` traz limite/usado/disponível +
faturas (competência, vencimento, total, paga). Apagar cartão não perde histórico (faturas viram
avulsas; assinaturas/licenças desvinculadas). Geradores `gerar_recorrentes_do_mes` e `gerar_licencas`
ganharam o caminho do cartão (item na fatura da competência do vencimento, com dedup por conta+descrição).
Modelos `NovoCartao`/`NovaCompra`; `cartao_id` em NovaRecorrente/NovaLicenca (validado).

**Front (`index.html`+`app.js`+`styles.css`):** menu "Cartões" (ícone `cartaocred`) + tela: cadastro
(nome/limite/fechamento/vencimento), cartão com barra de limite usado/disponível (verde/amarelo/vermelho,
mostra estouro), form de compra (descrição/valor/parcelas) e lista de faturas (competência, vencimento,
total, tag Em aberto/Paga), editar/apagar. Nos selects "cobrar em" de assinaturas e licenças agora
aparece "Cartão: X" (value `cartao:ID`) além das faturas individuais; `criarRecorrente`/`criarLicenca`
mandam `cartao_id`. `carregarCartoes` roda no `carregarTudo` antes de contas (pros selects).

**Testado:** 30/30 no backend isolado (24 core + 6 vínculo) — competência por fechamento, parcelas c/
sobra na última, limite/disponível, pagar fatura libera limite, bloqueio de lançar em fatura paga,
validações, isolamento, apagar desvincula; assinatura dia 10→fatura do mês, dia 28→mês seguinte, licença
mensal no cartão, sem duplicar ao recarregar. **Navegador (desktop+mobile)**: cadastro e compra pela UI,
parcelada 10x espalhando nas 10 faturas, estouro de limite em vermelho, select "cobrar em" com cartões;
zero erros de console. Obs.: parcela em N meses cria N faturas (correto, mas gera muitas linhas — dá pra
resumir "próxima fatura" no Dashboard na Mudança 6).

## Etapa 35 — Reorganização do Dashboard (Mudança 6 do plano de evolução) (23/09/2026)

Sexta mudança. Objetivo: transformar a Visão geral num painel de comando, reaproveitando as áreas novas
(M1–M5). Decisões do Renan: adicionar os **4 widgets-resumo**; abordagem **reordenar + adicionar** (mantendo
os blocos atuais); **Registrar entrada continua em destaque**. Só front, sem backend/DB.

**Front (`index.html`+`app.js`+`styles.css`):** container `#resumos-dash` na Visão geral, entre o card de
Alertas e o streak. `carregarResumosDash()` (chamado no `carregarTudo`) monta 4 cards clicáveis
(`resumoCardHTML`, `irPara`): (1) **Próxima fatura** — a fatura de cartão não paga mais próxima a vencer,
de `CARTOES` (valor restante + data + cartão); (2) **Orçamento do mês** — `GET /orcamento?mes=atual`,
gasto vs teto total + mini-barra (verde/amarelo≥80%/vermelho>100%) + % consumido; (3) **Saldo projetado**
— `GET /previsao?ate=fim do mês`, saldo projetado + aviso vermelho se `saldo_negativo`; (4) **Gasto vs
mês passado** — `GET /comparar` (mês anterior × atual), saída do mês + variação colorida (`cmpVar`, gastar
mais = vermelho). As 3 chamadas rodam em paralelo (`Promise.all`), cada uma com fallback "—"/dica. CSS
`.resumos-dash` (grid 4 → 2 → 1 col) e `.resumo-card`. Ordem final: cards de saldo → Alertas → 4 resumos
→ streak → Registrar entrada + caixinhas + calendário + pizza (tudo mantido).

**Testado (navegador desktop + mobile):** 4 resumos com números corretos (Próxima fatura R$450 Nubank
05/10; Orçamento R$930/R$1.200 78% barra verde; Saldo projetado R$3.370,10; Gasto vs mês passado R$930
▲+55% vermelho); clique navega pra tela certa; empilha no celular; zero erros de console. Estados vazios
graciosos pra quem não usa a área ("Cadastre um cartão", "Sem teto definido").

## Etapa 36 — Insights / inteligência financeira (Mudança 7 do plano — a última) (23/09/2026)

Sétima e última mudança do plano. "Inteligência" por **regras** (sem IA): a conta é feita no código
(exata) e vira dica. Decisões do Renan: os **4 tipos** (padrões, economia, assinaturas esquecidas, metas)
e **tela nova "Insights"**. Também alinhamos que IA de verdade fica pra uma **Mudança 8** (assistente/
categorização/insights escritos por IA) — a explicação de custos/caminhos (Claude pago, free tier a custo
zero tipo Gemini/Groq, ou modelo local Ollama) ficou registrada no chat.

**Backend (`main.py`):** `gerar_insights(user_id)` + `GET /insights`. PADRÃO: categoria que mais cresceu
vs mês passado (dif ≥ R$30), maior despesa do mês, dia da semana que mais gasta (últimos 90 dias, com
preposição certa "no sábado"/"na segunda"). ECONOMIA: categoria que subiu ≥30% e ≥R$50 (quanto
economizaria voltando ao patamar anterior), categoria que estourou o teto. ASSINATURAS: nº de
recorrentes+licenças e total normalizado por mês (÷ período) e por ano — sugere revisar. METAS:
`_sobra_media` (média do sobrou nos últimos 3 meses com movimento); por caixinha com meta, meses pra bater
no ritmo da sobra (ou "meta batida"). Helpers `_sobra_media`, `_nome_categoria_real`, `_DIAS_SEMANA`.
Reaproveita totais_mes/gasto_por_categoria/limite_categoria/saldo_da_caixinha. Sem DB novo.

**Front (`index.html`+`app.js`+`styles.css`):** menu "Insights" (ícone `insight` = lâmpada) + tela que
agrupa os insights em 4 seções (`INSIGHT_GRUPOS`), cada dica num card clicável que leva pra tela
relacionada (comparar/orcamento/historico/licencas/caixinhas). Estado vazio orienta o que fazer.

**Testado:** 10/10 no backend isolado — os 4 tipos disparando, soma de assinaturas (R$100/mês), sobra
média, prazo de meta, isolamento A×B. **Navegador**: 4 grupos com números corretos, clique navega, zero
erros de console.

### 🎉 Plano de evolução (7 mudanças) COMPLETO
M1 Previsão · M2 Orçamento · M3 Comparar · M4 Alertas · M5 Cartões · M6 Dashboard · M7 Insights.
Próximo passo opcional: Mudança 8 = IA de verdade (a escopar).

## Etapa 37 — Tela de Configurações (Mudança 8) (23/09/2026)

Nova frente (fora das 7 do plano), pedida pelo Renan: uma tela de Configurações no estilo da do Claude,
centralizando notificações/alertas e regras. Decisões: alertas com **liga/desliga + ajuste de limiares**;
**mover a tela Regras pra dentro** de Configurações (sai do menu); extras = **preferência de menu
recolhido** + **atalhos** pra Categorias e Caixinhas.

**Backend (`main.py`):** `_ALERTAS_DEFAULT` + `_config_alertas(con,user)` (default + o que o usuário salvou,
na tabela `config`, key `alertas_config`). `gerar_alertas` reescrito pra **respeitar** a config: cada tipo
só roda se `on`, e usa os limiares — conta (dias), saldo (horizonte), orçamento (% de atenção), padrão
(% de alta + piso em centavos). Rotas `GET /config/alertas` (default+salvo) e `POST /config/alertas`
(modelo `ConfigAlertasIn` com validações: dias 1–60, horizonte 7–365, orçamento 50–100%, padrão 10–500%).
Sem tabela nova.

**Front (`index.html`+`app.js`+`styles.css`):** item de menu "Regras" virou "Configurações" (ícone
`config`=engrenagem). Seção `#regras` renomeada pra `#configuracoes` com 3 blocos: (1) Notificações e
alertas — `#cfg-alertas` renderizado por JS (`carregarConfig`/`cfgLinha`) com um interruptor (switch CSS
`.sw`) + campo de limiar por tipo, botão "Salvar alertas" (`salvarConfigAlertas` → recarrega sino e
resumos); (2) Regras de salário + entradas automáticas (movidas, mesmos ids/JS); (3) Preferências —
interruptor "menu recolhido" (`togglePrefMenu`, usa o `sb_menu_oculto` que já existia) + atalhos
`irPara('categorias'/'caixinhas')`. `titulos` e gancho de menu atualizados. Nenhuma referência órfã à
tela `regras`.

**Testado:** 8/8 no backend isolado — desligar um tipo remove o alerta; ajustar limiar muda o disparo
(conta 4 dias some com limiar 2; orçamento 85% some com aviso a 90%); `GET` reflete o salvo; validações.
**Navegador**: menu sem "Regras" e com "Configurações"; 4 controles; desligar "Conta vencendo" + salvar
derrubou o badge do sino de 2→1 (e gravou no backend); switch de menu recolhido persiste; Regras operam
na nova casa; zero erros de console.

## Etapa 38 — Assistente por regras, custo zero (Mudança 9) (23/09/2026)

Recurso que "parece IA" mas roda 100% em regras (custo zero, privado). Decisões do Renan: 4 perguntas no
chat; categorização que aprende no modo "só sugere"; "posso comprar?" completo; tela nova "Assistente"
com cara de chat (balões). (IA de verdade segue reservada pra uma futura Mudança 10, se ele quiser.)

**DB:** tabela nova `aprendizado_categoria` (descricao_norm, categoria, user_id) — Postgres DDL + SQLite.

**Backend (`main.py`):** `_norm_desc` + `_aprender_categoria` (upsert 1 por descrição). `criar_lancamento`
aprende a categoria confirmada quando salva um saida_livre com categoria. `sugerir_categoria` reescrita:
consulta o aprendido primeiro (descrição igual), depois o MAPA_PALAVRAS; só retorna categoria que ainda
existe. `GET /aprendizado-categoria` (mapa pro front). `GET /assistente?q=...` responde com número
calculado: `sobra` (livre + entrou/saiu/sobrou do mês), `resumo` (totais + maior despesa), `pagar`
(soma restante das contas/faturas em aberto + próxima a vencer via `_contas_a_pagar`), `gasto_categoria`
(gasto vs teto), `posso_comprar` (à vista: cabe no livre? mês fecha negativo pela previsão? / cartão:
cabe no disponível? parcela ~R$X). Validações (categoria/valor).

**Front (`index.html`+`app.js`+`styles.css`):** menu "Assistente" (ícone `chat`) + tela com `#chat-msgs`
(balões `.chat-bolha` user/bot) e `#chat-chips` (perguntas sugeridas). `carregarAssistente`, `chatMsg`,
`perguntaDireta`, `perguntaGastoCategoria`/`respGastoCategoria` (chips de categoria), `perguntaPossoComprar`/
`respPossoComprar` (form inline: valor + à vista/cartão + parcelas). `APRENDIDO` (mapa) carregado no
`carregarTudo`; `sugerirCategoriaGasto` usa o aprendido antes do mapa de palavras.

**Testado:** 12/12 no backend isolado — aprende "Mercadinho João → Alimentação" e reaplica sozinho; as 5
respostas; posso_comprar à vista (pode/não dá) e no cartão (cabe/estoura); validações. **Navegador**:
perguntas diretas respondem certo (sobra R$4.070; "R$185 a pagar, vence 20/09"); "R$300 à vista → Pode,
sobrariam R$3.770"; "R$1.200 cartão 3x → Cabe no Nubank, ~R$400/parcela"; digitar "Mercadinho João" no
gasto auto-seleciona Alimentação; zero erros de console. Cara de chat (balões roxo/escuro, chips).

**Correção de bug (23/09/2026):** não dava pra criar cartão ("dê um nome" mesmo com nome preenchido).
Causa: colisão de IDs — o formulário de Nova conta (Dívidas) e o de Novo cartão usavam ambos `ct-nome`
(e o cartão reusava `ct-limite/ct-fechamento/ct-vencimento/ct-btn`). `getElementById` pegava o 1º (campo
vazio da conta). Corrigido renomeando os campos do cartão pra `card-nome/card-limite/card-fechamento/
card-vencimento/card-btn` (conta segue `ct-`). Verificado no navegador: cartão criado OK.

**Correção de bug — Postgres (23/09/2026):** Comparar, Insights e o chat (resumo/sobra) davam "Internal
Server Error" no site (frontend mostrava 'Unexpected token I, "Internal S"... is not valid JSON'). Causa:
em `totais_mes` a query tinha `NOT LIKE 'transferência%'` com o `%` LITERAL na string SQL. Como o wrapper
`_ConexaoPG` roda `sql.replace("?","%s")` e passa parâmetros ao psycopg2, o `%` literal era interpretado
como formatação → estourava (só no Postgres; no SQLite não, por isso passou nos testes). Corrigido passando
o padrão como PARÂMETRO: `NOT LIKE ?`, ("transferência%"). Regra pra frente: nunca deixar `%` literal em
SQL com parâmetros — sempre no valor. Testado no SQLite (comparar/insights/assistente = 200; saiu ignora
transferência/alocação). Obs.: instalei psycopg2-binary local só pra diagnóstico.

**Correção CRÍTICA de deploy (23/09/2026):** os deploys de `f522d52` e `54da171` estavam FALHANDO no
Render (Failed deploy) — por isso os fixes anteriores não subiam e Comparar/Insights/chat seguiam com 500.
Causa (vista no log do Render): no boot, `criar_tabelas()` roda o DDL no Postgres e uma instrução dava
`psycopg2.errors.QueryCanceled: canceling statement due to statement timeout` → o import do `main.py`
crashava → "Exited with status 1" → deploy falha. Provável lock em ALTER/CREATE INDEX enquanto a instância
antiga ainda atendia (comum no free). Correção: no bloco Postgres de `criar_tabelas`, cada DDL agora roda
na PRÓPRIA transação com try/except — um erro/timeout é apenas logado e PULADO (o schema já existe em prod,
DDL é idempotente), então o app sobe mesmo assim. Adicionado `SET lock_timeout='3000ms'` (lock preso falha
rápido) e método `rollback()` no `_ConexaoPG`. Testado no SQLite (import OK; comparar/insights/assistente/
orcamento = 200). Junto vai o fix do `%` literal (`54da171`).

## Etapa 39 — Senha: trocar no 1º login + esqueci a senha (Mudança 10) (23/09/2026)

Pedido do Renan. Cadastro fica FECHADO (ele cria as contas com senha temporária), então: 1º login força
definir senha + recuperação por e-mail + trocar senha em Configurações. Mínimo 6 (padrão Supabase). Tudo
via Supabase Auth (GoTrue) no front — a senha nunca passa pelo nosso backend. Sem backend novo, sem DB.

**Front (`index.html`+`app.js`):** tela `#tela-nova-senha` (reusada pra 1º login e recuperação) + link
"Esqueci minha senha" no login + painel "Segurança 🔒" em Configurações (trocar senha). JS: `_jwtPayload`
/`_precisaTrocarSenha` (lê `user_metadata.precisa_trocar_senha` do JWT), `entrarApp` (entra OU força
definir senha), `iniciar` agora detecta o link de recuperação (`#type=recovery&access_token=...`) antes de
tudo, `atualizarSenhaSupabase` (PUT /auth/v1/user com o token + apikey), `abrirNovaSenha`/`salvarNovaSenha`
(no 1º login grava `precisa_trocar_senha:false`; na recuperação limpa o hash da URL), `esqueciSenha`
(POST /auth/v1/recover), `trocarSenha` (Configurações). `sair` também esconde a tela de nova senha.

**Como o 1º login sabe que é o 1º:** flag `precisa_trocar_senha:true` no `user_metadata` do usuário. O
Renan (admin) seta esse flag ao criar a conta no Supabase; quem não tem o flag (usuários já existentes)
não é incomodado. Depois de definir a senha, o app marca o flag como false.

**DEPENDE de config no Supabase (a fazer no painel):** (1) pro "esqueci a senha": e-mail ativo + a URL do
site nas **Redirect URLs**/Site URL (senão o link de recuperação não volta pro site); (2) pro 1º login:
criar o usuário já com `user_metadata {"precisa_trocar_senha": true}`. Vou guiar pela extensão do Chrome.

**Testado (navegador, com as chamadas ao Supabase STUBADAS pra não mexer em conta real):** 1º login com
o flag → tela "Bem-vindo! Defina sua senha"; validações (mín. 6 / não confere); sucesso marca o flag;
Configurações tem "Segurança" e valida; link "Esqueci" presente; link de recuperação (`#type=recovery`)
em load fresco abre "Redefina sua senha" com o token do hash. Zero erros de console. (Ponta a ponta real
— troca de senha e e-mail — depende da config do Supabase acima.)

## Etapa 40 — Gestão de usuários pelo app (admin) (Mudança 11) (23/09/2026)

Pedido: gerir usuários por dentro do sistema (hierarquia admin × usuário), sem visitar o Supabase.
O admin cria/reseta senha/bloqueia/apaga; usuário comum vê tudo, menos a área de Usuários.

**Segurança:** operações de admin usam a **service_role key** do Supabase (chave mestra) que fica SÓ no
backend (env `SUPABASE_SERVICE_ROLE_KEY`), nunca no front. O backend confere a cada chamada que o
solicitante é o admin: `ADMIN_EMAIL` (env) comparado ao claim `email` do JWT.

**Backend (`main.py`):** `exigir_admin` (403 se não for o admin; 500 se faltar service key), `_supabase_admin`
(chama a Admin API do GoTrue com a service_role, trata erros). Rotas: `GET /me` (diz `is_admin`/`admin_pronto`
pro front mostrar a área), `GET /admin/usuarios` (lista), `POST /admin/usuarios` (cria com `email_confirm:true`
+ `user_metadata.precisa_trocar_senha:true` → força trocar no 1º login), `POST /admin/usuarios/{id}/resetar-senha`
(nova senha + flag), `POST .../bloquear` e `.../desbloquear` (via `ban_duration`), `DELETE /admin/usuarios/{id}`.
Admin não pode bloquear/apagar a si mesmo.

**Front (`index.html`+`app.js`):** item de menu "Usuários" (ícone `usuarios`) que só aparece pro admin
(`/me` no `carregarTudo` liga/desliga). Tela: lista (e-mail, último acesso, tags admin/bloqueado/trocar
senha) com ações (resetar/bloquear/desbloquear/apagar, com confirmação) + form "Novo usuário". Se o
servidor não tiver service key, mostra aviso amigável em vez de erro.

**Testado:** 8/8 na autorização (SQLite) — admin detectado pelo e-mail, não-admin 403, admin sem key 500,
sem token 401. **Navegador:** admin vê o menu e a tela (com aviso de "não configurado" sem key local);
não-admin não vê o menu; zero erros de console. As operações reais (criar/resetar/etc.) dependem de
configurar no Render: `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_EMAIL` (a fazer, com guia pela extensão).

## Etapa 41 — Hierarquia de papéis: super admin / admin / usuário (Mudança 11.2) (25/09/2026)

Evolução da Etapa 40: em vez de "1 admin × resto", agora são **3 níveis**.
- **super** = quem está em `ADMIN_EMAIL` (env). Faz tudo, inclusive tornar/remover admin. Fixo, ninguém mexe.
- **admin** = usuário com `user_metadata.role == "admin"`. Gerencia SÓ usuários padrão: criar, resetar senha,
  bloquear/desbloquear. **NÃO apaga** e **NÃO promove** (decisão do Renan: "sem apagar").
- **user** = padrão, uso normal, sem a tela de Usuários.

**Backend (`main.py`):** helpers `_papel` (ator, via JWT: email→super, `user_metadata.role`→admin),
`_papel_usuario` (alvo, via Supabase), `_eh_super`, `_pode_gerir_alvo` (regra central: super age sobre
qualquer um; admin só sobre `user`), dependência `exigir_super`, e `_buscar_usuario` (lê o alvo antes de agir).
`/me` agora devolve `papel`/`is_super`. Criar: admin só cria padrão; admin de verdade só o super cria.
Resetar/bloquear: admin só sobre padrão; ninguém bloqueia o super; **reset preserva o `role`** (merge do
metadata, não sobrescreve). Apagar virou `exigir_super`. Novos: `POST /admin/usuarios/{id}/promover` e
`/rebaixar` (só super, com merge do metadata).

**Front (`index.html`+`app.js`):** global `IS_SUPER`; a lista de Usuários mostra a tag do papel
(super admin/admin) e adapta os botões — admin não vê "Apagar" nem "Tornar/Remover admin"; super vê tudo
e ganha os botões Promover/Rebaixar. Seletor de "Papel" no form Novo usuário só aparece pro super.

**Segurança:** promover/rebaixar/apagar só do super (evita escalada por admin comum). Todas as checagens no
servidor, validando ator E alvo. Metadata mesclado (nunca apaga o `role` ao resetar senha). Obs.: como o
papel do ator vem do JWT, uma promoção/rebaixamento só vale pro alvo no **próximo login** dele (token novo).

**Testado:** 29/29 na matriz de autorização (SQLite isolado + tokens HS256 + Admin API do Supabase mockada):
quem cria/reseta/bloqueia/apaga/promove sobre quem, com as barreiras (admin não toca em admin/super, admin
não apaga, só super promove, ninguém bloqueia o super, ninguém age sobre si em ações destrutivas).

**Render configurado (25/09/2026):** `ADMIN_EMAIL=renangaming12@gmail.com` (super admin) + `SUPABASE_SERVICE_ROLE_KEY`
adicionados no serviço (via extensão no dashboard; o Renan colou a chave secreta). A partir daqui a área de
Usuários funciona de verdade em produção.

## Etapa 42 — OCR em produção via Docker (novo serviço no Render) (25/09/2026)

Problema: em produção o `/ocr-status` era `false` — o leitor de conta por foto (Tesseract) ficava escondido.
Causa: o serviço no Render rodava no **runtime nativo "Python 3"**, que não instala programa de sistema
(`apt`). O repo já tinha um `Dockerfile` que instala `tesseract-ocr` + `tesseract-ocr-por`, mas o Render
**não deixa trocar o runtime de um serviço existente** (Python → Docker é definido na criação).

Solução: criado um **serviço novo com runtime Docker** apontando pro mesmo repo (o Render detectou o
Dockerfile sozinho). Feito em paralelo, sem derrubar o antigo:
- Novo serviço: **Sistema-Financeiro-2** (`srv-daraphid0e5s73e1et7g`), Docker + Free, branch `main`.
- **URL nova: `https://sistema-financeiro-2.onrender.com`** (sem sufixo aleatório).
- Env vars: as 12 migradas (Postgres + Supabase + `ADMIN_EMAIL` + `SUPABASE_SERVICE_ROLE_KEY`).
- Supabase: **Site URL** trocado pro `-2` e **Redirect URLs** com as duas (antiga mantida na transição).

Verificado no ar: `/` = 200, `/ocr-status` = **`true`** (OCR ativo — Tesseract no container), `/me` sem token
= 401. Renan testou no navegador: login + hierarquia (Etapa 41) + OCR (tela Contas → "Ler conta por foto ou
PDF") **funcionando**. O serviço antigo (`srv-d9t18u142hec73btjmk0`, Python, OCR off) vai ser aposentado.

Pendências: aposentar o serviço antigo; rotacionar os segredos (service_role/JWT/senha do DB passaram por
canal a mais); MFA (Mudança 12, Supabase → Authentication → Multi-Factor).

## Etapa 43 — Verificação em duas etapas (2FA/TOTP) (Mudança 12) (25/09/2026)

2FA opcional por usuário, via app autenticador (TOTP). Decisões do Renan: trava no front **e** no
backend (reforço real) + super admin pode resetar o 2FA de alguém (anti-lockout).

**Chave do design:** o flag `mfa_ativo` fica em **`app_metadata`** (não `user_metadata`), porque
`app_metadata` só a **service_role** escreve — o usuário não consegue editar pra burlar a trava. E como
`app_metadata` vem dentro do JWT, o backend confere **sem chamada extra por requisição**.

**Backend (`main.py`):**
- `_exigir_mfa(dados)`: se `app_metadata.mfa_ativo` e o token não for nível **`aal2`**, 401 `MFA_REQUERIDO`.
  Chamado em `exigir_login` e `exigir_admin` (fora do try, pra o 401 propagar).
- `POST /mfa/ativar` (exigir_login): confirma que o usuário tem um fator TOTP **verificado** (Admin API) e
  liga `mfa_ativo=true` via service_role.
- `POST /mfa/desativar` (exigir_login → já exige aal2 pra quem tem 2FA): apaga os fatores TOTP + zera o flag.
- `POST /admin/usuarios/{uid}/resetar-mfa` (exigir_admin + hierarquia): apaga fatores + zera flag (super
  qualquer um; admin só padrão).
- Helpers `_tem_totp_verificado`, `_set_mfa_flag` (merge do app_metadata), `_apagar_totp`.

**Front (`app.js`+`index.html`):** enroll/challenge/verify vão **direto no Supabase** com o token (igual
troca de senha). Configurações → painel "Verificação em duas etapas" (Ativar mostra QR + secret + confirma
código; Desativar). Overlay `tela-mfa` no login (código de 6 dígitos) disparado por `_mfaPendente(token)`
(app_metadata.mfa_ativo + aal!=aal2) em `entrarApp`/`iniciar`, e como backstop pelo `pedir()` ao ver
`MFA_REQUERIDO`. Tela Usuários ganhou botão "Resetar 2FA". Ao verificar, o Supabase devolve um token aal2
que substitui o TOKEN (localStorage).

**Testado local (SQLite + HS256 + Admin API mockada): 16/16** — trava aal1/aal2 (com e sem MFA), `/mfa/ativar`
(400 sem fator, 200 + liga flag), `/mfa/desativar` (apaga fator + zera flag), `resetar-mfa` (hierarquia).
Hierarquia da Etapa 41 revalidada: 29/29 (a checagem de MFA não afeta quem não tem 2FA). Pegadinha nos
testes: `_carregar_env_local` faz `setdefault`, então pra forçar SQLite tem que setar `PGHOST=""`/`DATABASE_URL=""`
(string vazia), não remover a var.

**Pendente:** habilitar TOTP no Supabase (Authentication → Multi-Factor) e teste real do fluxo (QR + código
de um app autenticador) no app publicado — não dá pra automatizar.

## Etapa 44 — Telegram, Fase 1: fundação (vínculo + webhook + avisos) (25/09/2026)

Início do "auxiliar por Telegram" (bot completo virá em fases). Fase 1 = a fundação: conectar a conta com
segurança + webhook + avisos por cron externo. Renan escolheu: bot completo (4 capacidades) mas construído
por partes; código primeiro (bot/token depois); avisos disparados por cron externo grátis.

**Segurança do vínculo:** o app gera um **código único de 15 min** atrelado ao usuário logado; o usuário abre
o bot pelo deep link `t.me/<bot>?start=<código>` e o webhook casa código→user_id, gravando o `chat_id`.
Assim ninguém controla a conta pelo chat sem estar logado no app antes. Token do bot e secret do webhook só
no backend. Webhook protegido por secret (no path E no header `X-Telegram-Bot-Api-Secret-Token`).

**DB:** tabela `telegram (user_id PK, chat_id, codigo, expira, avisos)` — criada no boot (SQLite + Postgres).

**Backend (`main.py`):** `TELEGRAM_BOT_TOKEN` (env), `TELEGRAM_WEBHOOK_SECRET` (env ou derivado do token).
Rotas: `GET /telegram/status`, `POST /telegram/conectar` (gera código + deep link via getMe), `/desconectar`,
`/avisos` (toggle), `POST /telegram/webhook/{secret}` (trata `/start código` e vincula; valida secret),
`POST /telegram/registrar-webhook` (só super — chama setWebhook e devolve a `cron_url` pronta),
`POST /telegram/disparar-avisos?secret=` (o cron externo chama; manda os alertas — reusa `gerar_alertas` —
pra cada usuário vinculado com avisos on). URL pública vem de `RENDER_EXTERNAL_URL`/`APP_URL`.

**Front (`app.js`+`index.html`):** painel "Telegram" em Configurações — Conectar (abre o deep link), Desconectar,
toggle de avisos, e (super) botão "Registrar webhook" que mostra a URL do cron pra copiar.

**Testado local (SQLite + Telegram mockado): 17/17** — status, conectar (código+link), webhook vinculando +
mensagem "Conectado", secret errado 403, avisos on/off, disparar-avisos (cron, 403 sem secret), código
inválido avisa, registrar-webhook só super + setWebhook com a URL certa, desconectar.

**Falta o Renan fazer (fundação no ar):** criar o bot no BotFather → `TELEGRAM_BOT_TOKEN` no Render →
Configurações → Registrar webhook → colar a `cron_url` num cron grátis (cron-job.org, POST, 1x/dia). Fases
2-4 (registrar por mensagem, assistente, foto/OCR) ficam pra depois.
