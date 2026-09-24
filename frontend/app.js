// Configuración de la API - se puede sobrescribir con variables de entorno
const apiUrl = window.API_URL || "https://6jqg9zmmxh.execute-api.us-east-1.amazonaws.com/upload";
const s3BaseUrl = window.S3_BASE_URL || "https://reconocimiento-ia-bucket-917a6eff.s3.us-east-1.amazonaws.com/";

// Log de configuración para debugging
console.log("API URL configurada:", apiUrl);
console.log("S3 Base URL configurada:", s3BaseUrl);

// ===== VIDEO COMPRESSION =====
const MAX_VIDEO_SIZE = 2 * 1024 * 1024; // 2MB - Tamaño objetivo después de compresión
const MAX_VIDEO_DURATION = 300; // 5 minutos en segundos
const TARGET_VIDEO_SIZE = 1.5 * 1024 * 1024; // 1.5MB - Tamaño objetivo

function validateVideoFile(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const size = file.size;
      
      console.log(`Video info - Duración: ${duration}s, Tamaño: ${formatFileSize(size)}`);
      
      if (size > MAX_VIDEO_SIZE) {
        reject(new Error(`El video es demasiado grande (${formatFileSize(size)}). Se comprimirá automáticamente a menos de ${formatFileSize(TARGET_VIDEO_SIZE)}.`));
        return;
      }
      
      if (duration > MAX_VIDEO_DURATION) {
        reject(new Error(`El video es demasiado largo (${Math.round(duration)}s). Máximo permitido: ${MAX_VIDEO_DURATION}s. Se comprimirá automáticamente.`));
        return;
      }
      
      resolve({ duration, size });
    };
    
    video.onerror = () => {
      reject(new Error('No se pudo cargar el video para validación'));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

function compressVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      // Calcular dimensiones de compresión más agresivas
      const maxWidth = 640;  // Reducido de 1280 a 640
      const maxHeight = 360; // Reducido de 720 a 360
      let { videoWidth, videoHeight } = video;
      
      if (videoWidth > maxWidth || videoHeight > maxHeight) {
        const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
        videoWidth *= ratio;
        videoHeight *= ratio;
      }
      
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      // Configurar video para compresión
      video.currentTime = 0;
      video.play();
      
      const chunks = [];
      
      // Configuración de compresión más agresiva
      const compressionOptions = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 200000 // 200kbps - Muy bajo para reducir tamaño
      };
      
      // Si VP9 no está disponible, usar VP8
      if (!MediaRecorder.isTypeSupported(compressionOptions.mimeType)) {
        compressionOptions.mimeType = 'video/webm;codecs=vp8';
      }
      
      // Si WebM no está disponible, usar MP4
      if (!MediaRecorder.isTypeSupported(compressionOptions.mimeType)) {
        compressionOptions.mimeType = 'video/mp4;codecs=avc1.42E01E';
      }
      
      const mediaRecorder = new MediaRecorder(video.captureStream(), compressionOptions);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: compressionOptions.mimeType });
        console.log(`Video comprimido: ${formatFileSize(compressedBlob.size)} (original: ${formatFileSize(file.size)})`);
        
        // Si aún es muy grande, intentar comprimir más
        if (compressedBlob.size > TARGET_VIDEO_SIZE) {
          console.log('Video aún muy grande, aplicando compresión adicional...');
          // Crear un nuevo video con el blob comprimido y comprimir de nuevo
          const newVideo = document.createElement('video');
          newVideo.onloadedmetadata = () => {
            // Reducir aún más las dimensiones
            const newMaxWidth = 480;
            const newMaxHeight = 270;
            let newVideoWidth = newVideo.videoWidth;
            let newVideoHeight = newVideo.videoHeight;
            
            if (newVideoWidth > newMaxWidth || newVideoHeight > newMaxHeight) {
              const newRatio = Math.min(newMaxWidth / newVideoWidth, newMaxHeight / newVideoHeight);
              newVideoWidth *= newRatio;
              newVideoHeight *= newRatio;
            }
            
            canvas.width = newVideoWidth;
            canvas.height = newVideoHeight;
            
            const newChunks = [];
            const newMediaRecorder = new MediaRecorder(newVideo.captureStream(), {
              mimeType: compressionOptions.mimeType,
              videoBitsPerSecond: 100000 // 100kbps - Aún más bajo
            });
            
            newMediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                newChunks.push(event.data);
              }
            };
            
            newMediaRecorder.onstop = () => {
              const finalBlob = new Blob(newChunks, { type: compressionOptions.mimeType });
              console.log(`Video final comprimido: ${formatFileSize(finalBlob.size)} (original: ${formatFileSize(file.size)})`);
              resolve(finalBlob);
            };
            
            newMediaRecorder.start();
            setTimeout(() => {
              newMediaRecorder.stop();
              newVideo.pause();
              URL.revokeObjectURL(newVideo.src);
            }, newVideo.duration * 1000);
          };
          
          newVideo.src = URL.createObjectURL(compressedBlob);
          newVideo.currentTime = 0;
          newVideo.play();
        } else {
          resolve(compressedBlob);
        }
      };
      
      mediaRecorder.onerror = (error) => {
        reject(new Error('Error durante la compresión del video'));
      };
      
      // Iniciar grabación
      mediaRecorder.start();
      
      // Detener después de la duración del video
      setTimeout(() => {
        mediaRecorder.stop();
        video.pause();
        URL.revokeObjectURL(video.src);
      }, video.duration * 1000);
    };
    
    video.onerror = () => {
      reject(new Error('No se pudo cargar el video para compresión'));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

function showVideoWarning(message, showCompress = true) {
  const warningHtml = `
    <div class="alert alert-warning d-flex align-items-center" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-3"></i>
      <div class="flex-grow-1">
        <strong>Video Grande Detectado</strong><br>
        ${message}
        ${showCompress ? '<br><small>Se comprimirá automáticamente a menos de 1.5MB antes de subir.</small>' : ''}
      </div>
      ${showCompress ? '<button type="button" class="btn btn-warning btn-sm" id="compressVideoBtn">Comprimir y Continuar</button>' : ''}
    </div>
  `;
  
  const errorContainer = document.getElementById('errorMessage');
  errorContainer.innerHTML = warningHtml;
  errorContainer.style.display = 'block';
  errorContainer.classList.add('fade-in');
  
  if (showCompress) {
    document.getElementById('compressVideoBtn').addEventListener('click', () => {
      hideError();
      return true; // Continuar con el proceso
    });
  }
}

// ===== PDF GENERATION =====
let currentAnalysisData = null;

function generatePDF(isVideo = false) {
  console.log('Generando PDF para:', isVideo ? 'video' : 'imagen');
  console.log('Datos de análisis:', currentAnalysisData);
  
  if (!currentAnalysisData) {
    console.error('No hay datos de análisis disponibles');
    return;
  }

  if (!window.jspdf) {
    console.error('jsPDF no está disponible');
    alert('Error: La librería jsPDF no está cargada. Por favor, recarga la página.');
    return;
  }

  console.log('jsPDF disponible:', window.jspdf);
  const { jsPDF } = window.jspdf;
  console.log('jsPDF constructor:', jsPDF);
  const doc = new jsPDF();
  
  // Configuración de colores
  const primaryColor = '#0ea5e9';
  const secondaryColor = '#64748b';
  const accentColor = '#f1f5f9';
  
  // Logo y encabezado
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, 210, 30, 'F');
  
  // Título principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('STELLART VISION', 20, 20);
  
  // Subtítulo
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Análisis de Reconocimiento con IA', 20, 25);
  
  // Fecha y hora
  doc.setTextColor(secondaryColor);
  doc.setFontSize(10);
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generado el ${dateStr}`, 150, 25);
  
  // Información del archivo
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Información del Archivo', 20, 45);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tipo: ${isVideo ? 'Video' : 'Imagen'}`, 20, 55);
  doc.text(`Nombre: ${currentAnalysisData.fileName}`, 20, 60);
  doc.text(`Tamaño: ${formatFileSize(currentAnalysisData.fileSize)}`, 20, 65);
  doc.text(`Formato: ${currentAnalysisData.fileExtension.toUpperCase()}`, 20, 70);
  
  // Resultados del análisis
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resultados del Análisis', 20, 85);
  
  const labels = currentAnalysisData.labels;
  const totalLabels = labels.length;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de etiquetas detectadas: ${totalLabels}`, 20, 95);
  
  // Tabla de etiquetas
  let yPosition = 105;
  
  if (isVideo) {
    // Para videos - incluir timestamp y confianza
    doc.setFont('helvetica', 'bold');
    doc.text('Etiqueta', 20, yPosition);
    doc.text('Confianza', 80, yPosition);
    doc.text('Tiempo', 140, yPosition);
    
    // Línea separadora
    doc.setDrawColor(primaryColor);
    doc.line(20, yPosition + 2, 190, yPosition + 2);
    
    yPosition += 10;
    
    labels.forEach((label, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.text(label.Label.Name, 20, yPosition);
      doc.text(`${label.Label.Confidence.toFixed(1)}%`, 80, yPosition);
      doc.text(`${label.Timestamp}ms`, 140, yPosition);
      yPosition += 8;
    });
  } else {
    // Para imágenes - etiquetas y confianza
    labels.forEach((label, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${label.Name}`, 20, yPosition);
      doc.text(`${label.Confidence.toFixed(1)}%`, 140, yPosition);
      yPosition += 8;
    });
  }
  
  // Pie de página
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor);
    doc.text(`Página ${i} de ${pageCount}`, 20, 290);
    doc.text('STELLART VISION - Reconocimiento con IA', 150, 290);
  }
  
  // Descargar el PDF
  const fileName = `stellart-vision-analisis-${isVideo ? 'video' : 'imagen'}-${Date.now()}.pdf`;
  console.log('Descargando PDF con nombre:', fileName);
  doc.save(fileName);
  console.log('PDF descargado exitosamente');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, observerOptions);

  // Observar elementos que deben animarse
  document.querySelectorAll('.feature-card, .hero-content, .upload-card').forEach(el => {
    el.classList.add('scroll-reveal');
    observer.observe(el);
  });
}

// ===== NAVBAR SCROLL EFFECT =====
function initNavbarScrollEffect() {
  const navbar = document.querySelector('.navbar');
  let lastScrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (currentScrollY > 100) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScrollY = currentScrollY;
  });
}

// ===== SMOOTH SCROLLING =====
function initSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// ===== DRAG AND DROP =====
function initDragAndDrop() {
  const fileInput = document.getElementById('imageInput');
  const fileInputLabel = document.querySelector('.file-input-label');
  const uploadCard = document.querySelector('.upload-card');

  // Drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadCard.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadCard.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadCard.addEventListener(eventName, unhighlight, false);
  });

  function highlight(e) {
    uploadCard.classList.add('drag-over');
  }

  function unhighlight(e) {
    uploadCard.classList.remove('drag-over');
  }

  uploadCard.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      fileInput.files = files;
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
    }
  }
}

// ===== FILE INPUT PREVIEW =====
function initFilePreview() {
  const fileInput = document.getElementById('imageInput');
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const fileName = file.name;
      const fileSize = (file.size / 1024 / 1024).toFixed(2);
      const fileType = file.type.split('/')[0];
      
      // Update label with file info
      const label = document.querySelector('.file-input-label');
      label.innerHTML = `
        <i class="bi bi-file-${fileType === 'image' ? 'image' : 'play'}-fill me-2"></i>
        <span>${fileName} (${fileSize} MB)</span>
      `;
      
      // Add success class
      label.classList.add('file-selected');
    }
  });
}

// ===== INITIALIZE ALL FEATURES =====
document.addEventListener('DOMContentLoaded', function() {
  initScrollAnimations();
  initNavbarScrollEffect();
  initSmoothScrolling();
  initDragAndDrop();
  initFilePreview();
  
  // Add loading animation to upload button
  const uploadForm = document.getElementById('uploadForm');
  const uploadButton = document.querySelector('.btn-upload');
  
  uploadForm.addEventListener('submit', function() {
    uploadButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Procesando...';
    uploadButton.disabled = true;
  });
});

function renderLabelsTable(labels, containerId = 'labelsTable') {
  if (!labels || !labels.length) {
    document.getElementById(containerId).innerHTML = '';
    return;
  }

  // Detecta si es resultado de video (tiene Label y Timestamp)
  const isVideo = labels[0] && labels[0].Label && labels[0].Timestamp !== undefined;

  let html = `
    <div class="labels-table">
      <div class="table-header">
        <i class="bi bi-tags me-2"></i>
        Etiquetas detectadas en la ${isVideo ? 'video' : 'imagen'} (${labels.length})
      </div>
      <div class="table-content">
        <table class="table">
                      <thead>
              <tr>
                <th>Etiqueta</th>
                <th>Confianza</th>
                ${isVideo ? '<th>Tiempo</th>' : ''}
              </tr>
            </thead>
          <tbody>
  `;

  labels.forEach((label, index) => {
    // Debug completo de la estructura de datos
    console.log(`=== LABEL ${index} ===`);
    console.log('Complete label object:', JSON.stringify(label, null, 2));
    
    // Extraer nombre
    let name = '';
    if (isVideo && label.Label && label.Label.Name) {
      name = label.Label.Name;
    } else if (label.Name) {
      name = label.Name;
    } else {
      name = 'Unknown';
    }
    
    // Extraer confianza - probar múltiples ubicaciones posibles
    let confidenceValue = null;
    
    if (isVideo) {
      // Para videos
      if (label.Label && label.Label.Confidence !== undefined) {
        confidenceValue = label.Label.Confidence;
      }
    } else {
      // Para imágenes
      if (label.Confidence !== undefined) {
        confidenceValue = label.Confidence;
      } else if (label.confidence !== undefined) {
        confidenceValue = label.confidence;
      }
    }
    
    console.log(`Name: ${name}`);
    console.log(`Confidence value: ${confidenceValue}`);
    
    // Si no encontramos confianza, usar un valor por defecto
    if (confidenceValue === null || confidenceValue === undefined) {
      confidenceValue = 0;
      console.warn(`No confidence value found for label: ${name}`);
    }
    
    const confidencePercent = Math.round(confidenceValue * 10) / 10; // Redondear a 1 decimal (valor ya viene como porcentaje)

    html += `
      <tr class="fade-in-up" style="animation-delay: ${index * 0.1}s">
        <td>
          <div class="label-name">${name}</div>
        </td>
        <td>
          <div class="confidence-score">
            <span class="confidence-value">${confidencePercent}%</span>
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
            </div>
          </div>
        </td>
        ${isVideo ? `<td><span class="timestamp">${label.Timestamp}ms</span></td>` : ''}
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById(containerId).innerHTML = html;
}

function drawBoundingBoxes(imageElement, boxes) {
  const canvas = document.getElementById('boundingCanvas');
  const ctx = canvas.getContext('2d');
  // Ajusta el tamaño del canvas al de la imagen
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  canvas.style.width = imageElement.width + 'px';
  canvas.style.height = imageElement.height + 'px';
  canvas.style.display = 'block';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0ea5e9';
  ctx.font = '18px Poppins';
  ctx.fillStyle = '#0ea5e9';

  boxes.forEach(box => {
    // Las coordenadas de Rekognition son relativas (0-1)
    const x = box.Left * canvas.width;
    const y = box.Top * canvas.height;
    const w = box.Width * canvas.width;
    const h = box.Height * canvas.height;
    ctx.strokeRect(x, y, w, h);
    if (box.Name) {
      ctx.fillText(box.Name, x, y > 20 ? y - 5 : y + 20);
    }
  });
}

function extractBoxesFromRekognition(json) {
  const boxes = [];
  if (json.Labels) {
    json.Labels.forEach(label => {
      if (label.Instances) {
        label.Instances.forEach(instance => {
          if (instance.BoundingBox) {
            boxes.push({
              ...instance.BoundingBox,
              Name: label.Name
            });
          }
        });
      }
    });
  }
  return boxes;
}

function getJsonUrlFromMessage(message, isVideo = false) {
  console.log(`Procesando mensaje: "${message}"`);
  console.log(`Es video: ${isVideo}`);
  
  // Ejemplo: "Archivo subido como input/upload-xxxx.ext"
  const match = message.match(/input\/upload-([a-zA-Z0-9-]+)\.[a-z0-9]+/i);
  if (!match) {
    console.error(`No se pudo extraer GUID del mensaje: "${message}"`);
    return null;
  }
  
  const guid = match[1];
  console.log(`GUID extraído: ${guid}`);
  
  const jsonUrl = isVideo ? 
    `${s3BaseUrl}output-video/upload-${guid}.json` :
    `${s3BaseUrl}output/upload-${guid}.json`;
    
  console.log(`URL del JSON generada: ${jsonUrl}`);
  return jsonUrl;
}


async function waitForJson(url, maxAttempts = 150, interval = 2000) {
  console.log(`Esperando JSON en: ${url}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Intento ${attempt}/${maxAttempts} - Buscando: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        console.log(`JSON encontrado en intento ${attempt}`);
        return await response.json();
      } else {
        console.log(`Respuesta no OK: ${response.status} ${response.statusText}`);
      }
    } catch (e) {
      console.log(`Error en intento ${attempt}:`, e.message);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(res => setTimeout(res, interval));
    }
  }
  
  console.error(`No se pudo obtener JSON después de ${maxAttempts} intentos`);
  throw new Error("El archivo de resultados no estuvo disponible a tiempo.");
}

// Función para mostrar loading con animaciones
function showLoading(isVideo = false, customMessage = null) {
  const loadingContainer = document.getElementById('loadingMessage');
  const loadingDescription = document.getElementById('loadingDescription');
  
  let message;
  if (customMessage) {
    message = customMessage;
  } else {
    message = isVideo 
      ? 'Procesando video con IA, esto puede tomar varios minutos...' 
      : 'Analizando imagen con IA, por favor espera...';
  }
  
  loadingDescription.textContent = message;
  loadingContainer.style.display = 'block';
  loadingContainer.classList.add('fade-in');
  
  // Scroll suave a la sección de resultados
  document.getElementById('results').scrollIntoView({ 
    behavior: 'smooth',
    block: 'start'
  });
}

// Función para ocultar loading
function hideLoading() {
  const loadingContainer = document.getElementById('loadingMessage');
  loadingContainer.style.display = 'none';
  loadingContainer.classList.remove('fade-in');
}

// Función para mostrar errores con estilo
function showError(message) {
  const errorContainer = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  
  errorText.textContent = message;
  errorContainer.style.display = 'block';
  errorContainer.classList.add('fade-in');
  
  // Scroll suave a la sección de resultados
  document.getElementById('results').scrollIntoView({ 
    behavior: 'smooth',
    block: 'start'
  });
}

// Función para ocultar errores
function hideError() {
  const errorContainer = document.getElementById('errorMessage');
  errorContainer.style.display = 'none';
  errorContainer.classList.remove('fade-in');
}

// Función para mostrar resultados con animaciones
function showResults(isVideo = false) {
  console.log('Mostrando resultados para:', isVideo ? 'video' : 'imagen');
  hideLoading();
  hideError();
  
  const resultsContainer = isVideo ? 
    document.getElementById('videoResultsRow') : 
    document.getElementById('imageResults');
  
  resultsContainer.style.display = 'block';
  resultsContainer.classList.add('fade-in-up');
  
  
  // Scroll suave a los resultados
  setTimeout(() => {
    resultsContainer.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }, 300);
}

// Función para limpiar resultados previos
function clearPreviousResults() {
  // Ocultar todos los contenedores de resultados
  document.getElementById('loadingMessage').style.display = 'none';
  document.getElementById('videoResultsRow').style.display = 'none';
  document.getElementById('imageResults').style.display = 'none';
  document.getElementById('errorMessage').style.display = 'none';
  
  // Limpiar contenido
  document.getElementById('labelsTable').innerHTML = '';
  document.getElementById('labelsTableVideo').innerHTML = '';
  
  // Ocultar botones de descarga PDF
  document.getElementById('downloadPdfImage').style.display = 'none';
  document.getElementById('downloadPdfVideo').style.display = 'none';
  
  // Ocultar media elements
  const imageElement = document.getElementById('uploadedImage');
  const videoElement = document.getElementById('uploadedVideo');
  const canvas = document.getElementById('boundingCanvas');
  const videoCanvas = document.getElementById('videoBoundingCanvas');
  
  imageElement.style.display = 'none';
  videoElement.style.display = 'none';
  canvas.style.display = 'none';
  videoCanvas.style.display = 'none';
}

// Función para resetear la interfaz para un nuevo análisis
function resetForNewAnalysis() {
  // Ocultar todos los contenedores de resultados
  document.getElementById('loadingMessage').style.display = 'none';
  document.getElementById('videoResultsRow').style.display = 'none';
  document.getElementById('imageResults').style.display = 'none';
  document.getElementById('errorMessage').style.display = 'none';
  
  // Limpiar contenido
  document.getElementById('labelsTable').innerHTML = '';
  document.getElementById('labelsTableVideo').innerHTML = '';
  
  // Ocultar botones de descarga PDF
  document.getElementById('downloadPdfImage').style.display = 'none';
  document.getElementById('downloadPdfVideo').style.display = 'none';
  
  // Ocultar botones de nueva carga
  document.getElementById('analyzeNewBtn').style.display = 'none';
  document.getElementById('analyzeNewBtnVideo').style.display = 'none';
  
  // Ocultar media elements
  const imageElement = document.getElementById('uploadedImage');
  const videoElement = document.getElementById('uploadedVideo');
  const canvas = document.getElementById('boundingCanvas');
  const videoCanvas = document.getElementById('videoBoundingCanvas');
  
  imageElement.style.display = 'none';
  videoElement.style.display = 'none';
  canvas.style.display = 'none';
  videoCanvas.style.display = 'none';

  // Resetear el input de archivo
  const fileInput = document.getElementById('imageInput');
  fileInput.value = '';

  // Limpiar datos de análisis actual
  currentAnalysisData = null;

  // Mostrar el área de upload
  document.getElementById('uploadArea').style.display = 'block';

  // Scroll hacia arriba para mostrar el área de upload
  document.getElementById('uploadArea').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

// Función para mostrar media con animaciones
function showMedia(file, isVideo) {
  const imageElement = document.getElementById('uploadedImage');
  const videoElement = document.getElementById('uploadedVideo');
  
  if (isVideo) {
    videoElement.src = URL.createObjectURL(file);
    videoElement.style.display = 'block';
    videoElement.classList.add('fade-in');
  } else {
    imageElement.src = URL.createObjectURL(file);
    imageElement.style.display = 'block';
    imageElement.classList.add('fade-in');
  }
}

// Función para retry (llamada desde el HTML)
function retryAnalysis() {
  const fileInput = document.getElementById('imageInput');
  if (fileInput.files.length) {
    document.getElementById('uploadForm').dispatchEvent(new Event('submit'));
  }
}

document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('imageInput');
    if (!fileInput.files.length) return;

    let file = fileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    const isVideo = ['mp4'].includes(ext);

    // Limpiar resultados previos
    clearPreviousResults();

    try {
      // Validar y comprimir video si es necesario
      if (isVideo) {
        try {
          await validateVideoFile(file);
          console.log('Video válido, procediendo con la subida');
        } catch (validationError) {
          console.log('Video necesita compresión:', validationError.message);
          
          // Mostrar advertencia y comprimir
          showVideoWarning(validationError.message);
          
          // Esperar a que el usuario confirme la compresión
          return new Promise((resolve) => {
            const compressBtn = document.getElementById('compressVideoBtn');
            if (compressBtn) {
              compressBtn.addEventListener('click', async () => {
                try {
                  hideError();
                  showLoading(isVideo, 'Comprimiendo video...');
                  
                  file = await compressVideo(file);
                  console.log('Video comprimido exitosamente');
                  
                  // Continuar con el proceso de subida
                  await processFileUpload(file, isVideo);
                } catch (compressError) {
                  showError(`Error al comprimir video: ${compressError.message}`);
                }
                resolve();
              });
            }
          });
        }
      }

      // Procesar subida del archivo
      await processFileUpload(file, isVideo);

    } catch (err) {
      console.error('Error en el proceso:', err);
      showError(`Error: ${err.message}`);
    }
});

// Función separada para procesar la subida del archivo
async function processFileUpload(file, isVideo) {
    try {
      // Mostrar loading
      showLoading(isVideo);

      // Subir archivo
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: file
      });
      
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('El archivo es demasiado grande. Intenta comprimir el video o usar una imagen más pequeña.');
        }
        throw new Error(`Error del servidor: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Respuesta del servidor:', result);
      
      // Mostrar media
      showMedia(file, isVideo);

      // Obtener la URL del JSON en S3
      const jsonUrl = getJsonUrlFromMessage(result.message, isVideo);
      if (!jsonUrl) {
        throw new Error('No se pudo determinar la URL del JSON de etiquetas');
      }

      // Esperar a que el JSON esté disponible
      try {
        console.log('Iniciando espera del JSON...');
        const labelsJson = await waitForJson(jsonUrl, 150, 2000);
        console.log('JSON recibido:', labelsJson);
        
        // Almacenar datos del análisis para el PDF
        currentAnalysisData = {
          fileName: file.name,
          fileSize: file.size,
          fileExtension: file.name.split('.').pop().toLowerCase(),
          labels: labelsJson.Labels,
          analysisDate: new Date(),
          isVideo: isVideo
        };
        
        // Mostrar resultados
        showResults(isVideo);
        
        if (isVideo) {
          renderLabelsTable(labelsJson.Labels, 'labelsTableVideo');
        } else {
          renderLabelsTable(labelsJson.Labels, 'labelsTable');
        }

        // Dibujar bounding boxes para imágenes
        if (!isVideo) {
          const imageElement = document.getElementById('uploadedImage');
          imageElement.onload = () => {
            const boxes = extractBoxesFromRekognition(labelsJson);
            if (boxes.length > 0) {
              drawBoundingBoxes(imageElement, boxes);
            }
          };
          if (imageElement.complete) {
            imageElement.onload();
          }
        }
        
      } catch (err) {
        showError(`Error al procesar resultados: ${err.message}`);
      }
      
    } catch (err) {
      showError(`Error al subir archivo: ${err.message}`);
    }
}

// Event listeners para botones de descarga PDF
document.getElementById('downloadPdfImage').addEventListener('click', function() {
  generatePDF(false);
});

document.getElementById('downloadPdfVideo').addEventListener('click', function() {
  generatePDF(true);
});


// Event listeners para botones de nueva carga
document.getElementById('analyzeNewBtn').addEventListener('click', function() {
  resetForNewAnalysis();
});

document.getElementById('analyzeNewBtnVideo').addEventListener('click', function() {
  resetForNewAnalysis();
});
  
