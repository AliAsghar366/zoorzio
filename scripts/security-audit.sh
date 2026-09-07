#!/bin/bash

# Anchor Security Audit Script
# This script performs security audits on the application

set -e

echo "🔒 Anchor Security Audit Script"

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}

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

log_header() {
    echo -e "\n========================================"
    echo -e " $1"
    echo -e "========================================"
}

# Check Kubernetes security
check_kubernetes_security() {
    log_header "Kubernetes Security"
    
    # Check RBAC
    log_info "Checking RBAC policies..."
    kubectl get clusterrolebindings -o wide | grep -E "(admin|cluster-admin)" || log_info "No excessive RBAC found"
    
    # Check network policies
    log_info "Checking network policies..."
    kubectl get networkpolicies -n anchor || log_warn "No network policies found"
    
    # Check pod security policies
    log_info "Checking pod security policies..."
    kubectl get podsecuritypolicies || log_warn "No pod security policies found"
    
    # Check secrets
    log_info "Checking secrets..."
    kubectl get secrets -n anchor | grep -v "docker-registry" || log_info "Secrets look clean"
    
    # Check service accounts
    log_info "Checking service accounts..."
    kubectl get serviceaccounts -n anchor
}

# Check Docker security
check_docker_security() {
    log_header "Docker Security"
    
    # Check for root user in Dockerfiles
    log_info "Checking Dockerfiles for root user..."
    find . -name "Dockerfile" -exec grep -l "USER root" {} \; || log_info "No Dockerfiles running as root"
    
    # Check for sensitive data in Docker images
    log_info "Checking for sensitive data in Docker images..."
    docker images | grep -E "(api|ai|web)" | head -5
    
    # Check Docker image vulnerabilities
    log_info "Docker image vulnerability scan (requires trivy)..."
    if command -v trivy &> /dev/null; then
        docker images | grep -E "(api|ai|web)" | awk '{print $1}' | head -3 | while read image; do
            trivy image --severity HIGH,CRITICAL $image
        done
    else
        log_warn "Trivy not installed, skipping image vulnerability scan"
    fi
}

# Check application security
check_application_security() {
    log_header "Application Security"
    
    # Check API endpoints
    log_info "Checking API endpoints..."
    API_ENDPOINT=$(kubectl get ingress anchor-ingress -n anchor -o jsonpath='{.spec.rules[?(@.host=="api.anchor.app")].host}')
    
    if [ -n "$API_ENDPOINT" ]; then
        # Check for exposed endpoints
        curl -s "https://${API_ENDPOINT}/health" > /dev/null && log_info "Health endpoint accessible"
        
        # Check for authentication
        curl -s "https://${API_ENDPOINT}/api/memory" | grep -q "Unauthorized" && log_info "Authentication working"
        
        # Check for rate limiting
        for i in {1..105}; do
            curl -s "https://${API_ENDPOINT}/health" > /dev/null
        done
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://${API_ENDPOINT}/health")
        if [ "$RESPONSE" = "429" ]; then
            log_info "Rate limiting working"
        else
            log_warn "Rate limiting may not be working"
        fi
    fi
    
    # Check for security headers
    log_info "Checking security headers..."
    curl -s -I "https://${API_ENDPOINT}/health" | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection|Strict-Transport-Security)" || log_warn "Some security headers missing"
}

# Check database security
check_database_security() {
    log_header "Database Security"
    
    # Get database pod
    DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$DB_POD" ]; then
        # Check database connections
        log_info "Checking database connections..."
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"
        
        # Check database users
        log_info "Checking database users..."
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT usename FROM pg_user"
        
        # Check database permissions
        log_info "Checking database permissions..."
        kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT grantee, privilege_type FROM information_schema.role_grants"
    else
        log_warn "Database pod not found"
    fi
}

# Check Redis security
check_redis_security() {
    log_header "Redis Security"
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        # Check Redis configuration
        log_info "Checking Redis configuration..."
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli CONFIG GET requirepass
        
        # Check Redis clients
        log_info "Checking Redis clients..."
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli CLIENT LIST
    else
        log_warn "Redis pod not found"
    fi
}

# Check AWS security
check_aws_security() {
    log_header "AWS Security"
    
    # Check IAM policies
    log_info "Checking IAM policies..."
    aws iam list-policies --query 'Policies[?contains(PolicyName, `anchor`)]' --output table
    
    # Check security groups
    log_info "Checking security groups..."
    aws ec2 describe-security-groups --filters "Name=tag:Project,Values=anchor" --query 'SecurityGroups[*].{GroupId:GroupId,GroupName:GroupName,IpPermissions:IpPermissions}' --output table
    
    # Check S3 bucket policies
    log_info "Checking S3 bucket policies..."
    aws s3api get-bucket-policy --bucket anchor-storage-production 2>/dev/null || log_info "No bucket policy found"
    
    # Check RDS security
    log_info "Checking RDS security..."
    aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `anchor`)]' --output table
}

# Check for common vulnerabilities
check_common_vulnerabilities() {
    log_header "Common Vulnerabilities"
    
    # Check for SQL injection
    log_info "Checking for SQL injection vulnerabilities..."
    grep -r "SELECT \*" apps/api/src/ | grep -v "node_modules" || log_info "No SELECT * found"
    
    # Check for XSS vulnerabilities
    log_info "Checking for XSS vulnerabilities..."
    grep -r "innerHTML" apps/web/ | grep -v "node_modules" || log_info "No innerHTML found"
    
    # Check for hardcoded secrets
    log_info "Checking for hardcoded secrets..."
    grep -r "password\s*=" apps/ | grep -v "node_modules" | grep -v ".env" | grep -v "passwordHash" || log_info "No hardcoded passwords found"
    
    # Check for insecure dependencies
    log_info "Checking for insecure dependencies..."
    cd apps/api && npm audit 2>/dev/null || log_warn "npm audit found issues"
    cd ../..
}

# Generate security report
generate_report() {
    log_header "Security Audit Report"
    
    echo "Environment: ${ENVIRONMENT}"
    echo "Region: ${AWS_REGION}"
    echo "Timestamp: $(date)"
    echo ""
    
    check_kubernetes_security
    check_docker_security
    check_application_security
    check_database_security
    check_redis_security
    check_aws_security
    check_common_vulnerabilities
    
    log_info "✅ Security audit completed"
}

# Main function
main() {
    log_info "Starting security audit for ${ENVIRONMENT}..."
    
    generate_report
}

# Run main function
main
