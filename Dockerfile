FROM python:3.9-slim

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

# Puerto fijo 8080 (Railway acepta cualquier puerto)
EXPOSE 8080

# Usar puerto fijo, no variable
CMD ["gunicorn", "server:app", "--bind", "0.0.0.0:8080"]
