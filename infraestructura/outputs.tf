output "api_upload_endpoint" {
  value = "${module.api_gateway.api_endpoint}/upload"
  description = "Endpoint completo para subir archivos"
}

output "s3_url" {
  value = module.s3.bucket_url
  description = "URL del bucket S3"
}
