#!/bin/bash

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuración
LAMBDA_DEV_MODE=false
LAMBDA_CLEAN_MODE=false
LAMBDA_TEST_MODE=false
LAMBDA_LOGS_MODE=false

# Función para imprimir mensajes con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Funciones para manejo de Lambda
clean_lambda_zips() {
    print_status "Limpiando archivos ZIP de Lambda..."
    cd infraestructura
    rm -f build/lambda_upload.zip build/lambda_process.zip build/lambda_video_result.zip
    rm -f lambda_upload.zip lambda_process.zip lambda_video_result.zip  # Limpiar archivos antiguos
    cd ..
    print_success "Archivos ZIP de Lambda eliminados"
}

package_lambda_functions() {
    print_status "Empaquetando funciones Lambda..."
    cd infraestructura
    
    # Asegurar que existe la carpeta build
    mkdir -p build
    
    # Crear ZIP para lambda_upload
    if [ -f "lambda/index_upload.py" ]; then
        zip build/lambda_upload.zip lambda/index_upload.py > /dev/null 2>&1
        print_success "lambda_upload.zip creado"
    fi
    
    # Crear ZIP para lambda_process
    if [ -f "lambda/index_process.py" ]; then
        zip build/lambda_process.zip lambda/index_process.py > /dev/null 2>&1
        print_success "lambda_process.zip creado"
    fi
    
    # Crear ZIP para lambda_video_result
    if [ -f "lambda/index_video_result.py" ]; then
        zip build/lambda_video_result.zip lambda/index_video_result.py > /dev/null 2>&1
        print_success "lambda_video_result.zip creado"
    fi
    
    cd ..
}

test_lambda_functions() {
    print_status "Ejecutando tests de Lambda functions..."
    
    # Test lambda_upload
    if [ -f "infraestructura/lambda/index_upload.py" ]; then
        print_status "Testing lambda_upload..."
        python3 -m py_compile infraestructura/lambda/index_upload.py
        print_success "lambda_upload: OK"
    fi
    
    # Test lambda_process
    if [ -f "infraestructura/lambda/index_process.py" ]; then
        print_status "Testing lambda_process..."
        python3 -m py_compile infraestructura/lambda/index_process.py
        print_success "lambda_process: OK"
    fi
    
    # Test lambda_video_result
    if [ -f "infraestructura/lambda/index_video_result.py" ]; then
        print_status "Testing lambda_video_result..."
        python3 -m py_compile infraestructura/lambda/index_video_result.py
        print_success "lambda_video_result: OK"
    fi
}

show_lambda_logs() {
    print_status "Mostrando logs de Lambda functions..."
    
    print_status "Logs de lambda-upload:"
    aws logs tail /aws/lambda/lambda-upload --follow --since 1h || print_warning "No hay logs recientes para lambda-upload"
    
    print_status "Logs de lambda-process:"
    aws logs tail /aws/lambda/lambda-process --follow --since 1h || print_warning "No hay logs recientes para lambda-process"
    
    print_status "Logs de lambda-video-result:"
    aws logs tail /aws/lambda/lambda-video-result --follow --since 1h || print_warning "No hay logs recientes para lambda-video-result"
}

deploy_lambda_only() {
    print_status "Modo desarrollo: Desplegando solo Lambda functions..."
    
    # Limpiar y empaquetar
    clean_lambda_zips
    package_lambda_functions
    
    cd infraestructura
    
    # Aplicar solo las Lambda functions
    terraform apply -target=aws_lambda_function.lambda_upload \
                   -target=aws_lambda_function.lambda_process \
                   -target=aws_lambda_function.lambda_video_result \
                   -auto-approve
    
    cd ..
    print_success "Lambda functions desplegadas"
}

show_help() {
    echo -e "${BLUE}Script de despliegue para Reconocimiento con IA${NC}"
    echo ""
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --lambda-dev     - Modo desarrollo: despliega solo Lambda functions"
    echo "  --lambda-clean   - Limpia archivos ZIP de Lambda"
    echo "  --lambda-test    - Ejecuta tests de Lambda functions"
    echo "  --lambda-logs    - Muestra logs de Lambda functions"
    echo "  --help           - Muestra esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0                    # Despliegue completo"
    echo "  $0 --lambda-dev       # Solo Lambda functions"
    echo "  $0 --lambda-test      # Solo tests"
    echo "  $0 --lambda-logs      # Solo logs"
}

# Procesar argumentos de línea de comandos
while [[ $# -gt 0 ]]; do
    case $1 in
        --lambda-dev)
            LAMBDA_DEV_MODE=true
            shift
            ;;
        --lambda-clean)
            LAMBDA_CLEAN_MODE=true
            shift
            ;;
        --lambda-test)
            LAMBDA_TEST_MODE=true
            shift
            ;;
        --lambda-logs)
            LAMBDA_LOGS_MODE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Ejecutar comandos específicos de Lambda
if [ "$LAMBDA_CLEAN_MODE" = true ]; then
    clean_lambda_zips
    exit 0
fi

if [ "$LAMBDA_TEST_MODE" = true ]; then
    test_lambda_functions
    exit 0
fi

if [ "$LAMBDA_LOGS_MODE" = true ]; then
    show_lambda_logs
    exit 0
fi

if [ "$LAMBDA_DEV_MODE" = true ]; then
    deploy_lambda_only
    exit 0
fi

# Verificar prerrequisitos
print_status "Verificando prerrequisitos..."

if ! command -v terraform &> /dev/null; then
    print_error "Terraform no está instalado. Por favor instálalo primero."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI no está instalado. Por favor instálalo primero."
    exit 1
fi

if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI no está configurado. Ejecuta 'aws configure' primero."
    exit 1
fi

print_success "Prerrequisitos verificados"

# Usando servidor local - no se necesita GitHub
print_success "Configuración para servidor local"

print_status "Iniciando despliegue con Terraform..."

# Crear archivo de variables de Terraform
cat > infraestructura/terraform.tfvars << EOF
aws_region = "us-east-1"
EOF

# Empaquetar funciones Lambda
package_lambda_functions

cd infraestructura

print_status "Inicializando Terraform..."
terraform init

print_status "Aplicando configuración de Terraform..."
terraform apply -auto-approve

print_success "Infraestructura desplegada correctamente"

print_status "Obteniendo outputs de Terraform..."
API_URL=$(terraform output -raw api_upload_endpoint)
S3_URL=$(terraform output -raw s3_url)

print_success "Infraestructura AWS desplegada correctamente"
print_success "API URL: $API_URL"
print_success "S3 URL: $S3_URL"

# Volver al directorio raíz
cd ..

# Cambiar al directorio del frontend
cd frontend

print_status "Actualizando configuración de la aplicación..."

# Actualizar config.js con las URLs reales
cat > config.js << EOF
// Configuración de la aplicación
// Este archivo se genera automáticamente durante el despliegue

window.APP_CONFIG = {
  // URL de la API Gateway
  API_URL: "$API_URL",
  
  // URL base del bucket S3
  S3_BASE_URL: "$S3_URL/",
  
  // Configuración de la aplicación
  APP_NAME: "Reconocimiento con IA",
  VERSION: "1.0.0",
  
  // Configuración de Rekognition
  REKOGNITION_REGION: "us-east-1",
  
  // Timeouts y configuraciones
  MAX_WAIT_ATTEMPTS: 150,
  WAIT_INTERVAL: 2000, // milisegundos
  
  // Formatos de archivo soportados
  SUPPORTED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "gif", "bmp", "webp"],
  SUPPORTED_VIDEO_FORMATS: ["mp4"],
  
  // Configuración de UI
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SHOW_DEBUG_INFO: true // Habilitado para debugging
};

// Aplicar la configuración globalmente
if (window.APP_CONFIG) {
  window.API_URL = window.APP_CONFIG.API_URL;
  window.S3_BASE_URL = window.APP_CONFIG.S3_BASE_URL;
  
  if (window.APP_CONFIG.SHOW_DEBUG_INFO) {
    console.log("Configuración de la aplicación cargada:", window.APP_CONFIG);
  }
}
EOF

print_success "Configuración actualizada"

# Mostrar resumen
echo ""
print_success "=== DESPLIEGUE COMPLETADO ==="
print_success "API URL: $API_URL"
print_success "S3 URL: $S3_URL"

echo ""
print_status "Iniciando servidor local..."

# Función para encontrar un puerto libre
find_free_port() {
    local port=8000
    while lsof -i :$port >/dev/null 2>&1; do
        port=$((port + 1))
        if [ $port -gt 8100 ]; then
            print_error "No se encontró un puerto libre entre 8000-8100"
            exit 1
        fi
    done
    echo $port
}

# Verificar si el puerto 8000 está en uso y liberarlo
if lsof -i :8000 >/dev/null 2>&1; then
    print_warning "Puerto 8000 en uso, liberando..."
    lsof -ti :8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Encontrar puerto libre
PORT=$(find_free_port)

# Verificar si Python está disponible
if command -v python3 &> /dev/null; then
    print_success "Servidor iniciado en http://localhost:$PORT"
    print_status "Presiona Ctrl+C para detener el servidor"
    echo ""
    print_success "=== APLICACIÓN LISTA ==="
    print_success "URL: http://localhost:$PORT"
    print_success "API: $API_URL"
    print_success "S3: $S3_URL"
    echo ""
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    print_success "Servidor iniciado en http://localhost:$PORT"
    print_status "Presiona Ctrl+C para detener el servidor"
    echo ""
    print_success "=== APLICACIÓN LISTA ==="
    print_success "URL: http://localhost:$PORT"
    print_success "API: $API_URL"
    print_success "S3: $S3_URL"
    echo ""
    python -m http.server $PORT
elif command -v node &> /dev/null; then
    print_success "Servidor iniciado en http://localhost:$PORT"
    print_status "Presiona Ctrl+C para detener el servidor"
    echo ""
    print_success "=== APLICACIÓN LISTA ==="
    print_success "URL: http://localhost:$PORT"
    print_success "API: $API_URL"
    print_success "S3: $S3_URL"
    echo ""
    npx http-server -p $PORT
else
    print_error "No se encontró Python ni Node.js instalado"
    print_error "Instala Python 3 o Node.js para ejecutar el servidor local"
    print_status "Puedes ejecutar manualmente:"
    print_status "cd frontend && python3 -m http.server $PORT"
    exit 1
fi