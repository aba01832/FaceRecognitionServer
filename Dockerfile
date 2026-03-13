FROM python:3.9-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libboost-all-dev \
    libx11-dev \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# EXPOSE no necesita variable, solo el puerto interno
EXPOSE 5000

# CORREGIDO: Usar exec form para que $PORT se expanda correctamente
CMD ["sh", "-c", "gunicorn server:app --bind 0.0.0.0:${PORT:-5000}"]
