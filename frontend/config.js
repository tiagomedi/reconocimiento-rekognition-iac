// Configuración de la aplicación
// Este archivo se genera automáticamente durante el despliegue

window.APP_CONFIG = {
  // URL de la API Gateway
  API_URL: "https://p3f3owqw0g.execute-api.us-east-1.amazonaws.com/upload",
  
  // URL base del bucket S3
  S3_BASE_URL: "https://reconocimiento-ia-bucket-cb73a16a.s3.us-east-1.amazonaws.com/",
  
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
