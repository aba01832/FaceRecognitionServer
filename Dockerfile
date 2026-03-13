FROM python:3.9-slim

# Instalar dependencias del sistema para compilar dlib
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libboost-all-dev \
    libx11-dev \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requirements primero (para cachear capas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Puerto que usará Railway
EXPOSE 5000

# Comando para iniciar
CMD gunicorn server:app --bind 0.0.0.0:$PORT
