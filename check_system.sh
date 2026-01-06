#!/bin/bash

# Verificar versión de Ubuntu
echo "Verificando sistema..."
cat /etc/os-release
echo ""
echo "Versión de Node.js actual:"
node -v 2>/dev/null || echo "Node.js no instalado"
echo ""
echo "Versión de PostgreSQL actual:"
psql --version 2>/dev/null || echo "PostgreSQL no instalado"
