#!/bin/bash

# Anchor Backup Script
# This script creates backups of the application data

set -e

echo "💾 Anchor Backup Script"

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}
BACKUP_BUCKET="anchor-backups-${ENVIRONMENT}"
BACKUP_PREFIX="backups/$(date +%Y-%m-%d)"

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

# Create backup directory
create_backup_dir() {
    log_info "Creating backup directory..."
    
    mkdir -p /tmp/anchor-backup
    cd /tmp/anchor-backup
}

# Backup database
backup_database() {
    log_info "Backing up database..."
    
    # Get database credentials from Kubernetes secrets
    DATABASE_URL=$(kubectl get secret anchor-secrets -n anchor -o jsonpath='{.data.database-url}' | base64 --decode)
    
    # Extract connection details
    DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\).*|\1|p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's|://\([^:]*\):.*|\1|p')
    
    # Create database dump
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f anchor_database_$(date +%Y%m%d_%H%M%S).dump
    
    log_info "Database backup completed"
}

# Backup Redis
backup_redis() {
    log_info "Backing up Redis..."
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        # Trigger Redis backup
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli BGSAVE
        
        # Wait for backup to complete
        sleep 5
        
        # Copy backup file
        kubectl cp anchor/$REDIS_POD:/data/dump.rdb ./redis_dump_$(date +%Y%m%d_%H%M%S).rdb
        
        log_info "Redis backup completed"
    else
        log_warn "Redis pod not found, skipping Redis backup"
    fi
}

# Backup Kubernetes resources
backup_kubernetes() {
    log_info "Backing up Kubernetes resources..."
    
    # Backup deployments
    kubectl get deployments -n anchor -o yaml > kubernetes_deployments_$(date +%Y%m%d_%H%M%S).yaml
    
    # Backup services
    kubectl get services -n anchor -o yaml > kubernetes_services_$(date +%Y%m%d_%H%M%S).yaml
    
    # Backup ingress
    kubectl get ingress -n anchor -o yaml > kubernetes_ingress_$(date +%Y%m%d_%H%M%S).yaml
    
    # Backup secrets
    kubectl get secrets -n anchor -o yaml > kubernetes_secrets_$(date +%Y%m%d_%H%M%S).yaml
    
    # Backup configmaps
    kubectl get configmaps -n anchor -o yaml > kubernetes_configmaps_$(date +%Y%m%d_%H%M%S).yaml
    
    log_info "Kubernetes backup completed"
}

# Backup application data
backup_application_data() {
    log_info "Backing up application data..."
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$API_POD" ]; then
        # Copy application logs
        kubectl logs $API_POD -n anchor > application_logs_$(date +%Y%m%d_%H%M%S).log
        
        # Copy any persistent data
        kubectl cp anchor/$API_POD:/app/data ./application_data_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        
        log_info "Application data backup completed"
    else
        log_warn "API pod not found, skipping application data backup"
    fi
}

# Upload to S3
upload_to_s3() {
    log_info "Uploading backups to S3..."
    
    # Create S3 bucket if it doesn't exist
    aws s3 mb s3://$BACKUP_BUCKET --region $AWS_REGION 2>/dev/null || true
    
    # Upload all backup files
    for file in *; do
        if [ -f "$file" ]; then
            aws s3 cp $file s3://$BACKUP_BUCKET/$BACKUP_PREFIX/$file --region $AWS_REGION
            log_info "Uploaded: $file"
        fi
    done
    
    log_info "S3 upload completed"
}

# Cleanup local files
cleanup() {
    log_info "Cleaning up local backup files..."
    
    cd /
    rm -rf /tmp/anchor-backup
    
    log_info "Cleanup completed"
}

# Verify backup
verify_backup() {
    log_info "Verifying backup..."
    
    # Check if files were uploaded to S3
    FILES_UPLOADED=$(aws s3 ls s3://$BACKUP_BUCKET/$BACKUP_PREFIX/ --region $AWS_REGION | wc -l)
    
    if [ $FILES_UPLOADED -gt 0 ]; then
        log_info "✅ Backup verification successful - $FILES_UPLOADED files uploaded"
    else
        log_error "❌ Backup verification failed - no files uploaded"
        exit 1
    fi
}

# Main backup function
main() {
    log_info "Starting backup for ${ENVIRONMENT}..."
    
    create_backup_dir
    backup_database
    backup_redis
    backup_kubernetes
    backup_application_data
    upload_to_s3
    verify_backup
    cleanup
    
    log_info "✅ Backup completed successfully!"
    log_info "Backup location: s3://$BACKUP_BUCKET/$BACKUP_PREFIX/"
}

# Run main function
main
