import json
import boto3
import os

rekognition = boto3.client('rekognition')
s3 = boto3.client('s3')

BUCKET_NAME = os.environ['BUCKET_NAME']

IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png')
VIDEO_EXTENSIONS = ('.mp4',)

def handler(event, context):
    for record in event['Records']:
        key = record['s3']['object']['key']

        # Solo procesar archivos del prefijo input/
        if not key.startswith('input/'):
            continue

        try:
            if key.lower().endswith(IMAGE_EXTENSIONS):
                # Procesar imagen
                response = rekognition.detect_labels(
                    Image={
                        'S3Object': {
                            'Bucket': BUCKET_NAME,
                            'Name': key
                        }
                    },
                    MaxLabels=10,
                    MinConfidence=75
                )
                # Generar nombre de archivo de salida sin extensión de imagen
                base_name = key.replace('input/', 'output/')
                # Remover extensión de imagen y agregar .json
                for ext in IMAGE_EXTENSIONS:
                    if base_name.lower().endswith(ext):
                        base_name = base_name[:-len(ext)]
                        break
                output_key = base_name + '.json'
                
                s3.put_object(
                    Bucket=BUCKET_NAME,
                    Key=output_key,
                    Body=json.dumps(response, indent=2).encode('utf-8'),
                    ContentType='application/json'
                )
                print(f"[INFO] Resultados de imagen guardados en: {output_key}")

            elif key.lower().endswith(VIDEO_EXTENSIONS):
                # Procesar video (asíncrono)
                response = rekognition.start_label_detection(
                    Video={
                        'S3Object': {
                            'Bucket': BUCKET_NAME,
                            'Name': key
                        }
                    },
                    NotificationChannel={
                        'SNSTopicArn': os.environ['SNS_TOPIC_ARN'],
                        'RoleArn': os.environ['REKOGNITION_ROLE_ARN']
                    }
                )
                job_id = response['JobId']
                # Guarda el JobId en S3 para rastrear el análisis
                base_name = key.replace('input/', 'output-video/')
                # Remover extensión de video y agregar .jobid
                for ext in VIDEO_EXTENSIONS:
                    if base_name.lower().endswith(ext):
                        base_name = base_name[:-len(ext)]
                        break
                job_key = base_name + '.jobid'
                
                s3.put_object(
                    Bucket=BUCKET_NAME,
                    Key=job_key,
                    Body=job_id.encode('utf-8'),
                    ContentType='text/plain'
                )
                print(f"[INFO] Análisis de video iniciado. JobId: {job_id}")

            else:
                print(f"[WARN] Tipo de archivo no soportado: {key}")

        except Exception as e:
            print(f"[ERROR] Error al procesar {key}: {str(e)}")
