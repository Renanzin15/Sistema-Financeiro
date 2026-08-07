---
name: project-sistema-financeiro
description: "App de finanças pessoais do Renan (FastAPI+SQLite+HTML) — local no vault, ambiente de teste e fluxo de trabalho"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3581d5b0-d7e4-4e99-9caf-f6e664836da4
  modified: 2026-08-07T13:14:48.939Z
---

App de controle financeiro pessoal (orçamento base zero + caixinhas). Stack: Python + FastAPI + SQLite (`financeiro.db`) + `index.html` único (tema escuro, Chart.js via CDN). Login por senha única (bcrypt + JWT via python-jose).

**Onde está:** os arquivos de referência ficam no vault em `C:\Claude\Claude\Pessoal\Sistema Financeiro\` (main.py, index.html, diario_projeto_financeiro.md, documentacao_tecnica.md, guia_projeto_financeiro.md, codigo_comentado.md). O **projeto real roda em outra máquina** (`D:\PROGRAMAÇÃO\Financeiro`), não nesta.

**Fluxo de trabalho combinado:** eu escrevo/testo o código nesta máquina; o Renan copia e aplica manualmente no VS Code da outra máquina. Entregar código pronto pra colar, com um "como testar", e aviso de backup do `financeiro.db` antes de mudanças de estrutura (⚠). Seguir o método do diário: um bloco por vez.

**Ambiente de teste montado nesta máquina (2026-07-16):** Python 3.12.10 em `C:\Users\Renan Santana\AppData\Local\Programs\Python\Python312\python.exe` (NÃO está no PATH — usar o caminho completo). Bibliotecas instaladas: fastapi, uvicorn, bcrypt 5.0.0, python-jose[cryptography], pydantic 2. Para testar: copiar main.py+index.html para pasta isolada, subir com `python -m uvicorn main:app --port 8199`, exercitar rotas via urllib e abrir o front no navegador embutido. Teste E2E validado (login, 401, CRUD, saldo em centavos). Limpar `financeiro.db`/`__pycache__` de teste depois.

**Roteiro CONCLUÍDO (16/07/2026):** A, B, C (já vinham prontas) + F1 (coluna `data`), F2 (histórico visual), F3 (filtros+busca), F4 (tela Análise), D (fatura de cartão com itens, ⚠ migração), E (ícones SVG embutidos, offline). Tudo testado no navegador antes de entregar. Detalhes por etapa no diario_projeto_financeiro.md. Documentar achados sempre no vault [[feedback-obsidian-documentation]].

**Próxima etapa planejada (desenho confirmado 21/07/2026, NÃO construída):** "Mover conta para a fatura" — ação MANUAL que joga uma conta avulsa (ex.: assinatura Prime) dentro de uma fatura de cartão, somando. A conta some da lista de pendências na hora e reaparece SEM vínculo no mês seguinte (a recorrência normal cuida). Detalhe crítico: ao mover, marcar a conta como "movida" (NÃO apagar), senão `gerar_recorrentes_do_mes` (dedup por nome+vencimento) a recria no mesmo mês. Provável rota `POST /contas/{id}/mover-para-fatura`. ⚠ migração+backup. Construir depois do Renan testar um mês no manual. Detalhes completos no diario_projeto_financeiro.md.

**Etapa 17 CONCLUÍDA (04/08/2026):** escolher data do lançamento (campo opcional, vazio=hoje); histórico agrupado por MÊS com resumo (+entradas −saídas), dias dentro; metas nas caixinhas (coluna `meta_centavos` ⚠migração, rota `POST /caixinhas/{id}/meta`, barra de progresso). BÔNUS: `/app` agora manda `Cache-Control: no-store` — resolveu de vez o problema de cache do navegador. Tudo testado.

**Validações de entrada — PARCIALMENTE RESOLVIDO (06/08/2026, Etapa 20.1):** feito `data_valida()` + trava valor≤0 em criar_lancamento e criar_conta + valida vencimento em criar_conta/editar_conta (testado porta 8240). FALTA ainda: travar "gastar de caixinha" avulso sem saldo (deixado de fora pra não quebrar o importador, que insere pagamentos direto). Também atualizei docs: documentacao_tecnica (reescrita), guia (virou manual do usuário), codigo_comentado (reescrito). Tudo commitado e pushed no repo.

**Pendência original — validações de entrada (anotado 04/08/2026):** (1) saldo negativo — transferir e pagar_conta JÁ travam; FALTA travar "gastar de caixinha" avulso; (2) valor <=0 — só transferência e itens de fatura validam; FALTA em criar_lancamento e criar_conta; (3) datas malucas (ex.: ano 1990) — sem validação em vencimento nem na data do lançamento. Regra: validar no back-end. Detalhes no diário.

**Backlog de ideias (06/08/2026):** analisado o `Sistema de Orçamento.docx` do Renan → consolidado em `backlog_ideias.md` no vault. Itens: M1 apagar contas antigas, M2 ganhos investimento (CDI), M3 principais gastos (✅feito), M4 contador 7 dias; E1 termômetro/runway, E2 previsão de fatura + mover assinatura (=já desenhado), E3 leitor de extrato OFX/CSV/PDF, E4 gatilhos de salário, E5 streaks, E6 wrapped mensal dia 1º, E7 web push, E8 metas com prazo (IPVA), E9 atalhos de teclado. + repete online/segurança (já em plano_online_gratuito.md).

**Etapa 20 CONCLUÍDA (06/08/2026):** lote grande do `Sistema de Orçamento.docx`. Implementados e testados (servidor isolado + navegador): M1 arquivar contas (col `arquivada`, rotas arquivar/desarquivar/arquivadas/arquivar-antigas), M2 rendimento (tipo `rendimento` — entra na caixinha, não infla entrada nem mexe no saldo livre), M4 aviso 7 dias, E1 termômetro/runway, E2 assinatura na fatura (FK `conta_fatura_id` em recorrentes; vinculada vira item da fatura, dedup, limpa avulsa ao vincular), E3 leitor de extrato OFX/CSV (rotas /importar/analisar e /confirmar; PDF NÃO — precisa pdfplumber), E4 gatilhos de salário (tabela `regras_salario`, dispara em entrada), E5 streaks, E6 wrapped mensal (config `wrapped_visto_ate`, modal 1x/sessão + botão na Análise), E8 metas com prazo (col `meta_prazo`), E9 atalhos de teclado. main.py 847→1318 linhas, index.html 1396→1934. ⚠ backup do financeiro.db antes (migração idempotente testada). Novas telas no menu: Regras, Importar. **NÃO entregar arquivo a cada passo — combinado: fazer tudo e no fim subir 1 arquivo novo.** Base zerada testada (migrações do zero, todas rotas 200).

**OCR de conta por imagem — estudo + POC (06/08/2026):** Renan quer ler foto/print de conta de luz e extrair valor+vencimento SEM IA/nuvem (IA de visão descartada por ora). POC FEITA e funcionou: instalei nesta máquina de teste **Tesseract 5.4** (winget UB-Mannheim, em `C:\Program Files\Tesseract-OCR\`, só idiomas eng+osd) + **pytesseract + Pillow** (pip). OCR numa conta de luz sintética extraiu vencimento e valor 100%. Ressalva: imagem LIMPA = ~perfeito; FOTO REAL (torta/sombra/layout poluído) cai muito — precisa pré-processamento + sempre o usuário confere. Estudo completo em `estudo_ocr_conta_imagem.md` (stack, install, plano faseado). Decisões pendentes do Renan: instalar Tesseract na máquina dele? idioma por? imagem ou PDF? Foto vira CONTA (não lançamento). Truque a explorar: linha digitável do boleto como fonte confiável do valor/venc.

**Outras pendências futuras:** "Mover conta para a fatura" (ver acima); virada automática de mês na fatura; dívidas técnicas de segurança (CHAVE_SECRETA de exemplo, sem HTTPS/rate-limit) antes de expor; agrupar histórico por mês p/ gráfico de evolução no dashboard; ir online/multi-usuário (ver plano_online_gratuito.md).
