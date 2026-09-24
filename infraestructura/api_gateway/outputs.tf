output "api_execution_arn" {
  value = aws_apigatewayv2_api.http_api.execution_arn
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}
