#!/bin/bash

# Anchor Monitoring Script
# This script monitors the application health and performance

set -e

echo "📊 Anchor Monitoring Dashboard"

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}
CLUSTER_NAME="anchor-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Check Kubernetes cluster status
check_cluster() {
    log_header "Kubernetes Cluster Status"
    
    # Update kubeconfig
    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}
    
    # Check cluster info
    kubectl cluster-info
    
    # Check node status
    log_info "Node Status:"
    kubectl get nodes
    
    # Check pod status
    log_info "Pod Status:"
    kubectl get pods -n anchor
}

# Check deployment status
check_deployments() {
    log_header "Deployment Status"
    
    # Check API deployment
    log_info "API Deployment:"
    kubectl get deployment anchor-api -n anchor
    
    # Check AI deployment
    log_info "AI Deployment:"
    kubectl get deployment anchor-ai -n anchor
    
    # Check Web deployment
    log_info "Web Deployment:"
    kubectl get deployment anchor-web -n anchor
}

# Check service status
check_services() {
    log_header "Service Status"
    
    kubectl get services -n anchor
}

# Check ingress status
check_ingress() {
    log_header "Ingress Status"
    
    kubectl get ingress -n anchor
}

# Check pod logs
check_logs() {
    log_header "Recent Pod Logs"
    
    # API logs
    log_info "API Logs (last 10 lines):"
    kubectl logs deployment/anchor-api -n anchor --tail=10
    
    # AI logs
    log_info "AI Logs (last 10 lines):"
    kubectl logs deployment/anchor-ai -n anchor --tail=10
    
    # Web logs
    log_info "Web Logs (last 10 lines):"
    kubectl logs deployment/anchor-web -n anchor --tail=10
}

# Check resource usage
check_resources() {
    log_header "Resource Usage"
    
    # Check pod resource usage
    log_info "Pod Resource Usage:"
    kubectl top pods -n anchor
    
    # Check node resource usage
    log_info "Node Resource Usage:"
    kubectl top nodes
}

# Check health endpoints
check_health() {
    log_header "Health Check"
    
    # Get API endpoint
    API_ENDPOINT=$(kubectl get ingress anchor-ingress -n anchor -o jsonpath='{.spec.rules[?(@.host=="api.anchor.app")].host}')
    
    # Check API health
    log_info "API Health:"
    curl -s "https://${API_ENDPOINT}/health" | jq .
    
    # Check detailed health
    log_info "API Detailed Health:"
    curl -s "https://${API_ENDPOINT}/health/detailed" | jq .
}

# Check database status
check_database() {
    log_header "Database Status"
    
    # Get database pod
    DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$DB_POD" ]; then
        log_info "Database Pod: $DB_POD"
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT 1"
    else
        log_warn "Database pod not found"
    fi
}

# Check Redis status
check_redis() {
    log_header "Redis Status"
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        log_info "Redis Pod: $REDIS_POD"
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli ping
    else
        log_warn "Redis pod not found"
    fi
}

# Check recent events
check_events() {
    log_header "Recent Events"
    
    kubectl get events -n anchor --sort-by='.lastTimestamp' | tail -20
}

# Check certificate status
check_certificates() {
    log_header "Certificate Status"
    
    kubectl get certificates -n anchor
    kubectl get certificaterequests -n anchor
}

# Check autoscaling status
check_autoscaling() {
    log_header "Autoscaling Status"
    
    kubectl get hpa -n anchor
}

# Generate monitoring report
generate_report() {
    log_header "Monitoring Report"
    
    echo "Environment: ${ENVIRONMENT}"
    echo "Region: ${AWS_REGION}"
    echo "Cluster: ${CLUSTER_NAME}"
    echo "Timestamp: $(date)"
    echo ""
    
    # Check all components
    check_cluster
    check_deployments
    check_services
    check_ingress
    check_resources
    check_health
    check_database
    check_redis
    check_events
    check_certificates
    check_autoscaling
    
    log_info "✅ Monitoring report generated"
}

# Main monitoring function
main() {
    log_info "Starting monitoring for ${ENVIRONMENT}..."
    
    generate_report
}

# Run main function
main
