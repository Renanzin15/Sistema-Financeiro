# Estudo — OCR local para ler conta (imagem/foto) e virar dívida

> Objetivo: o Renan tirar foto (ou print) de uma conta de luz/boleto e o app extrair **valor** e
> **vencimento** automaticamente, virando uma conta na tela de Dívidas — **sem IA/nuvem**, tudo
> offline e de graça. Decisão do Renan (06/08/2026): estudar o **OCR local**; IA de visão por ora não.
> Relacionado: [[backlog_ideias]] (E3), [[plano_online_gratuito]].

---

## ✅ Prova de conceito FEITA nesta máquina (06/08/2026)

Instalei e testei de verdade o pipeline completo:
- **Tesseract 5.4.0** (motor OCR) via `winget UB-Mannheim.TesseractOCR` → em `C:\Program Files\Tesseract-OCR\`.
- **pytesseract** + **Pillow** via pip (essas duas são as libs Python).
- Gerei uma "conta de luz" de exemplo (`conta_luz_exemplo.png`) e rodei o OCR.

**Resultado:** o OCR leu o texto inteiro e a extração por regex acertou em cheio:
- Vencimento detectado: **20/08/2026** (esperado 20/08/2026) ✓
- Valor detectado: **187,45** (esperado 187,45) ✓

Ou seja: **é viável e funciona.** Mas tem um asterisco importante (ver "Realidade" abaixo).

---

## Como funciona (o pipeline)

1. **Upload da imagem** (o usuário arrasta a foto/print na tela).
2. **Pré-processamento** (Pillow): cinza, aumentar contraste, endireitar — melhora muito a leitura.
3. **OCR** (Tesseract via pytesseract): imagem → texto bruto.
4. **Extração** (regex no back-end): acha a **data de vencimento** e o **valor a pagar** no texto.
5. **Prévia** pro usuário conferir/corrigir → confirma → **cria a conta** na tela de Dívidas.

Igual ao importador de extrato: **nada é salvo sozinho, o usuário sempre revisa.**

---

## A "Realidade" — o asterisco honesto

O teste acima usou uma imagem **limpa** (texto nítido, fundo branco, reto). Foi ~100%.
**Foto real** de conta é bem mais difícil:
- Papel **amassado/torto**, **sombra**, flash, foto de **ângulo**, dedo na frente.
- Contas têm **layout poluído** (logos, tabelas, linha digitável) → o OCR mistura tudo.
- Cada distribuidora (Enel, CPFL, Light...) tem um **layout diferente** → o "valor a pagar" aparece
  com nomes e posições diferentes.

**Consequência:** com foto real, a taxa de acerto cai. Por isso a regra é **sempre mostrar o que
leu e deixar o Renan corrigir** antes de salvar — nunca confiar cego. Dicas que aumentam muito o
acerto: escanear (não fotografar), ou usar o **PDF da conta** (se for PDF "de texto", nem precisa de
OCR — dá pra ler direto; só precisa de OCR se o PDF for uma imagem escaneada).

**Truque importante:** quase toda conta/boleto tem a **linha digitável** (aqueles números). O
**valor** e o **vencimento** às vezes estão codificados nela num formato padrão — dá pra extrair
dali como uma segunda fonte, mais confiável que "ler o texto solto". Vale explorar na implementação.

---

## O que o Renan precisaria instalar (na máquina dele)

Diferente do OFX/CSV (que não precisou de nada), o OCR tem **3 peças**:
1. **Tesseract** (o motor) — um instalador `.exe` (UB-Mannheim). Via winget:
   `winget install -e --id UB-Mannheim.TesseractOCR`
   (ou baixar o instalador do GitHub UB-Mannheim). Uns ~100 MB.
2. **Idioma português** (`por.traineddata`) — opcional, mas ajuda nos rótulos acentuados
   ("Data de vencimento", "Valor a pagar"). Os **números e datas** já saem bem só com inglês.
   (colocar o arquivo em `C:\Program Files\Tesseract-OCR\tessdata\`).
3. **Libs Python:** `pip install pytesseract Pillow`.

No código, apontar o caminho: `pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"`.

> ⚠ Isso vira **dependência do sistema**: se um dia o app for pra nuvem, o servidor também precisa
> ter o Tesseract instalado (no Render/Docker dá, mas é um passo a mais).

---

## Plano de implementação (quando o Renan mandar)

**Back-end (`main.py`):**
- Função `ocr_conta(bytes_imagem)`: Pillow abre → pré-processa → pytesseract lê → devolve texto.
- Função `extrair_conta(texto)`: regex acha `vencimento` (data dd/mm/aaaa perto da palavra) e
  `valor` (maior "R$ x,xx", de preferência perto de "valor a pagar"/"total"); tenta adivinhar um
  nome (ex.: "Energia"/"Luz"). Devolve `{nome, valor_centavos, vencimento, texto_bruto}`.
- Rota `POST /importar/conta-imagem`: recebe a imagem (base64 no JSON, como já fazemos com texto, ou
  multipart), roda OCR+extração, **devolve a prévia** (não grava).
- Reaproveitar `POST /contas` pra criar a conta quando o usuário confirmar.

**Front (`index.html`):**
- Na tela **Importar**, um segundo bloco "Ler conta por foto" com `<input accept="image/*">` +
  arrastar. Lê o arquivo como DataURL, manda pro back, mostra a prévia (nome/valor/vencimento) em
  campos **editáveis**, botão "Cadastrar como conta".

**Escopo faseado (sugestão):**
1. **Fase 1 (MVP):** OCR + extrair valor e vencimento, prévia editável, criar conta. (imagem nítida)
2. **Fase 2:** pré-processamento robusto (deskew/threshold) + tentar a **linha digitável** como
   fonte do valor/vencimento. (foto real)
3. **Fase 3 (opcional):** PDF — se for PDF de texto, lê direto (sem OCR); se for escaneado, OCR.

---

## Decisões pro Renan

1. **Vale instalar o Tesseract** na máquina dele (é um programa, ~100 MB)? Se sim, sigo pra Fase 1.
2. **Português** (`por`) ou só inglês? (número/data vai bem só com inglês; texto acentuado melhora com `por`.)
3. Começar por **imagem** ou já mirar **PDF** também?
4. A foto vira **conta** (tela Dívidas), certo? (não é lançamento do histórico) — confirmar.

> Nota: a POC provou que a canalização funciona. O trabalho real da Fase 2 é lidar com **foto ruim** —
> é ali que mora a dificuldade, não no OCR em si.
