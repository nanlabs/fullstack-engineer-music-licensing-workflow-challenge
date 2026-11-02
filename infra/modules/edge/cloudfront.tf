module "cloudfront" {
  source  = "terraform-aws-modules/cloudfront/aws"
  version = "~> 6.7"

  comment             = "${var.name}: SPA from S3, /api/* to the internal ALB"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  default_root_object = "index.html"
  wait_for_deployment = false
  web_acl_id          = var.enable_waf ? aws_wafv2_web_acl.this[0].arn : null

  origin_access_control = {
    s3 = {
      description      = "${var.name} web bucket"
      origin_type      = "s3"
      signing_behavior = "always"
      signing_protocol = "sigv4"
    }
  }

  # The VPC origin reaches the private ALB through a service-managed ENI; the
  # ALB security group admits the CloudFront origin-facing prefix list.
  vpc_origin = {
    api = {
      name                   = "${var.name}-api-alb"
      arn                    = module.alb.arn
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"

      origin_ssl_protocols = {
        items    = ["TLSv1.2"]
        quantity = 1
      }
    }
  }

  origin = {
    web = {
      domain_name               = aws_s3_bucket.web.bucket_regional_domain_name
      origin_access_control_key = "s3"
    }

    api = {
      domain_name = module.alb.dns_name

      # Read timeout counts the gap between packets: the SSE keep-alive every
      # 15 s keeps the stream open for as long as the backend allows (15 min).
      vpc_origin_config = {
        vpc_origin_key           = "api"
        origin_read_timeout      = 60
        origin_keepalive_timeout = 60
      }
    }
  }

  cloudfront_functions = {
    spa_rewrite = {
      name    = "${var.name}-spa-rewrite"
      runtime = "cloudfront-js-2.0"
      code    = file("${path.module}/functions/spa-rewrite.js")
      publish = true
      comment = "Serve index.html for client-side routes"
    }
  }

  response_headers_policies = {
    security = {
      name    = "${var.name}-security-headers"
      comment = "Baseline security headers for the SPA and the API"

      security_headers_config = {
        strict_transport_security = {
          access_control_max_age_sec = 31536000
          include_subdomains         = true
          preload                    = false
          override                   = true
        }
        content_type_options = {
          override = true
        }
        frame_options = {
          frame_option = "DENY"
          override     = true
        }
        referrer_policy = {
          referrer_policy = "strict-origin-when-cross-origin"
          override        = true
        }
        xss_protection = {
          protection = true
          mode_block = true
          override   = true
        }
      }
    }
  }

  default_cache_behavior = {
    target_origin_id            = "web"
    viewer_protocol_policy      = "redirect-to-https"
    allowed_methods             = ["GET", "HEAD", "OPTIONS"]
    cached_methods              = ["GET", "HEAD"]
    compress                    = true
    cache_policy_name           = "Managed-CachingOptimized"
    response_headers_policy_key = "security"

    function_association = {
      viewer-request = {
        function_key = "spa_rewrite"
      }
    }
  }

  # No caching and no compression for the API: cookies, Last-Event-ID and the
  # event stream must reach the backend untouched.
  ordered_cache_behavior = [
    {
      path_pattern                = "/api/*"
      target_origin_id            = "api"
      viewer_protocol_policy      = "https-only"
      allowed_methods             = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods              = ["GET", "HEAD"]
      compress                    = false
      cache_policy_name           = "Managed-CachingDisabled"
      origin_request_policy_name  = "Managed-AllViewerExceptHostHeader"
      response_headers_policy_key = "security"
    },
  ]

  # The default *.cloudfront.net certificate only accepts TLSv1 as the minimum
  # protocol version; a custom domain with an ACM certificate lifts this.
  viewer_certificate = {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }
}
