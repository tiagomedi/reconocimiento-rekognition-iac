provider "aws" {
  region = var.aws_region
}

# Data source para empaquetar lambda_upload
data "archive_file" "lambda_upload_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/index_upload.py"
  output_path = "${path.module}/build/lambda_upload.zip"
}

# Data source para empaquetar lambda_process
data "archive_file" "lambda_process_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/index_process.py"
  output_path = "${path.module}/build/lambda_process.zip"
}

# Data source para empaquetar lambda_video_result
data "archive_file" "lambda_video_result_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda/index_video_result.py"
  output_path = "${path.module}/build/lambda_video_result.zip"
}

module "s3" {
  source     = "./s3"
  aws_region = var.aws_region
}

module "sns" {
  source     = "./sns"
  bucket_arn = module.s3.bucket_arn
}

module "iam" {
  source = "./iam"
  rekognition_role_arn = module.sns.rekognition_role_arn
  bucket_name = module.s3.bucket_name
}

module "api_gateway" {
  source = "./api_gateway"
  lambda_invoke_arn = aws_lambda_function.lambda_upload.invoke_arn
}
resource "aws_lambda_function" "lambda_upload" {
  function_name = "lambda-upload"
  role          = module.iam.lambda_exec_role_arn
  handler       = "index_upload.handler"
  runtime       = "python3.12"
  filename      = data.archive_file.lambda_upload_zip.output_path
  source_code_hash = data.archive_file.lambda_upload_zip.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME = module.s3.bucket_name
    }
  }
}

resource "aws_lambda_function" "lambda_process" {
  function_name = "lambda-process"
  role          = module.iam.lambda_exec_role_arn
  handler       = "index_process.handler"
  runtime       = "python3.12"
  filename      = data.archive_file.lambda_process_zip.output_path
  source_code_hash = data.archive_file.lambda_process_zip.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME           = module.s3.bucket_name
      SNS_TOPIC_ARN         = module.sns.sns_topic_arn
      REKOGNITION_ROLE_ARN  = module.sns.rekognition_role_arn
    }
  }
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_process.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = module.s3.bucket_arn
}

resource "aws_s3_bucket_notification" "lambda_trigger" {
  bucket = module.s3.bucket_name

  lambda_function {
    lambda_function_arn = aws_lambda_function.lambda_process.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "input/"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.api_execution_arn}/*/*"
}

resource "aws_lambda_function" "lambda_video_result" {
  function_name = "lambda-video-result"
  role          = module.iam.lambda_exec_role_arn
  handler       = "index_video_result.handler"
  runtime       = "python3.12"
  filename      = data.archive_file.lambda_video_result_zip.output_path
  source_code_hash = data.archive_file.lambda_video_result_zip.output_base64sha256
  timeout = 30

  environment {
    variables = {
      BUCKET_NAME = module.s3.bucket_name
    }
  }
}

resource "aws_lambda_permission" "allow_sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_video_result.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = module.sns.sns_topic_arn
}

resource "aws_sns_topic_subscription" "video_result_lambda" {
  topic_arn = module.sns.sns_topic_arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.lambda_video_result.arn
}