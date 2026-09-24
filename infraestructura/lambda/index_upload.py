import boto3
import os
import base64
import uuid
import json

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        # Manejo de método OPTIONS para CORS preflight
        if event['requestContext']['http']['method'] == 'OPTIONS':
            return {
                'statusCode': 200,
                'body': json.dumps({ "message": "" })
            }

        # Procesamiento del POST
        is_base64 = event.get('isBase64Encoded', False)
        body = event['body']

        # Si viene como base64, decodifica, si no, asume binario
        if is_base64:
            file_data = base64.b64decode(body)
        else:
            # Si es string, conviértelo a bytes
            file_data = body.encode('utf-8') if isinstance(body, str) else body

        # Detectar tipo de archivo
        content_type = event['headers'].get('content-type', 'application/octet-stream')
        # Extraer extensión de content-type
        if '/' in content_type:
            extension = content_type.split('/')[-1]
        else:
            extension = 'bin'

        # Aceptar extensiones comunes de imagen y video
        allowed_exts = ['jpg', 'jpeg', 'png', 'mp4']
        if extension not in allowed_exts:
            extension = 'bin'

        file_name = f"input/upload-{uuid.uuid4()}.{extension}"

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=file_name,
            Body=file_data,
            ContentType=content_type
        )

        return {
            'statusCode': 200,
            'body': json.dumps({ "message": f"Archivo subido como {file_name}" })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({ "message": f"Error: {str(e)}" })
        }
