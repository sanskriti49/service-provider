terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ==============================================================================
# S3: Zero-Egress Cloud Object Storage (KYC Docs & Avatars)
# ==============================================================================
resource "aws_s3_bucket" "taskgenie_assets" {
  bucket        = "taskgenie-${var.environment}-assets"
  force_destroy = false

  tags = {
    Environment = var.environment
    Service     = "TaskGenie"
  }
}

resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket                  = aws_s3_bucket.taskgenie_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "assets_cors" {
  bucket = aws_s3_bucket.taskgenie_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = [var.client_origin]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ==============================================================================
# SQS: Asynchronous Event-Driven Architecture (EDA) & Dead-Letter Queue (DLQ)
# ==============================================================================
resource "aws_sqs_queue" "booking_events_dlq" {
  name                      = "taskgenie-booking-events-dlq"
  message_retention_seconds = 1209600 # 14 days retention for troubleshooting
}

resource "aws_sqs_queue" "booking_events" {
  name                      = "taskgenie-booking-events"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.booking_events_dlq.arn
    maxReceiveCount     = 3
  })
}

# ==============================================================================
# IAM: Least-Privilege Execution Role
# ==============================================================================
resource "aws_iam_role" "taskgenie_ecs_task" {
  name = "taskgenie-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_policy" "taskgenie_least_privilege" {
  name        = "taskgenie-${var.environment}-policy"
  description = "Allows TaskGenie API to sign S3 upload URLs and produce/consume SQS messages"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.taskgenie_assets.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.booking_events.arn,
          aws_sqs_queue.booking_events_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_least_privilege" {
  role       = aws_iam_role.taskgenie_ecs_task.name
  policy_arn = aws_iam_policy.taskgenie_least_privilege.arn
}
