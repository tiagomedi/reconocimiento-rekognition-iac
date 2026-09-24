import boto3
import os
import json

def handler(event, context):
    rekognition = boto3.client('rekognition')
    s3 = boto3.client('s3')
    BUCKET_NAME = os.environ['BUCKET_NAME']
    print(f"[INFO] Iniciando proceso de video")
    for record in event['Records']:
        message = json.loads(record['Sns']['Message'])
        job_id = message['JobId']
        # Intenta obtener el nombre del archivo original del mensaje SNS
        video_s3_key = None
        if 'Video' in message and 'S3ObjectName' in message['Video']:
            video_s3_key = message['Video']['S3ObjectName']
        # Si no está en el mensaje, intenta obtenerlo desde Rekognition
        if not video_s3_key:
            job_info = rekognition.get_label_detection(JobId=job_id, MaxResults=1)
            video_s3_key = job_info.get('VideoMetadata', {}).get('S3ObjectName')
        # Nombre base para el JSON de salida (sin extensión de video)
        if video_s3_key and video_s3_key.startswith('input/'):
            guid = video_s3_key.replace('input/upload-', '').rsplit('.', 1)[0]
            base_name = f"output-video/upload-{guid}.json"
        else:
            base_name = f"output-video/{job_id}.json"
        # Obtener los resultados del análisis de video
        try:
            response = rekognition.get_label_detection(JobId=job_id)
            print(f"[INFO] Respuesta de Rekognition: {response}")
            print(f"[INFO] Bucket: {BUCKET_NAME}")
            print(f"[INFO] Bucket: {base_name}")
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=base_name,
                Body=json.dumps(response, indent=2).encode('utf-8'),
                ContentType='application/json'
            )
            print(f"[INFO] Resultados de video guardados en: {base_name}")
        except Exception as e:
            print(f"[ERROR] Error al procesar el video o guardar en S3: {e}")
            raise 