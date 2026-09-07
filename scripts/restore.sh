#!/bin/bash

# Anchor Restore Script
# This script restores backups of the application data

set -e

echo "🔄 Anchor Restore Script"

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}
BACKUP_BUCKET="anchor-backups-${ENVIRONMENT}"
BACKUP_DATE=${3:-$(date +%Y-%m-%d)}
BACKUP_PREFIX="backups/${BACKUP_DATE}"

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

# Download backup from S3
download_backup() {
    log_info "Downloading backup from S3..."
    
    # Create local restore directory
    mkdir -p /tmp/anchor-restore
    cd /tmp/anchor-restore
    
    # Download all files from S3
    aws s3 cp s3://$BACKUP_BUCKET/$BACKUP_PREFIX/ . --recursive --region $AWS_REGION
    
    log_info "Backup download completed"
}

# Restore database
restore_database() {
    log_info "Restoring database..."
    
    # Find database dump file
    DB_DUMP=$(ls -1 *.dump 2>/dev/null | head -1)
    
    if [ -z "$DB_DUMP" ]; then
        log_error "No database dump file found"
        exit 1
    fi
    
    # Get database credentials from Kubernetes secrets
    DATABASE_URL=$(kubectl get secret anchor-secrets -n anchor -o jsonpath='{.data.database-url}' | base64 --decode)
    
    # Extract connection details
    DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\).*|\1|p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's|://\([^:]*\):.*|\1|p')
    
    # Restore database
    pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $DB_DUMP
    
    log_info "Database restore completed"
}

# Restore Redis
restore_redis() {
    log_info "Restoring Redis..."
    
    # Find Redis dump file
    REDIS_DUMP=$(ls -1 *.rdb 2>/dev/null | head -1)
    
    if [ -z "$REDIS_DUMP" ]; then
        log_warn "No Redis dump file found, skipping Redis restore"
        return
    fi
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        # Stop Redis
        kubectl exec -it $REDIS_POD -n anchor -- redis-cli SHUTDOWN NOSAVE
        
        # Wait for Redis to stop
        sleep 5
        
        # Copy dump file to Redis pod
        kubectl cp $REDIS_DUMP anchor/$REDIS_POD:/data/dump.rdb
        
        # Restart Redis
        kubectl delete pod $REDIS_POD -n anchor
        
        # Wait for Redis to restart
        sleep 10
        
        log_info "Redis restore completed"
    else
        log_warn "Redis pod not found, skipping Redis restore"
    fi
}

# Restore Kubernetes resources
restore_kubernetes() {
    log_info "Restoring Kubernetes resources..."
    
    # Restore deployments
    DEPLOYMENT_FILE=$(ls -1 kubernetes_deployments_*.yaml 2>/dev/null | head -1)
    if [ -n "$DEPLOYMENT_FILE" ]; then
        kubectl apply -f $DEPLOYMENT_FILE
        log_info "Deployments restored"
    fi
    
    # Restore services
    SERVICE_FILE=$(ls -1 kubernetes_services_*.yaml 2>/dev/null | head -1)
    if [ -n "$SERVICE_FILE" ]; then
        kubectl apply -f $SERVICE_FILE
        log_info "Services restored"
    fi
    
    # Restore ingress
    INGRESS_FILE=$(ls -1 kubernetes_ingress_*.yaml 2>/dev/null | head -1)
    if [ -n "$INGRESS_FILE" ]; then
        kubectl apply -f $INGRESS_FILE
        log_info "Ingress restored"
    fi
    
    # Restore secrets
    SECRET_FILE=$(ls -1 kubernetes_secrets_*.yaml 2>/dev/null | head -1)
    if [ -n "$SECRET_FILE" ]; then
        kubectl apply -f $SECRET_FILE
        log_info "Secrets restored"
    fi
    
    # Restore configmaps
    CONFIGMAP_FILE=$(ls -1 kubernetes_configmaps_*.yaml 2>/dev/null | head -1)
    if [ -n "$CONFIGMAP_FILE" ]; then
        kubectl apply -f $CONFIGMAP_FILE
        log_info "ConfigMaps restored"
    fi
    
    log_info "Kubernetes resources restore completed"
}

# Restore application data
restore_application_data() {
    log_info "Restoring application data..."
    
    # Find application data directory
    APP_DATA_DIR=$(ls -d application_data_* 2>/dev/null | head -1)
    
    if [ -n "$APP_DATA_DIR" ]; then
        # Get API pod
        API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
        
        if [ -n "$API_POD" ]; then
            # Copy application data to pod
            kubectl cp $APP_DATA_DIR anchor/$API_POD:/app/data
            
            log_info "Application data restore completed"
        else
            log_warn "API pod not found, skipping application data restore"
        fi
    else
        log_warn "No application data directory found"
    fi
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    
    # Restart API
    kubectl rollout restart deployment/anchor-api -n anchor
    
    # Restart AI
    kubectl rollout restart deployment/anchor-ai -n anchor
    
    # Restart Web
    kubectl rollout restart deployment/anchor-web -n anchor
    
    # Wait for rollouts
    kubectl rollout status deployment/anchor-api -n anchor --timeout=300s
    kubectl rollout status deployment/anchor-ai -n anchor --timeout=300s
    kubectl rollout status deployment/anchor-web -n anchor --timeout=300s
    
    log_info "Services restarted"
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    # Check API health
    API_ENDPOINT=$(kubectl get ingress anchor-ingress -n anchor -o jsonpath='{.spec.rules[?(@.host=="api.anchor.app")].host}')
    
    if curl -f "https://${API_ENDPOINT}/health" > /dev/null 2>&1; then
        log_info "✅ API health check passed"
    else
        log_error "❌ API health check failed"
        exit 1
    fi
    
    # Check database connection
    DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$DB_POD" ]; then
        if kubectl exec -it $DB_POD -n anchor -- psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
            log_info "✅ Database connection check passed"
        else
            log_error "❌ Database connection check failed"
            exit 1
        fi
    fi
    
    log_info "✅ Restore verification completed"
}

# Cleanup
cleanup() {
    log_info "Cleaning up restore files..."
    
    cd /
    rm -rf /tmp/anchor-restore
    
    log_info "Cleanup completed"
}

# Main restore function
main() {
    log_info "Starting restore for ${ENVIRONMENT} from ${BACKUP_DATE}..."
    
    download_backup
    restore_database
    restore_redis
    restore_kubernetes
    restore_application_data
    restart_services
    verify_restore
    cleanup
    
    log_info "✅ Restore completed successfully!"
}

# Run main function
main
