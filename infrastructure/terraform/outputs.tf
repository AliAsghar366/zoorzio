output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "database_endpoint" {
  description = "RDS endpoint"
  value       = module.db.db_instance_endpoint
}

output "database_port" {
  description = "RDS port"
  value       = module.db.db_instance_port
}

output "database_name" {
  description = "RDS database name"
  value       = module.db.db_instance_name
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster CA certificate data, base64 encoded"
  value       = module.eks.cluster_certificate_authority_data
}

output "eks_oidc_provider_arn" {
  description = "ARN of the EKS OIDC provider, for wiring up IRSA roles"
  value       = module.eks.oidc_provider_arn
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.storage.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.storage.arn
}

output "kms_key_arn" {
  description = "KMS key ARN"
  value       = aws_kms_key.anchor.arn
}

output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.anchor.key_id
}

output "api_security_group_id" {
  description = "API security group ID"
  value       = module.vpc.default_security_group_id
}

output "database_security_group_id" {
  description = "Database security group ID"
  value       = module.db.db_instance_security_group_id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.api.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.api.arn
}

# Connection strings (sensitive)
output "database_url" {
  description = "Database connection URL"
  value       = "postgresql://${module.db.db_instance_username}:${random_password.db_password.result}@${module.db.db_instance_endpoint}/${module.db.db_instance_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "rediss://:${random_password.redis_auth.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  sensitive   = true
}
