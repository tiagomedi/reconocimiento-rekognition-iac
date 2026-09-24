# Reconocimiento con IA - AWS Rekognition

Sistema de reconocimiento de imágenes y videos utilizando AWS Rekognition con una interfaz web moderna y responsiva.

## Características

- **Análisis de Imágenes**: Detección de objetos, personas y etiquetas
- **Análisis de Videos**: Procesamiento asíncrono con detección temporal
- **Interfaz Moderna**: Diseño glassmorphism con animaciones suaves
- **Responsive**: Optimizado para dispositivos móviles y desktop
- **Tiempo Real**: Resultados instantáneos para imágenes, procesamiento asíncrono para videos

## Arquitectura

- **Frontend**: HTML5, CSS3, JavaScript (servidor local)
- **Backend**: AWS Lambda (Python 3.12)
- **API**: AWS API Gateway
- **Almacenamiento**: Amazon S3
- **Notificaciones**: Amazon SNS
- **IA**: Amazon Rekognition
- **Infraestructura**: Terraform

## Requisitos

- [Terraform](https://terraform.io)
- [AWS CLI](https://aws.amazon.com/cli/)
- [Python 3](https://python.org) o [Node.js](https://nodejs.org) (para servidor local)

## Despliegue

### Despliegue Completo

```bash
# Desplegar infraestructura y iniciar servidor local
./deploy.sh
```

Este comando:
- Despliega toda la infraestructura AWS (S3, Lambda, API Gateway, SNS)
- Configura automáticamente las URLs en el frontend
- Inicia el servidor local en http://localhost:8000

### Solo Infraestructura

```bash
# Desplegar solo la infraestructura AWS
cd infraestructura
terraform init
terraform apply -auto-approve
```

### Solo Frontend Local

```bash
# Si ya tienes la infraestructura desplegada
cd frontend && python3 -m http.server 8000
```

## Uso

1. **Acceder a la aplicación**: http://localhost:8000
2. **Subir archivo**: Arrastra y suelta o haz clic para seleccionar
3. **Ver resultados**: Los resultados aparecen automáticamente
4. **Videos**: El procesamiento es asíncrono, recibirás notificación cuando termine

## Formatos Soportados

### Imágenes
- JPG, JPEG, PNG, GIF, BMP, WEBP

### Videos
- MP4

## Configuración

El archivo `config.js` se genera automáticamente con las URLs correctas de tu infraestructura desplegada.

## Desarrollo

### Estructura del Proyecto

```
├── infraestructura/          # Terraform
│   ├── api_gateway/         # API Gateway
│   ├── iam/                 # Roles y políticas
│   ├── lambda_process/      # Lambda de procesamiento
│   ├── lambda_upload/       # Lambda de subida
│   ├── s3/                  # Bucket S3
│   └── sns/                 # Notificaciones
├── frontend/                # Aplicación web
│   ├── index.html          # Página principal
│   ├── style.css           # Estilos
│   ├── app.js              # Lógica JavaScript
│   └── config.js           # Configuración (generado)
└── deploy.sh               # Script de despliegue
```

### Modificar el Frontend

1. Edita los archivos en `frontend/`
2. Ejecuta `./deploy.sh` para aplicar cambios
3. El servidor se reiniciará automáticamente

## Limpieza

Para eliminar toda la infraestructura:

```bash
cd infraestructura
terraform destroy -auto-approve
```

## Troubleshooting

### Puerto en uso

Si el puerto 8000 está ocupado:

**Linux/macOS:**
```bash
lsof -i :8000
kill <PID>
```

**Windows:**
```cmd
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Error de AWS CLI

```bash
aws configure
```

### Error de Terraform

```bash
cd infraestructura
terraform init
```

### Reiniciar Servidor Local

```bash
# Si el servidor se detiene, ejecuta:
cd frontend && python3 -m http.server 8000
```