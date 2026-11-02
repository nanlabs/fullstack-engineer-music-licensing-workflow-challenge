# Everything on the request path in front of the backend tasks: the S3 bucket
# with the SPA, the CloudFront distribution that serves it and proxies /api/*
# to a private ALB through a VPC origin, the optional WAF, and the ALB itself.
# One origin for the browser means the HttpOnly cookies stay first-party.

data "aws_caller_identity" "current" {}
