#!/bin/bash

# Anchor Deployment Script
# This script deploys the application to production

set -e

echo "🚀 Deploying Anchor to production..."

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}
CLUSTER_NAME="anchor-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build API image
    log_info "Building API image..."
    docker build -t anchor/api:${GITHUB_SHA:-latest} -f apps/api/Dockerfile .
    
    # Build AI image
    log_info "Building AI image..."
    docker build -t anchor/ai:${GITHUB_SHA:-latest} -f apps/ai/Dockerfile .
    
    # Build Web image
    log_info "Building Web image..."
    docker build -t anchor/web:${GITHUB_SHA:-latest} -f apps/web/Dockerfile .
    
    log_info "Docker images built successfully"
}

# Push images to ECR
push_images() {
    log_info "Pushing images to ECR..."
    
    # Get ECR login token
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com
    
    # Get ECR repository URLs
    API_REPO=$(aws ecr describe-repositories --repository-names anchor-api --query 'repositories[0].repositoryUri' --output text)
    AI_REPO=$(aws ecr describe-repositories --repository-names anchor-ai --query 'repositories[0].repositoryUri' --output text)
    WEB_REPO=$(aws ecr describe-repositories --repository-names anchor-web --query 'repositories[0].repositoryUri' --output text)
    
    # Tag images
    docker tag anchor/api:${GITHUB_SHA:-latest} ${API_REPO}:${GITHUB_SHA:-latest}
    docker tag anchor/ai:${GITHUB_SHA:-latest} ${AI_REPO}:${GITHUB_SHA:-latest}
    docker tag anchor/web:${GITHUB_SHA:-latest} ${WEB_REPO}:${GITHUB_SHA:-latest}
    
    # Push images
    docker push ${API_REPO}:${GITHUB_SHA:-latest}
    docker push ${AI_REPO}:${GITHUB_SHA:-latest}
    docker push ${WEB_REPO}:${GITHUB_SHA:-latest}
    
    log_info "Images pushed to ECR successfully"
}

# Update Kubernetes deployments
update_kubernetes() {
    log_info "Updating Kubernetes deployments..."
    
    # Update kubeconfig
    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}
    
    # Update API deployment
    kubectl set image deployment/anchor-api anchor-api=anchor/api:${GITHUB_SHA:-latest} -n anchor
    
    # Update AI deployment
    kubectl set image deployment/anchor-ai anchor-ai=anchor/ai:${GITHUB_SHA:-latest} -n anchor
    
    # Update Web deployment
    kubectl set image deployment/anchor-web anchor-web=anchor/web:${GITHUB_SHA:-latest} -n anchor
    
    # Wait for rollouts
    log_info "Waiting for deployments to complete..."
    kubectl rollout status deployment/anchor-api -n anchor --timeout=300s
    kubectl rollout status deployment/anchor-ai -n anchor --timeout=300s
    kubectl rollout status deployment/anchor-web -n anchor --timeout=300s
    
    log_info "Kubernetes deployments updated successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Get database URL from secrets
    DATABASE_URL=$(kubectl get secret anchor-secrets -n anchor -o jsonpath='{.data.database-url}' | base64 --decode)
    
    # Run migrations
    kubectl exec -it deployment/anchor-api -n anchor -- sh -c 'cd packages/database && npx prisma migrate deploy'
    
    log_info "Database migrations completed"
}

# Health check
health_check() {
    log_info "Running health check..."
    
    # Get API endpoint
    API_ENDPOINT=$(kubectl get ingress anchor-ingress -n anchor -o jsonpath='{.spec.rules[?(@.host=="api.anchor.app")].host}')
    
    # Check API health
    if curl -f "https://${API_ENDPOINT}/health" > /dev/null 2>&1; then
        log_info "API health check passed"
    else
        log_error "API health check failed"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting deployment to ${ENVIRONMENT}..."
    
    check_prerequisites
    build_images
    push_images
    update_kubernetes
    run_migrations
    health_check
    
    log_info "✅ Deployment to ${ENVIRONMENT} completed successfully!"
    log_info "API endpoint: https://api.anchor.app"
    log_info "Web endpoint: https://anchor.app"
    log_info "API docs: https://api.anchor.app/api/docs"
}

# Run main function
main
