# AWS WAF in front of CloudFront (prod). The managed rule groups start in
# count mode so false positives on JSON bodies show up in the log before they
# block anything; flip `waf_block` once the log looks clean. The rate limit
# always blocks.

locals {
  waf_managed_rule_groups = [
    { priority = 10, name = "AWSManagedRulesAmazonIpReputationList" },
    { priority = 20, name = "AWSManagedRulesCommonRuleSet" },
    { priority = 30, name = "AWSManagedRulesKnownBadInputsRuleSet" },
  ]
}

resource "aws_wafv2_web_acl" "this" {
  count = var.enable_waf ? 1 : 0

  name        = "${var.name}-web-acl"
  description = "Managed rules and a per-IP rate limit for ${var.name}"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = 2000
        evaluation_window_sec = 300
        aggregate_key_type    = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = local.waf_managed_rule_groups

    content {
      name     = rule.value.name
      priority = rule.value.priority

      override_action {
        dynamic "none" {
          for_each = var.waf_block ? [1] : []
          content {}
        }

        dynamic "count" {
          for_each = var.waf_block ? [] : [1]
          content {}
        }
      }

      statement {
        managed_rule_group_statement {
          name        = rule.value.name
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name}-${rule.value.name}"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-web-acl"
    sampled_requests_enabled   = true
  }
}

# WAF logs must go to a group named aws-waf-logs-*.
resource "aws_cloudwatch_log_group" "waf" {
  count = var.enable_waf ? 1 : 0

  name              = "aws-waf-logs-${var.name}"
  retention_in_days = 7
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  count = var.enable_waf ? 1 : 0

  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
  resource_arn            = aws_wafv2_web_acl.this[0].arn
}
