# Backlog de ideias — Sistema de Orçamento

> ✅ **STATUS (06/08/2026 — Etapa 20):** IMPLEMENTADOS e testados: **M1, M2, M4, E1, E2, E3(OFX/CSV), E4, E5, E6, E8, E9**. Ver detalhes no [[diario_projeto_financeiro]] (Etapa 20). **Falta:** E3-PDF (precisa `pdfplumber`), M2-investimento automático (só rendimento manual feito), e a fase online (segurança, Supabase, hospedagem, **E7 Web Push**, Cold Start) — ver [[plano_online_gratuito]].

> Origem: documento `Sistema de Orçamento.docx` (Desktop do Renan), analisado em **06/08/2026**. Contém texto + 4 prints das telas com marcações em vermelho nos espaços vazios. Este arquivo consolida TUDO que o documento pede, separado por: **manutenção** (ajustes no que já existe), **expansões futuras** (features novas) e **online/segurança** (já detalhado em [[plano_online_gratuito]]). Regra de ouro do projeto: um bloco por vez, testar, backup do `financeiro.db` antes de mudança de estrutura (⚠).

---

## 🔧 Manutenção do APP (ajustes no que já existe)

| # | Ideia | Detalhe | Status |
|---|-------|---------|--------|
| M1 | **Arquivar contas antigas** (não apagar) | Limpar a poluição visual das contas pagas. | Novo — ver decisão abaixo |
| M2 | **Rendimento de investimento** | Registrar rendimento (ex.: **CDI do Nubank**) num tipo próprio de lançamento. | Novo — ver decisão abaixo |
| M3 | **Principais gastos do mês** | Preencher o espaço vazio da Análise mostrando onde mais se gasta. | ✅ **FEITO** (Etapa 19) |
| M4 | **Contador de dias pra vencer** | Quando faltar **7 dias** pro vencimento de uma conta, mostrar ao lado "faltam X dias". | Novo — casa com E7 (Web Push) |

**Decisões de arquitetura (refinamento 06/08/2026):**

- **M1 → Arquivar, NUNCA apagar (`DELETE`).** No Orçamento Base Zero, apagar dado do passado quebra os relatórios de meses anteriores. Em vez de `DELETE`, usar **`UPDATE conta SET arquivada = TRUE`**: a conta some da tela de dívidas mas o valor fica intacto no banco, e a Análise Histórica não perde precisão. Arquivamento pode ser **manual** ou **automático após um tempo**. ⚠ migração (coluna `arquivada`).
- **M2 → Rendimento é um tipo de lançamento próprio, não "Entrada".** Rendimento NÃO pode ser classificado como entrada normal (tipo salário), senão distorce a métrica de "quanto você ganha". Criar o tipo de lançamento **`Rendimento`**: ele vai **direto pra caixinha específica** (ex.: Reserva), **ignorando o Saldo Livre** e **sem inflar o gráfico "Entrou no mês"**. Cabe num espaço vazio do dashboard. ⚠ migração (novo tipo de lançamento).
- **M4 → é puramente Front-end (JS).** Só uma regra na função que calcula datas: **`se (vencimento − hoje) <= 7 e > 0 → exibe a tag de contagem regressiva`**. Sem migração.

**Espaços vazios marcados em vermelho nos prints:**
- **Tela Caixinhas** (img2): grande área vazia embaixo da lista de caixinhas — candidata a **Termômetro/Runway (E1)** ou **Streaks (E5)**.
- **Tela Análise** (img3): área vazia embaixo do "Resumo do mês" — era pros **Principais gastos (M3)**, já preenchida.

---

## 🚀 Expansões Futuras (features novas)

### E1 — Termômetro do Mês (Runway / Burn Rate)
Calcula a **velocidade de gasto** de cada caixinha e avisa quando o dinheiro vai acabar.
> "No seu ritmo atual de gastos da caixinha 'Lazer', o dinheiro vai acabar no dia 20."
- **Como:** média de gasto/dia da caixinha no mês → projeta a data que zera. Puro cálculo, sem migração.
- **Onde:** cabe no espaço vazio da tela Caixinhas (img2) ou como cartão na Análise.

### E2 — Previsão de Fatura + Alocar assinatura na fatura
Cruzar as assinaturas recorrentes com os gastos já feitos e **projetar a fatura final**.
> "Sua fatura atual está em R$ 400, mas com as assinaturas pendentes, fechará em R$ 450."
- **Regra pedida:** poder **alocar assinaturas pendentes dentro da fatura de um cartão** → ela soma na fatura aberta; a abertura da fatura se repete todo mês automaticamente; a assinatura se realoca automaticamente todo mês — **mas com opção de alocar manualmente cada assinatura e editar** caso mude a forma de pagamento.
- **Status:** este é exatamente o **"Mover conta para a fatura"** já desenhado no [[diario_projeto_financeiro]] (rota `POST /contas/{id}/mover-para-fatura`, marcar como "movida" e não apagar pra dedup não recriar). ⚠ migração + backup.
- **Arquitetura (refinamento 06/08/2026):** a tabela de assinaturas (`recorrentes`) precisa de um **campo de relacionamento (Foreign Key)** apontando pra tabela `contas` (a fatura do cartão). Assim o sistema sabe que "Spotify" pertence ao "Cartão Nubank" e **soma automaticamente no dia de fechamento**. Alocação padrão automática, mas com opção manual + editar quando muda a forma de pagamento.

### E3 — Leitor de Extrato (Importação OFX / CSV / PDF)
Área tracejada "arraste seu extrato aqui". O back-end Python lê as dezenas de linhas de uma vez, **tenta adivinhar a caixinha pela descrição** (ex.: "Uber" → Transporte) e salva tudo num segundo — usuário só confere de qual caixinha saiu cada gasto.
- **Sem conexão direta com banco** (evita burocracia do BC). Só arquivo baixado do internet banking, ou PDF com os gastos → jogar nas dívidas.
- **Puxar só os valores** referentes a gastos (valor, data, validade) — **não** puxar nome de pessoa.
- **Complexidade:** alta (parsing de formatos + classificação por palavra-chave). ⚠ migração (tabela de regras de classificação).

### E4 — Gatilhos de Salário (regras automáticas)
Regra programada pelo usuário:
> "Toda vez que eu registrar a entrada 'Salário', mande 10% pra caixinha Reserva e 20% pra Investimentos."
- **Como:** tela nova pra **criar/editar/remover** regras (gatilho = descrição da entrada; ações = % ou valor → caixinha). Ao registrar a entrada, o back aplica as regras. ⚠ migração (tabela `regras_salario`).

### E5 — Ofensivas (Streaks)
Contador de **"dias seguidos dentro do orçamento"** ou **"meses seguidos poupando mais do que gastou"**. Fica no **dashboard principal** (ou no espaço vazio da tela Caixinhas).
- **Como:** cálculo em cima do histórico. Puro cálculo, sem migração pesada.

### E6 — Encerramento do Mês ("Spotify Wrapped" financeiro)
Todo **dia 1º**, na primeira abertura do site, um **pop-up** com resumo visual do mês que passou:
> "Você guardou R$ 300, seu maior gasto foi em Alimentação, e você atingiu 1 meta!"
- **Como:** guardar o snapshot do mês (armazenar mês a mês) numa tela nova ou dentro da Análise; marcar "já mostrei este mês" pra não repetir. ⚠ migração (tabela de fechamento mensal).

### E7 — Web Push Notifications
Notificações reais do navegador (mesmo com o app fechado).
> "Sua fatura do Nubank vence amanhã, não esqueça de pagar através da caixinha!"
- **Regra importante pedida:** a assinatura **só dispara aviso conforme o destino**:
  - se está **dentro da fatura de um cartão** → avisa na **data que a fatura vence**;
  - se está **fora (avulsa)** → avisa na **data de vencimento da própria conta**.
- Depende de E2 (saber se a conta está na fatura). Casa com M4 (contador de dias). **Só faz sentido depois do app estar online 24/7** (precisa de servidor pra disparar).

### E8 — Metas com prazo / data limite (ex.: IPVA)
Em vez de só "quero juntar R$ 1.200", o usuário diz **"tenho que pagar R$ 1.200 de IPVA em Janeiro"**.
- **Matemática:** o sistema calcula quantos meses faltam até a data limite e mostra aviso mensal obrigatório:
  > "Faltam 4 meses. Você precisa transferir R$ 300 do Saldo Livre pra caixinha IPVA neste mês."
- **Onde:** nova função dentro de **Dívidas** ou um **painel novo** (descrição + valor-alvo + data limite + meta mensal calculada). Estende a `meta_centavos` que já existe nas caixinhas. ⚠ migração (coluna de data-limite).

### E9 — Atalhos de teclado
Mapear teclas pra ações diretas:
- **E** → abre modal "Nova Entrada" com cursor no valor · **Enter** salva · **Esc** fecha · **G** → abre "Registrar Gasto".
- **Complexidade:** baixa (só front-end / JS). Deixa o uso muito mais rápido.

---

## ☁️ Online 24/7 + Segurança (já planejado)

O documento repete o plano de subir pra nuvem e a lista de segurança — **já está detalhado em [[plano_online_gratuito]]**. Resumo do que o docx reforça:

- **Migração p/ 24/7:** recomendação **Supabase** (Postgres grátis 24/7 + painel visual tipo Excel no navegador). → Etapa 3 do plano.
- **Segurança antes de expor:**
  1. **Vazamento de chaves** → variáveis de ambiente / `.env` (cofre do Render), nunca senha no código no GitHub.
  2. **SQL Injection** → ORM (SQLAlchemy) ou placeholders certos (hoje já usamos `?`, o que já protege).
  3. **XSS** → hoje o front usa muito `innerHTML` (ex.: `lista.innerHTML = CAIXINHAS.map(...)`); um nome de caixinha com `<script>` executaria. Back valida/limpa com Pydantic e bloqueia (erro 400). **Ponto de atenção real do nosso código atual.**
  4. **Força bruta no login** → **Rate Limiting** (5 erros → bloqueia o IP por 15 min).
  - **De graça já vem:** HTTPS (Render) + isolamento de banco (Supabase).

> Tudo isso é pré-requisito de multi-usuário → ver ordem correta (Etapa 0→6) no [[plano_online_gratuito]].

### Ponto faltante — tratar o "Cold Start" (UX, refinamento 06/08/2026)
O servidor grátis (Render) **dorme** e pode levar **30–50 s pra acordar** no 1º acesso do dia. Sem tratar isso, a pessoa acha que travou e fecha a página.
- **O que fazer:** **Tela de Carregamento / Spinner no botão de Login**. Se o servidor demorar a responder na 1ª vez, o front exibe mensagem amigável:
  > "Despertando o servidor seguro, isso pode levar alguns segundos..."
- Front-end puro. Entra junto com a Etapa 4 (hospedagem) do [[plano_online_gratuito]].

---

## Ordem sugerida (rápido → pesado)

1. **E9 atalhos de teclado** e **E5 streaks** — baratos, só front/cálculo, dão resultado visível já.
2. **E1 termômetro/runway** — cálculo, preenche o espaço vazio das Caixinhas.
3. **M1 apagar contas antigas** e **M4 contador de dias** — pequenos ajustes.
4. **E8 metas com prazo (IPVA)** — estende meta que já existe. ⚠ migração leve.
5. **E2 previsão + mover assinatura pra fatura** — já desenhado, ⚠ migração.
6. **E4 gatilhos de salário** e **E6 wrapped mensal** — telas novas, ⚠ migração.
7. **E3 leitor de extrato** — o mais complexo.
8. **Online + segurança + E7 push + M2 investimento** — só depois da fundação online (plano à parte).

> Nada aqui foi construído (exceto M3, já feito). Próximo passo: Renan escolhe por onde começar.
