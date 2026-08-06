# Guia do sistema financeiro pessoal

Documento único de referência para levar ao Figma e depois programar.
Uso pessoal, rodando no seu próprio computador, sem publicação para outras pessoas por enquanto.

---

## 1. A ideia em uma frase

Um app onde você dá um destino para cada real que entra, guarda o dinheiro
em "caixinhas" (envelopes) e registra cada gasto sempre tirando de uma caixinha
específica, até o saldo livre chegar a R$ 0,00 (orçamento base zero).

---

## 2. Os quatro conceitos de dinheiro

Antes das telas, entenda os quatro movimentos. Toda a lógica gira em torno deles.

1. **Entrada** — dinheiro que chega de fora (salário). Aumenta o saldo livre.
2. **Alocação** — mover parte do saldo livre para uma caixinha. Diminui o saldo livre, aumenta a caixinha.
3. **Pagamento / gasto** — dinheiro que sai para fora, sempre puxado de uma caixinha. Diminui a caixinha.
4. **Transferência** — mover dinheiro de uma caixinha para outra. Não muda o total, só troca de bolso.

Regra de ouro: **dinheiro nunca some nem aparece do nada.** Todo movimento tem origem e destino.

---

## 3. As quatro telas

### Tela 1 — Dashboard (visão geral)
O painel para bater o olho e entender a saúde do mês.
- Três números no topo: Salário, Dívidas obrigatórias, Saldo disponível.
- Barra de distribuição do dinheiro (quanto foi para cada categoria).
- Progresso das metas e caixinhas (barras de porcentagem).

### Tela 2 — Meu saldo
O detalhe do dinheiro e as caixinhas.
- Saldo livre em destaque no topo.
- Três cards: Entradas, Comprometido (dívidas), Nas caixinhas.
- Lista das caixinhas com o valor de cada uma.
- **Botão "Transferir"** para remanejar entre caixinhas (abre popup C).

### Tela 3 — Dívidas e despesas
As obrigações do mês.
- Dois números: Total do mês, Ainda resta pagar.
- Filtros: Todas, Cartões, Contas fixas, Outros.
- Cards por conta com ícone, nome, tipo, vencimento e valor.
- Botão **[ Pagar ]** que fica verde ao clicar (abre popup B para escolher a caixinha).
- Botão **[ + Adicionar conta ]** (abre popup A).
- Contas já pagas aparecem no fim da lista, com opacidade reduzida.
- Vencimentos futuros aparecem aqui, não no histórico.

### Tela 4 — Histórico e extrato
O livro-caixa, imutável, agrupado por data (Hoje, Semana passada...).
- Verde (+) para entradas.
- Vermelho (−) para contas pagas.
- Azul (−) para gastos tirados de caixinhas.
- Cinza para transferências entre caixinhas (neutro, não é entrada nem gasto real).

---

## 4. Os três popups

### Popup A — Adicionar conta (a partir da Tela 3)
Campos: nome, valor, vencimento, tipo (Cartão / Conta fixa / Outros),
checkbox "Repetir todo mês" (conta recorrente).
Cria uma dívida futura. Ainda NÃO mexe em dinheiro.

### Popup B — Pagar puxando da caixinha (a partir da Tela 3)
Mostra a conta que está sendo paga e pergunta de qual caixinha sai o dinheiro.
A caixinha mais provável já vem pré-selecionada.
Ao confirmar, acontecem três coisas ao mesmo tempo:
- a conta vira "Pago" verde na Tela 3;
- a caixinha escolhida perde o valor (Tela 2);
- surge uma linha azul no histórico (Tela 4).

### Popup C — Transferir entre caixinhas (a partir da Tela 2)
Escolhe origem, destino e valor. Mostra em tempo real como cada caixinha
vai ficar depois. Não muda o saldo total nem o saldo livre.
No histórico, vira uma linha cinza neutra.

Padrão visual dos três popups: mesma largura, cabeçalho com ícone,
botão confirmar à direita em azul, cancelar à esquerda neutro.

---

## 5. Como programar (a stack que você já definiu)

- **Back-end:** Python + FastAPI (a inteligência e as regras).
- **Banco:** SQLite (um arquivo local, sem servidor).
- **Front-end:** HTML + CSS + JavaScript, consumindo a API.
- Tudo roda no seu computador. Como é uso pessoal, não precisa de login,
  senha, nem hospedagem. Você abre o navegador no `localhost` e usa.

### 5.1 Modelagem do banco (as tabelas)

Pense em quatro tabelas. É o mínimo que faz o método fechar.

**caixinhas**
- id
- nome (ex.: "Lazer")
- meta (opcional, valor que você quer juntar)
- saldo_atual

**contas** (as dívidas/despesas da Tela 3)
- id
- nome
- valor
- vencimento (data)
- tipo ("cartao", "fixa", "outro")
- recorrente (sim/não)
- paga (sim/não)

**lancamentos** (o histórico da Tela 4 — o coração de tudo)
- id
- data
- tipo ("entrada", "alocacao", "pagamento", "transferencia")
- valor
- caixinha_origem_id (pode ser vazio, ex.: numa entrada)
- caixinha_destino_id (pode ser vazio, ex.: num pagamento para fora)
- conta_id (só quando o lançamento paga uma conta)
- descricao

**config** (opcional)
- salario_mensal, mês de referência etc.

### 5.2 A regra mais importante de programação

**Nunca edite o saldo de uma caixinha "na mão".** O saldo é sempre a soma
dos lançamentos que entraram menos os que saíram. Assim o histórico e os
saldos nunca ficam diferentes um do outro. Cada botão do app cria um
lançamento; o saldo é recalculado a partir deles.

Isso te dá a Tela 4 de graça: o histórico é simplesmente a tabela de
lançamentos ordenada por data.

### 5.3 Guarde dinheiro em centavos, como número inteiro

R$ 60,00 vira o número `6000`. Nunca use número quebrado (float) para
dinheiro — dá erro de arredondamento chato de achar depois. Divide por
100 só na hora de mostrar na tela.

### 5.4 O que cada botão faz no back-end

- **Registrar salário** → cria lançamento tipo "entrada". Aumenta saldo livre.
- **Criar/alocar caixinha** → cria lançamento tipo "alocacao". Tira do saldo livre.
- **Pagar conta (popup B)** → cria lançamento tipo "pagamento" com caixinha_origem e conta_id; marca a conta como paga.
- **Transferir (popup C)** → cria lançamento tipo "transferencia" com origem e destino.

### 5.5 O "saldo não alocado" (o objetivo do base zero)

Saldo livre = Entradas − tudo que já foi alocado em caixinhas.
Quando chega a R$ 0,00, o indicador fica verde: todo o dinheiro tem destino.
É só uma conta, não precisa de tabela própria.

---

## 6. Ordem sugerida para construir (não faça tudo de uma vez)

1. Banco + as quatro tabelas.
2. Registrar entrada e criar caixinhas (fazer o saldo livre zerar).
3. Pagar conta puxando da caixinha (o núcleo do dia a dia).
4. Transferência entre caixinhas (o que segura o método quando algo estoura).
5. Histórico lendo a tabela de lançamentos.
6. Só depois: gráficos e comparação entre meses (consome muito tempo; deixe para uma versão 2).

Fazer UM mês funcionar redondo, com pagamento e transferência, vale mais
que dez telas pela metade.

---

## 7. Cuidados de UX para o Figma

- Consistência nos popups (mesmo layout, mesmos botões nos mesmos lugares).
- Cores com significado fixo: verde entrada, vermelho conta paga, azul gasto de caixinha, cinza transferência.
- Sempre mostrar o "antes e depois" em movimentos de dinheiro (como o quadro no popup de transferência), para evitar erro.
- Pré-selecionar a opção mais provável (a caixinha certa ao pagar) para poupar cliques.
