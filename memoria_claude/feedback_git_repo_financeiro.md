---
name: feedback-git-repo-financeiro
description: "No projeto Sistema Financeiro, após cada mudança, documentar no Obsidian E dar push no repositório GitHub"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3581d5b0-d7e4-4e99-9caf-f6e664836da4
  modified: 2026-08-06T18:41:45.295Z
---

No projeto [[project-sistema-financeiro]], o fluxo de trabalho para TODA mudança é (pedido explícito do Renan, 06/08/2026):
1. Fazer a mudança (e testar nesta máquina, como sempre).
2. **Documentar no Obsidian** (diário `diario_projeto_financeiro.md`, backlog, ou o doc pertinente no vault `C:\Claude\Claude\Pessoal\Sistema Financeiro\`), seguindo [[feedback-obsidian-documentation]].
3. **Subir no repositório GitHub**: `git add` → `git commit -m "<mensagem clara>"` → `git push`.

**Repositório:** `https://github.com/Renanzin15/Sistema-Financeiro` (PRIVADO). O repo git local vive em `C:\Claude\Claude\Pessoal\Sistema Financeiro\` (branch `main`, remote `origin`). O login do Renan já está guardado nesta máquina (push funciona direto, sem pedir credencial).

**⚠ Nunca commitar `financeiro.db`** (dados reais + hash da senha) — o `.gitignore` já bloqueia `*.db`. A `CHAVE_SECRETA` no `main.py` está no repo (ok por ser privado); tirar dela pra variável de ambiente quando for pra fase online/pública (ver `plano_online_gratuito.md`).

**Por quê:** o Renan quer que código e documentação fiquem versionados e sincronizados no GitHub automaticamente, sem precisar pedir toda vez.

**Como aplicar:** proativamente, ao terminar cada mudança testada — documenta no vault e faz commit+push com mensagem descritiva. Se o push for recusado por divergência (ele editou de outra máquina/pelo site), fazer `git pull --rebase` antes. Atenção: se o Renan também versionar de `D:\PROGRAMAÇÃO\Financeiro`, alinhar as duas origens pra não conflitar.
