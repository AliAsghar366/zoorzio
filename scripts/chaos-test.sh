#!/bin/bash

# Anchor Chaos Testing Script
# This script performs chaos testing on the application

set -e

echo "🌪️ Anchor Chaos Testing Script"

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}
CHAOS_TYPE=${3:-pod-failure}

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info > /dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Test pod failure
test_pod_failure() {
    log_header "Pod Failure Test"
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$API_POD" ]; then
        log_info "Simulating pod failure for $API_POD..."
        
        # Delete the pod
        kubectl delete pod $API_POD -n anchor
        
        # Wait for pod to restart
        log_info "Waiting for pod to restart..."
        sleep 30
        
        # Check if pod is running
        NEW_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
        if [ -n "$NEW_POD" ]; then
            log_info "✅ Pod restarted successfully: $NEW_POD"
        else
            log_error "❌ Pod failed to restart"
        fi
    else
        log_warn "No API pod found"
    fi
}

# Test network partition
test_network_partition() {
    log_header "Network Partition Test"
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$API_POD" ]; then
        log_info "Simulating network partition for $API_POD..."
        
        # Create network partition using NetworkPolicy
        cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: network-partition
  namespace: anchor
spec:
  podSelector:
    matchLabels:
      app: anchor-api
  policyTypes:
  - Ingress
  - Egress
  ingress: []
  egress: []
EOF
        
        # Wait for partition to take effect
        sleep 10
        
        # Check if pod is isolated
        log_info "Network partition created"
        
        # Remove partition
        kubectl delete networkpolicy network-partition -n anchor
        
        log_info "Network partition removed"
    else
        log_warn "No API pod found"
    fi
}

# Test resource exhaustion
test_resource_exhaustion() {
    log_header "Resource Exhaustion Test"
    
    # Get API pod
    API_POD=$(kubectl get pods -n anchor -l app=anchor-api -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$API_POD" ]; then
        log_info "Simulating resource exhaustion for $API_POD..."
        
        # Create a resource-hungry pod
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: resource-hungry
  namespace: anchor
spec:
  containers:
  - name: stress
    image: progrium/stress
    args:
    - --vm
    - "2"
    - --vm-bytes
    - "256M"
    - --timeout
    - "60s"
    resources:
      requests:
        memory: "512Mi"
        cpu: "500m"
      limits:
        memory: "1Gi"
        cpu: "1000m"
EOF
        
        # Wait for resource exhaustion
        sleep 30
        
        # Check if API pod is affected
        log_info "Checking API pod status..."
        kubectl get pods -n anchor -l app=anchor-api
        
        # Clean up
        kubectl delete pod resource-hungry -n anchor
        
        log_info "Resource exhaustion test completed"
    else
        log_warn "No API pod found"
    fi
}

# Test database failure
test_database_failure() {
    log_header "Database Failure Test"
    
    # Get database pod
    DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$DB_POD" ]; then
        log_info "Simulating database failure for $DB_POD..."
        
        # Delete the database pod
        kubectl delete pod $DB_POD -n anchor
        
        # Wait for pod to restart
        log_info "Waiting for database pod to restart..."
        sleep 60
        
        # Check if pod is running
        NEW_DB_POD=$(kubectl get pods -n anchor -l app=postgres -o jsonpath='{.items[0].metadata.name}')
        if [ -n "$NEW_DB_POD" ]; then
            log_info "✅ Database pod restarted successfully: $NEW_DB_POD"
        else
            log_error "❌ Database pod failed to restart"
        fi
    else
        log_warn "No database pod found"
    fi
}

# Test Redis failure
test_redis_failure() {
    log_header "Redis Failure Test"
    
    # Get Redis pod
    REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$REDIS_POD" ]; then
        log_info "Simulating Redis failure for $REDIS_POD..."
        
        # Delete the Redis pod
        kubectl delete pod $REDIS_POD -n anchor
        
        # Wait for pod to restart
        log_info "Waiting for Redis pod to restart..."
        sleep 30
        
        # Check if pod is running
        NEW_REDIS_POD=$(kubectl get pods -n anchor -l app=redis -o jsonpath='{.items[0].metadata.name}')
        if [ -n "$NEW_REDIS_POD" ]; then
            log_info "✅ Redis pod restarted successfully: $NEW_REDIS_POD"
        else
            log_error "❌ Redis pod failed to restart"
        fi
    else
        log_warn "No Redis pod found"
    fi
}

# Test API endpoint under chaos
test_api_under_chaos() {
    log_header "API Endpoint Under Chaos"
    
    # Get API endpoint
    API_ENDPOINT=$(kubectl get ingress anchor-ingress -n anchor -o jsonpath='{.spec.rules[?(@.host=="api.anchor.app")].host}')
    
    if [ -n "$API_ENDPOINT" ]; then
        log_info "Testing API endpoint under chaos..."
        
        # Test health endpoint
        for i in {1..10}; do
            curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "https://${API_ENDPOINT}/health"
            sleep 1
        done
    else
        log_warn "API endpoint not found"
    fi
}

# Monitor during chaos test
monitor_during_test() {
    log_info "Monitoring during chaos test..."
    
    # Monitor pod status
    kubectl get pods -n anchor -w
    
    # Monitor events
    kubectl get events -n anchor --sort-by='.lastTimestamp'
    
    # Monitor logs
    kubectl logs deployment/anchor-api -n anchor --tail=50
}

# Clean up chaos test
cleanup_chaos() {
    log_info "Cleaning up chaos test..."
    
    # Delete any test pods
    kubectl delete pod resource-hungry -n anchor 2>/dev/null || true
    
    # Delete any test network policies
    kubectl delete networkpolicy network-partition -n anchor 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Generate chaos test report
generate_report() {
  log_header "Chaos Test Report"
  
  echo "Environment: ${ENVIRONMENT}"
  echo "Region: ${AWS_REGION}"
  echo "Chaos Type: ${CHAOS_TYPE}"
  echo "Timestamp: $(date)"
  echo ""
  
  check_prerequisites
  
  case $CHAOS_TYPE in
    pod-failure)
      test_pod_failure
      ;;
    network-partition)
      test_network_partition
      ;;
    resource-exhaustion)
      test_resource_exhaustion
      ;;
    database-failure)
      test_database_failure
      ;;
    redis-failure)
      test_redis_failure
      ;;
    all)
      test_pod_failure
      test_network_partition
      test_resource_exhaustion
      test_database_failure
      test_redis_failure
      ;;
    *)
      log_error "Unknown chaos type: $CHAOS_TYPE"
      echo "Chaos types: pod-failure, network-partition, resource-exhaustion, database-failure, redis-failure, all"
      exit 1
      ;;
  esac
  
  test_api_under_chaos
  monitor_during_test
  cleanup_chaos
  
  log_info "✅ Chaos test completed"
}

# Main function
main() {
  log_info "Starting chaos tests for ${ENVIRONMENT}..."
  
  generate_report
}

# Run main function
main
