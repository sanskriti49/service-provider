variable "aws_region" {
  description = "Target AWS deployment region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "client_origin" {
  description = "Allowed frontend web origin for S3 direct upload CORS"
  type        = string
  default     = "https://taskgenieee.vercel.app"
}
