#!/bin/bash
# Script de entrada para Railway
# Usa el puerto que Railway asigna o 5000 por defecto

PORT="${PORT:-5000}"
echo "🚀 Iniciando servidor en puerto: $PORT"
gunicorn server:app --bind 0.0.0.0:$PORT
