# Imagem do Sistema Financeiro para o Render, COM o Tesseract (OCR) instalado.
# O runtime Python nativo do Render não deixa instalar programas de sistema (apt);
# por isso o deploy usa este Dockerfile, que instala o Tesseract + o idioma português.
# Sem isso, o leitor de comprovante/conta por foto fica indisponível (/ocr-status = false).
FROM python:3.12-slim

# Tesseract (motor de OCR) + pacote de idioma português (por.traineddata).
# O apt coloca os idiomas na pasta tessdata padrão, que o Tesseract acha sozinho —
# não precisa de TESSDATA_DIR. O inglês (eng) já vem no pacote base tesseract-ocr.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-por \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# instala as dependências Python primeiro (aproveita o cache de camada do Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copia o restante do app (main.py, index.html, app.js, styles.css, ...)
COPY . .

# O Render injeta a porta em $PORT; caímos em 8000 se rodar localmente sem ela.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
