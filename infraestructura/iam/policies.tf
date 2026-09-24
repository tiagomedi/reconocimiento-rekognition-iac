resource "aws_iam_role" "lambda_exec" {
  name = "lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "rekognition_s3" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"
}

resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_policy" "rekognition_video_policy" {
  name = "rekognition-video-policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "rekognition:StartLabelDetection",
          "rekognition:GetLabelDetection"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rekognition_video" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.rekognition_video_policy.arn
}

resource "aws_iam_policy" "lambda_passrole_policy" {
  name = "lambda-passrole-policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "iam:PassRole"
        ],
        Resource = var.rekognition_role_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_passrole_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_passrole_policy.arn
}

resource "aws_iam_policy" "lambda_video_result_s3_put" {
  name = "lambda-video-result-s3-put"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject"
        ],
        Resource = "arn:aws:s3:::${var.bucket_name}/output-video/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_video_result_s3_put_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_video_result_s3_put.arn
}