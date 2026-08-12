# Manual do usuário — Meu Orçamento

> ⚠️ **Atualização (fase SaaS, 10/08/2026):** o app virou **multi-usuário, hospedado no Render/Supabase**.
> O **login agora é por e-mail e senha** (Supabase Auth) — não é mais senha única, e cada usuário é criado
> manualmente no Supabase. Novidade: **Entradas automáticas** (renda recorrente que lança sozinha e já
> distribui nas caixinhas — fica na tela **Regras**). O resto do dia a dia (caixinhas, dívidas, importar
> com filtro de mês, etc.) segue igual. Parte técnica atualizada em `documentacao_tecnica.md`; histórico
> no `diario_projeto_financeiro.md` (Etapas 23–32).

> Guia prático de **como usar o app** no dia a dia (atualizado em 06/08/2026, reflete o estado atual).
> Para a parte técnica (dados, rotas, código), ver `documentacao_tecnica.md`. Para o histórico de
> decisões, `diario_projeto_financeiro.md`.

---

## 1. A ideia em uma frase

Você dá um **destino para cada real** que entra: guarda o dinheiro em **caixinhas** (envelopes) e
registra cada gasto tirando de uma caixinha, até o **saldo livre** chegar a R$ 0,00 (orçamento base zero).

**Regra de ouro:** dinheiro nunca some nem aparece do nada — todo movimento tem origem e destino.

---

## 2. Primeiro acesso e login

- Na primeira vez, o app pede pra você **criar uma senha** (mínimo 4 caracteres). Ela protege seus dados.
- Nas próximas vezes, é só digitar a senha pra entrar. A sessão dura 30 dias.
- Não há "recuperar senha" (é um app local): se esquecer, a senha é resetada apagando o arquivo do banco.

---

## 3. Os tipos de movimento

| Movimento | O que faz |
|-----------|-----------|
| **Entrada** | Dinheiro que chega (salário). Aumenta o saldo livre. |
| **Guardar (alocação)** | Move do saldo livre para uma caixinha. |
| **Gasto/pagamento** | Sai de uma caixinha para fora (compra, conta paga). |
| **Transferência** | Troca dinheiro entre caixinhas (não muda o total). |
| **Rendimento** | Juros/CDI que caem numa caixinha. Não conta como entrada nem mexe no saldo livre. |
| **Saída do saldo livre** | Sai dinheiro que ainda não estava guardado em caixinha. |

---

## 4. As telas (menu à esquerda)

### 🏠 Visão geral (dashboard)
Bate o olho e entende a saúde do mês:
- Cards no topo: **saldo livre**, entradas do mês, guardado em caixinhas, contas a pagar.
- **Streak** 🔥 "N meses seguidos poupando" (aparece quando você gasta menos do que ganha).
- **Registrar entrada** (atalho: tecla **E**).
- **Pizza** de distribuição das caixinhas.

### 🐷 Caixinhas
Onde o dinheiro mora:
- Lista das caixinhas com saldo, **meta** (barra de progresso) e, se a meta tem **prazo**, quanto
  guardar por mês pra atingir a tempo (ex.: "guarde R$ 164,33/mês até janeiro").
- **Termômetro do mês** 🌡️: no seu ritmo de gastos, quando cada caixinha zera.
- Formulários: nova caixinha, novo banco, **guardar** dinheiro, **registrar rendimento** 📈,
  **transferir**, **gastar** de uma caixinha (atalho **G**), **tirar do saldo livre**.
- Definir/editar meta: clique no ícone de alvo na caixinha (ele pergunta o valor e, opcionalmente, a data-limite).

### 💳 Dívidas
As contas a pagar:
- Tabela com vencimento, valor e **status** (Pago / Vencido / Vence hoje / **Faltam X dias** quando ≤7 / A vencer).
- **Pagar**: escolhe a caixinha de onde sai o dinheiro. **Desfazer** reverte.
- **Fatura de cartão**: uma conta do tipo "fatura" soma vários gastos (clique na seta pra abrir e lançar itens).
- **Arquivar**: conta paga pode ser arquivada (some da lista, mas fica no histórico). Botão "Arquivar
  pagas antigas" limpa de uma vez; "Ver arquivadas" mostra/restaura.
- **Assinaturas** (repetem todo mês): cadastre e escolha "Cobrar em" → conta avulsa **ou dentro da
  fatura de um cartão** (aí ela soma na fatura automaticamente todo mês). Dá pra trocar isso a qualquer hora.

### 📋 Histórico
O extrato completo, agrupado por **mês** (com resumo de entradas/saídas) e por dia. Filtros
(Tudo/Entradas/Saídas/Caixinhas) e busca por descrição.

### 📊 Análise
Visão do mês: entrou, saiu, sobrou; % gasto; principais gastos; para onde foi o dinheiro. Botão
**"Ver retrospectiva"** 🎉 mostra o resumo de um mês escolhido.

### 🏷️ Categorias
Gerencia os rótulos usados nas contas e assinaturas (Conta fixa, Cartão, Outros — e os que você criar).

### ⚡ Regras
**Regras de salário**: "quando entrar uma **Salário**, guarde 10% na Reserva" (porcentagem ou valor
fixo). Ao registrar a entrada com esse nome, o app faz a alocação sozinho.

### 📥 Importar
Arraste o **extrato do banco** (OFX ou CSV) — o app lê os lançamentos, adivinha a caixinha pela
descrição, e **você revisa antes de salvar**. (Foto/PDF de conta ainda não; ver `estudo_ocr_conta_imagem.md`.)

---

## 5. Retrospectiva mensal

No primeiro acesso de um mês novo, aparece um **pop-up** com o resumo do mês anterior (quanto entrou,
saiu, guardou, maior gasto). Dá pra reabrir a qualquer momento pela tela Análise.

---

## 6. Atalhos de teclado

- **E** → abre "Registrar entrada"
- **G** → abre "Gastar de uma caixinha"
- **Enter** → salva o formulário (no campo de valor)
- **Esc** → tira o foco do campo

---

## 7. Dicas de uso

- **Zere o saldo livre**: guarde tudo em caixinhas até o saldo livre bater R$ 0,00 (é o objetivo do base zero).
- **Meta com prazo** é ótima pra despesas grandes futuras (IPVA, viagem): o app te diz quanto guardar por mês.
- **Assinatura na fatura**: se você paga Netflix/Spotify no cartão, vincule à fatura — some tudo num lugar só.
- **Importar** o extrato uma vez por mês economiza digitação.
- **Backup**: de vez em quando, copie o arquivo `financeiro.db` (é onde estão todos os seus dados).
