# Anchor Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying Anchor to various environments.

## Prerequisites

### Required Tools
- Docker 24.0+
- Kubernetes 1.28+
- Terraform 1.6+
- AWS CLI 2.15+
- kubectl 1.28+
- Node.js 18+
- Python 3.11+

### AWS Account Setup
1. Create AWS account
2. Configure AWS CLI: `aws configure`
3. Create IAM user with appropriate permissions
4. Enable required AWS services

## Development Deployment

### Local Development

```bash
# Clone repository
git clone https://github.com/anchor/memory.git
cd memory

# Install dependencies
make install

# Start development servers
make dev

# Access applications
# API: http://localhost:3000
# Web: http://localhost:3001
# AI: http://localhost:8000
# API Docs: http://localhost:3000/api/docs
```

### Docker Development

```bash
# Start Docker services
make docker-up

# Access applications
# API: http://localhost:3000
# Web: http://localhost:3001
# AI: http://localhost:8000
```

## Staging Deployment

### 1. Infrastructure Setup

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var="environment=staging"

# Apply infrastructure
terraform apply -var="environment=staging"
```

### 2. Configure Kubernetes

```bash
# Update kubeconfig
aws eks update-kubeconfig --name anchor-staging --region us-east-1

# Apply Kubernetes manifests
kubectl apply -f infrastructure/kubernetes/namespace.yml
kubectl apply -f infrastructure/kubernetes/deployment.yml
kubectl apply -f infrastructure/kubernetes/ingress.yml
```

### 3. Deploy Application

```bash
# Deploy to staging
./scripts/deploy.sh staging us-east-1
```

### 4. Verify Deployment

```bash
# Check deployment status
kubectl get pods -n anchor

# Check services
kubectl get services -n anchor

# Check ingress
kubectl get ingress -n anchor

# Test API
curl -f https://api-staging.anchor.app/health
```

## Production Deployment

### 1. Infrastructure Provisioning

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var="environment=production"

# Apply infrastructure
terraform apply -var="environment=production"
```

### 2. Configure Kubernetes Cluster

```bash
# Update kubeconfig
aws eks update-kubeconfig --name anchor-production --region us-east-1

# Apply namespace and secrets
kubectl apply -f infrastructure/kubernetes/namespace.yml

# Apply network policies
kubectl apply -f infrastructure/kubernetes/namespace.yml

# Apply deployments
kubectl apply -f infrastructure/kubernetes/deployment.yml

# Apply ingress
kubectl apply -f infrastructure/kubernetes/ingress.yml
```

### 3. Configure Secrets

```bash
# Create secrets
kubectl create secret generic anchor-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=jwt-refresh-secret="..." \
  --from-literal=encryption-key="..." \
  -n anchor
```

### 4. Deploy Application

```bash
# Deploy to production
./scripts/deploy.sh production us-east-1
```

### 5. Run Database Migrations

```bash
# Run migrations
./scripts/migrate.sh production migrate

# Seed database (optional)
./scripts/seed.sh production
```

### 6. Verify Deployment

```bash
# Check deployment status
kubectl get pods -n anchor

# Check services
kubectl get services -n anchor

# Check ingress
kubectl get ingress -n anchor

# Test API
curl -f https://api.anchor.app/health

# Test detailed health
curl -f https://api.anchor.app/health/detailed
```

## Configuration Management

### Environment Variables

#### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Encryption
ENCRYPTION_KEY=your-encryption-key

# AI Services
OPENAI_API_KEY=your-openai-key

# WhatsApp
WHATSAPP_BUSINESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=your-verify-token

# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-token

# Email
SENDGRID_API_KEY=your-sendgrid-key

# Google Calendar
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Outlook Calendar
OUTLOOK_CLIENT_ID=your-outlook-client-id
OUTLOOK_CLIENT_SECRET=your-outlook-client-secret

# AWS
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

#### Optional Variables

```env
# Application
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://anchor.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Monitoring
DATADOG_API_KEY=your-datadog-key
SENTRY_DSN=your-sentry-dsn
```

### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: anchor-secrets
  namespace: anchor
type: Opaque
stringData:
  database-url: "postgresql://..."
  redis-url: "redis://..."
  jwt-secret: "..."
  jwt-refresh-secret: "..."
  encryption-key: "..."
```

### Kubernetes ConfigMaps

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: anchor-config
  namespace: anchor
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://anchor.app"
```

## Monitoring & Observability

### Prometheus Configuration

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: anchor-api
  namespace: anchor
spec:
  selector:
    matchLabels:
      app: anchor-api
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Anchor API Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: anchor-alerts
  namespace: anchor
spec:
  groups:
  - name: anchor
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
    - alert: HighLatency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High latency detected"
```

## Scaling

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: anchor-api-hpa
  namespace: anchor
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: anchor-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Pod Autoscaling

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: anchor-api-vpa
  namespace: anchor
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: anchor-api
  updatePolicy:
    updateMode: "Auto"
```

## Backup & Recovery

### Database Backup

```bash
# Create backup
./scripts/backup.sh production

# List backups
aws s3 ls s3://anchor-backups-production/backups/ --recursive

# Restore backup
./scripts/restore.sh production 2026-08-25
```

### Redis Backup

```bash
# Trigger Redis backup
kubectl exec -it <redis-pod> -n anchor -- redis-cli BGSAVE

# Copy backup file
kubectl cp anchor/<redis-pod>:/data/dump.rdb ./redis-backup.rdb
```

### Kubernetes Resource Backup

```bash
# Backup all resources
kubectl get all -n anchor -o yaml > backup.yml

# Backup specific resources
kubectl get deployments -n anchor -o yaml > deployments.yml
kubectl get services -n anchor -o yaml > services.yml
kubectl get ingress -n anchor -o yaml > ingress.yml
```

## Security Hardening

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: anchor-network-policy
  namespace: anchor
spec:
  podSelector:
    matchLabels:
      app: anchor-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: anchor
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379
```

### Pod Security Policies

```yaml
apiVersion: policy/v1
kind: PodSecurityPolicy
metadata:
  name: anchor-psp
  namespace: anchor
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
  - ALL
  volumes:
  - 'configMap'
  - 'emptyDir'
  - 'projected'
  - 'secret'
  - 'downwardAPI'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## Troubleshooting

### Common Issues

#### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n anchor

# Check logs
kubectl logs <pod-name> -n anchor

# Check events
kubectl get events -n anchor --sort-by='.lastTimestamp'
```

#### Service Not Responding

```bash
# Check service endpoints
kubectl get endpoints <service-name> -n anchor

# Check service selector
kubectl describe service <service-name> -n anchor

# Test service directly
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl <service-name>:80/health
```

#### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress <ingress-name> -n anchor

# Check ingress controller logs
kubectl logs -n ingress-nginx <controller-pod>

# Test ingress directly
curl -H "Host: api.anchor.app" http://<ingress-ip>/health
```

#### Database Connection Issues

```bash
# Check database pod
kubectl describe pod <db-pod> -n anchor

# Test database connection
kubectl exec -it <db-pod> -n anchor -- psql -U postgres -c "SELECT 1"

# Check database logs
kubectl logs <db-pod> -n anchor
```

#### Redis Connection Issues

```bash
# Check Redis pod
kubectl describe pod <redis-pod> -n anchor

# Test Redis connection
kubectl exec -it <redis-pod> -n anchor -- redis-cli ping

# Check Redis logs
kubectl logs <redis-pod> -n anchor
```

### Performance Issues

#### High CPU Usage

```bash
# Check pod resource usage
kubectl top pods -n anchor

# Check node resource usage
kubectl top nodes

# Scale up deployment
kubectl scale deployment anchor-api --replicas=5 -n anchor
```

#### High Memory Usage

```bash
# Check pod memory usage
kubectl top pods -n anchor

# Check for memory leaks
kubectl logs <pod-name> -n anchor | grep -i "memory"

# Restart pod if necessary
kubectl delete pod <pod-name> -n anchor
```

#### High Latency

```bash
# Check API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.anchor.app/health

# Check database query performance
kubectl exec -it <db-pod> -n anchor -- psql -U postgres -c "EXPLAIN ANALYZE SELECT * FROM users LIMIT 10"

# Check Redis performance
kubectl exec -it <redis-pod> -n anchor -- redis-cli INFO stats
```

## Rollback Procedures

### Application Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/anchor-api -n anchor

# Rollback to specific revision
kubectl rollout undo deployment/anchor-api --to-revision=2 -n anchor

# Check rollout history
kubectl rollout history deployment/anchor-api -n anchor
```

### Infrastructure Rollback

```bash
cd infrastructure/terraform

# Plan rollback
terraform plan -var="environment=production" -target=module.db

# Apply rollback
terraform apply -var="environment=production" -target=module.db
```

## Support

For deployment issues:
- **Documentation**: See docs/
- **Issues**: GitHub Issues
- **Email**: devops@anchor.app
- **Slack**: #anchor-devops

---

*Last updated: August 2026*
