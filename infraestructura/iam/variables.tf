variable "bucket_name" {
  description = "Nombre del bucket S3 principal"
  type        = string
}

variable "rekognition_role_arn" {
  description = "ARN del rol de Rekognition SNS"
  type        = string
} 
