# Plano — Colocar o app online (multi-usuário) de graça

> Objetivo: sair do "app pessoal, local, uma senha só" para um "app que amigos usam do celular, cada um com seus próprios dados, hospedado na nuvem, custando R$ 0". Documento de planejamento — nada aqui foi construído ainda. Ver decisões e etapas já feitas no `diario_projeto_financeiro.md`.

Data do plano: 21/07/2026.

---

## Resumo honesto: é grátis?

**Sim, dá pra rodar custando R$ 0** na escala de poucos amigos. Os "poréns" dos planos gratuitos são **limitações** (arestas), não taxas escondidas.

- **Custo real:** R$ 0 pra funcionar. Único gasto **opcional**: domínio próprio (~R$ 40/ano) — dá pra usar o endereço grátis da hospedagem (`xxx.run.app` / `seu-app.onrender.com`).
- **Arestas do grátis (não custam, mas incomodam):**
  - Servidor **hiberna** quando ninguém usa → 1º acesso demora alguns segundos pra "acordar".
  - Supabase **pausa** o projeto após ~1 semana SEM uso (dados NÃO somem, só religar). Se os amigos usam, não pausa.
  - Limites de uso (requisições, tamanho do banco) — bem acima do que uns amigos gastam.
- Tirar as arestas (nunca hibernar, mais capacidade) = pago, só se um dia crescer.

> O que custa mesmo não é dinheiro, é **trabalho de programação** (multi-usuário + migração pra nuvem).

---

## ⚠ A mudança de responsabilidade (ler antes de começar)

Isso deixa de ser um app pessoal e passa a guardar **dinheiro dos outros**. Consequências:
- Bug de isolamento (`usuario_id`) = um amigo vê o saldo do outro → vazamento sério.
- LGPD passa a valer (em escala de amigos o risco é baixo, mas existe).
- Você vira responsável por backup, uptime e segurança.
- As dívidas técnicas atuais (CHAVE_SECRETA de exemplo, sem HTTPS, sem limite de tentativas de senha) **têm que ser resolvidas ANTES de expor**.

---

## O caminho crítico (ordem certa de fazer)

A ordem importa: a base é o multi-usuário, feito e testado **localmente**, sem depender de nuvem. Só depois vem hospedagem.

### Etapa 0 — Demo rápida (opcional, pra validar a ideia HOJE)
- **O que:** Ngrok — cria um link público temporário apontando pro seu PC.
- **Grátis?** Sim (com limites: URL muda a cada vez, sessão limitada).
- **Quem faz:** você instala o Ngrok e roda; eu te passo o passo a passo.
- **Aviso:** hoje o app é single-user → **todos entram na MESMA conta**. Serve só pra mostrar o VISUAL/ideia e coletar feedback, NÃO pra amigos usarem com dinheiro real.
- **Objetivo:** decidir se vale a empreitada grande (Etapas 1+) antes de investir o trabalho.

### Etapa 1 — Multi-usuário (A FUNDAÇÃO) 🧱
- **O que:** cada pessoa com seus próprios dados, isolados.
  - Nova tabela `usuarios` (id, nome/e-mail, senha_hash).
  - Login passa a identificar QUAL usuário; o JWT carrega o `usuario_id`.
  - `usuario_id` em TODAS as tabelas (lançamentos, caixinhas, contas, bancos, recorrentes, fatura_itens).
  - TODAS as ~30 rotas passam a filtrar/inserir com `WHERE usuario_id = ?`.
  - SEM botão público de "criar conta" — usuários criados manualmente por você (convite).
- **Grátis?** Sim (é só código).
- **Quem faz:** EU programo e testo aqui localmente. É a maior e mais delicada mudança — um erro aqui vaza dado. Feita com testes exaustivos.
- **Onde roda:** ainda no seu PC (localhost), sem nuvem. Dá pra validar 100% antes de subir.
- **⚠ Migração + backup** do `financeiro.db` antes.

### Etapa 2 — Segurança mínima pra expor 🔒
- **O que:** tirar a `CHAVE_SECRETA` do código (virar variável de ambiente) + limitar tentativas de senha (rate limiting) no login.
- **Grátis?** Sim (código).
- **Quem faz:** EU programo e testo aqui.
- Pré-requisito pra colocar na internet sem vergonha.

### Etapa 3 — Trocar SQLite por Postgres (Supabase) 🗄️
- **O que:** a nuvem não guarda bem um arquivo SQLite local (some/pausa). Banco gerenciado (Supabase Postgres) resolve.
  - Reescrever todo o acesso ao banco: driver novo, placeholders `?` → `%s`/`$1`, pequenas diferenças de SQL.
  - Isolamento continua no SEU código (`WHERE usuario_id`), não no RLS automático (seu login é próprio, não o Supabase Auth).
- **Grátis?** Sim (Supabase free — pausa após ~1 semana sem uso; ~500MB; confira limites atuais).
- **Quem faz:** EU adapto o código e testo. VOCÊ cria a conta no Supabase (não faço login/conta por você) — eu te guio clicando.

### Etapa 4 — Hospedar na nuvem 24h ☁️
- **O que:** subir o back-end pra rodar sozinho, com HTTPS.
- **Opções (ambas grátis pro seu volume):**
  - **Render** — mais fácil (conecta o GitHub e pronto), mas free **hiberna** (~30-60s no 1º acesso).
  - **Google Cloud Run** — free mais generoso e cold start mais rápido, mas exige "empacotar" o app (Dockerfile) — mais setup.
  - Recomendação: começar pelo **Render** (simplicidade); migrar pro Cloud Run depois se quiser.
- **Manter monolítico:** o próprio FastAPI serve o `index.html` (como já faz). NÃO separar o front no Firebase (evita CORS e dois deploys).
- **Grátis?** Sim (com hibernação). HTTPS incluso de graça.
- **Quem faz:** VOCÊ cria a conta (Render/Google) e o repositório no GitHub; EU preparo o código (requirements, config/Dockerfile, ajustes de deploy). Guio o passo a passo.

### Etapa 5 — Polimento e blindagem (opcional, depois) ✨
- **PWA** (cara de app + "adicionar à tela inicial"): grátis, só arquivos. ⚠ o Service Worker faz cache — cuidado pra não reintroduzir o problema de versão travada; precisa de estratégia de atualização.
- **Domínio próprio** (`appfinanceiro.com.br`): ~R$ 40/ano — ÚNICO custo, e opcional.
- **Cloudflare** (esconde IP, força HTTPS, barra robôs): plano básico grátis; só faz sentido com domínio. Nível "empresa" — exagero pro começo.

### Etapa 6 — Extra futuro: busca com IA (Gemini) 🤖
- **O que:** usuário digita "busque as caixinhas do Itaú" → a IA (Function Calling) devolve a INTENÇÃO estruturada `{acao, banco}` → o SEU FastAPI executa a query com `usuario_id`. A IA NUNCA escreve SQL nem recebe o `usuario_id`.
- **Grátis?** Gemini tem free tier (com limites).
- **Cuidados:** (1) tratar a saída da IA como entrada NÃO-confiável (lista branca de ações; `usuario_id` sempre do servidor); (2) **PRIVACIDADE** — manda descrição financeira dos amigos pra um terceiro; no free tier os termos podem usar os dados pra treinar → conferir antes; (3) latência/custo/falha — app tem que funcionar SEM a IA (já tem filtros/busca da F3).
- **Prioridade:** cereja do bolo. Só faz sentido depois da fundação. Padrão é o mesmo em Claude/OpenAI/Gemini — não fica preso a um.

---

## Tabela: grátis x pago

| Item | Custo |
|------|-------|
| App multi-usuário rodando pros amigos (com arestas) | **R$ 0** |
| HTTPS / GitHub / PWA / Gemini free | R$ 0 |
| Domínio bonito (opcional) | ~R$ 40/ano |
| Sem hibernar / mais capacidade (só se crescer) | pago |

---

## Quem faz o quê

- **EU (Claude, testando aqui):** multi-usuário, segurança (segredos/rate-limit), adaptação pra Postgres, preparo de deploy (Dockerfile/config), PWA, e a integração da IA. Programo e testo antes de te entregar.
- **VOCÊ (envolve conta/pagamento, que eu não faço por você):** criar contas no Supabase / Render (ou Google) / Cloudflare, comprar domínio, ligar o GitHub. Eu te guio clicando, passo a passo.

---

## Recomendação de sequência

1. **Etapa 0 (Ngrok)** pra mostrar a ideia e sentir o interesse dos amigos — barato, hoje.
2. Se valer a pena → **Etapa 1 (multi-usuário)**, a fundação, feita e testada local.
3. Depois 2 → 3 → 4 em blocos, um por vez, testando cada um (método do diário).
4. 5 e 6 por último, se quiser.

> Regra de ouro (mesma do diário): um bloco por vez, testar, backup antes de mudança de estrutura. Nada de fazer tudo de uma vez.
