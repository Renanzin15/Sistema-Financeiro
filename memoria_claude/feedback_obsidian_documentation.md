---
name: feedback-obsidian-documentation
description: User wants findings/checks (like API access tests) documented as markdown notes in their Obsidian vault
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b78bf72d-4a21-4326-a541-93f7f8441dd2
---

Whenever meaningful findings come out of a task in this project (e.g. verifying API/credential access, testing an integration, checking a service), write them up as a markdown note in the user's Obsidian vault, not just report them in chat.

**Vault root (IMPORTANT — corrected by user 2026-07-15):** `C:\Claude\Claude` (normal Obsidian layout — `.obsidian` is just the config folder). **Write notes to `C:\Claude\Claude\Alphos Tecnologia\...`, NEVER inside `C:\Claude\Claude\.obsidian\`.** The user explicitly said do not create notes in the `.obsidian` folder. (Earlier in the session content ended up inside `.obsidian` by mistake; the user moved/corrected it and told me to use `C:\Claude\Claude\Alphos Tecnologia`.)

**Folder convention (confirmed 2026-07-15 from user's existing Obsidian structure):**
```
C:\Claude\Claude\                 <- vault root
  .obsidian/                      <- CONFIG ONLY — do not put notes here
  Alphos Tecnologia/
    Financeiro e Operação/
    Infra VPS/
      Sistemas/
        <sistema>/      e.g. Backrest, BookStack, ChatOps, Docker, ERPNext, Evolution API,
                         Gophish, Grafana, Linux SSH e Geral, n8n, NetBox, NocoDB, Obsidian LiveSync...
          _Visão geral.md        <- overview note per system
          <Nota específica>.md   <- e.g. "Integração Trello com Zammad via ..."
```
Notes about a specific system/tool go in `C:\Claude\Claude\Alphos Tecnologia\Infra VPS\Sistemas\<sistema>\`. Use `_Visão geral.md` for a system's overview note (leading underscore keeps it sorted first), and separate files for specific integrations/findings (e.g. an API-access test, a specific integration).

Note: the user has Obsidian LiveSync, which may move/delete files between sessions — verify current on-disk state before assuming a note still exists where it was left.

**Why:** User explicitly asked to always document this kind of work in Obsidian so it persists as searchable knowledge, rather than living only in chat history, and to follow their existing organizational structure rather than inventing a new one.

**How to apply:**
- Place new notes under the matching `Sistemas/<sistema>/` folder above; create the system subfolder if it doesn't exist yet.
- Include: what was tested, the concrete request/response evidence, and next steps if relevant.
- If the note includes secrets/tokens, mark them clearly as sensitive within the note (e.g. a "⚠️ Sensível" callout) since this vault is plain markdown on disk.
- Do this proactively after finishing a verification/test task in this project — don't wait to be asked each time.
