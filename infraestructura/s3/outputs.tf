output "bucket_name" {
  value = aws_s3_bucket.images.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.images.arn
}

output "bucket_url" {
  value = "https://${aws_s3_bucket.images.bucket}.s3.${var.aws_region}.amazonaws.com"
}