resource "aws_sns_topic" "rekognition_video_topic" {
  name = "rekognition-video-finish"
}

resource "aws_iam_role" "rekognition_sns_publish" {
  name = "rekognition-sns-publish-role"
  assume_role_policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "rekognition.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "rekognition_sns_publish_policy" {
  name = "rekognition-sns-publish-policy"
  role = aws_iam_role.rekognition_sns_publish.id
  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "sns:Publish",
        "Resource": aws_sns_topic.rekognition_video_topic.arn
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject"
        ],
        "Resource": "${var.bucket_arn}/input/*"
      }
    ]
  })
}