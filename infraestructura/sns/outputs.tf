output "sns_topic_arn" {
  value = aws_sns_topic.rekognition_video_topic.arn
}

output "rekognition_role_arn" {
  value = aws_iam_role.rekognition_sns_publish.arn
}