# Anchor Troubleshooting Guide

## Common Issues

### 1. Installation Issues

#### Node.js Version Mismatch

**Error:**
```
Error: Node.js version mismatch. Required: 18+
```

**Solution:**
```bash
# Check Node.js version
node --version

# Update Node.js (using nvm)
nvm install 18
nvm use 18

# Or using n
n 18
```

#### npm Installation Failures

**Error:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Use legacy peer deps
npm install --legacy-peer-deps

# Or use yarn
yarn install
```

#### Python Dependencies Issues

**Error:**
```
ERROR: Could not find a version that satisfies the requirement
```

**Solution:**
```bash
# Update pip
pip install --upgrade pip

# Install dependencies with specific version
pip install -r requirements.txt --user

# Or use virtual environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Database Connection Issues

#### Cannot Connect to PostgreSQL

**Error:**
```
Connection refused: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Test connection
psql -h localhost -U postgres -d anchor
```

#### Database Connection Pool Exhausted

**Error:**
```
Error: Too many connection clients already
```

**Solution:**
```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND pid <> pg_backend_pid();

# Increase connection pool size in Prisma
# In prisma/schema.prisma:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_URL")
}
```

#### Database Migration Failures

**Error:**
```
Error: Migration failed
```

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name migration_name

# Apply pending migrations
npx prisma migrate deploy
```

### 3. Redis Connection Issues

#### Cannot Connect to Redis

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
sudo systemctl start redis

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Test connection
redis-cli -h localhost -p 6379
```

#### Redis Memory Issues

**Error:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solution:**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Flush Redis cache
redis-cli FLUSHALL

# Update Redis maxmemory in config
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 4. API Issues

#### API Server Won't Start

**Error:**
```
Error: Port 3000 already in use
```

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

#### API Authentication Errors

**Error:**
```
Error: Invalid or expired token
```

**Solution:**
```bash
# Check JWT secret in .env
JWT_SECRET=your-secret-key

# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env file
JWT_SECRET=<new-secret>
```

#### API Rate Limiting

**Error:**
```
Error: Too many requests
```

**Solution:**
```bash
# Check rate limit configuration
# In app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000, // 1 minute
  limit: 100, // 100 requests
}])

# Disable rate limiting for development
# In main.ts
app.useGlobalGuards(new ThrottlerGuard());
```

### 5. WhatsApp Integration Issues

#### WhatsApp Webhook Not Working

**Error:**
```
Webhook verification failed
```

**Solution:**
```bash
# Check WhatsApp Business configuration
WHATSAPP_BUSINESS_TOKEN=your-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=your-verify-token

# Test webhook endpoint
curl "https://api.anchor.app/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE"

# Check webhook logs
kubectl logs deployment/anchor-api -n anchor | grep whatsapp
```

#### WhatsApp Message Delivery Fails

**Error:**
```
Error: Message delivery failed
```

**Solution:**
```bash
# Check WhatsApp Business API limits
# Daily messaging limits:
# - 1000 messages/day for new accounts
# - 10,000 messages/day for established accounts

# Check message template
curl -X POST "https://graph.facebook.com/v18.0/PHONE_ID/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "PHONE_NUMBER",
    "type": "text",
    "text": {
      "body": "Hello World"
    }
  }'
```

### 6. Telegram Integration Issues

#### Telegram Bot Not Responding

**Error:**
```
Bot is not responding
```

**Solution:**
```bash
# Check Telegram bot token
TELEGRAM_BOT_TOKEN=your-bot-token

# Test bot connection
curl "https://api.telegram.org/botYOUR_TOKEN/getMe"

# Set webhook
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://api.anchor.app/channels/telegram/webhook"

# Check webhook status
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"
```

### 7. Calendar Integration Issues

#### Google Calendar Sync Fails

**Error:**
```
Calendar sync failed
```

**Solution:**
```bash
# Check Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Test OAuth flow
curl "https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=openid%20email%20profile"

# Check calendar API permissions
# Enable Calendar API in Google Cloud Console
```

#### Outlook Calendar Sync Fails

**Error:**
```
Calendar sync failed
```

**Solution:**
```bash
# Check Outlook OAuth credentials
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-client-secret
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/auth/outlook/callback

# Test OAuth flow
curl "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=openid%20email%20profile"
```

### 8. Docker Issues

#### Docker Build Fails

**Error:**
```
Error: failed to solve with frontend dockerfile.v0
```

**Solution:**
```bash
# Clear Docker cache
docker builder prune -a

# Build with no cache
docker build --no-cache -t anchor/api .

# Check Dockerfile syntax
dockerfilelint Dockerfile
```

#### Docker Container Won't Start

**Error:**
```
Error: Container failed to start
```

**Solution:**
```bash
# Check container logs
docker logs <container-id>

# Check container status
docker ps -a

# Restart container
docker restart <container-id>

# Check resource limits
docker stats
```

### 9. Kubernetes Issues

#### Pod Stuck in Pending

**Error:**
```
Pod is in Pending state
```

**Solution:**
```bash
# Check pod events
kubectl describe pod <pod-name> -n anchor

# Check node resources
kubectl top nodes

# Check resource requests
kubectl get pod <pod-name> -n anchor -o yaml | grep -A 5 resources

# Scale up nodes
kubectl scale nodegroup --replicas=3
```

#### Pod CrashLoopBackOff

**Error:**
```
Pod is in CrashLoopBackOff state
```

**Solution:**
```bash
# Check pod logs
kubectl logs <pod-name> -n anchor --previous

# Check pod events
kubectl describe pod <pod-name> -n anchor

# Check resource limits
kubectl get pod <pod-name> -n anchor -o yaml | grep -A 5 resources

# Restart pod
kubectl delete pod <pod-name> -n anchor
```

#### Service Not Responding

**Error:**
```
Service is not responding
```

**Solution:**
```bash
# Check service endpoints
kubectl get endpoints <service-name> -n anchor

# Check service selector
kubectl describe service <service-name> -n anchor

# Test service directly
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl <service-name>:80/health

# Check ingress
kubectl describe ingress <ingress-name> -n anchor
```

### 10. Performance Issues

#### High CPU Usage

**Error:**
```
High CPU usage detected
```

**Solution:**
```bash
# Check pod resource usage
kubectl top pods -n anchor

# Check node resource usage
kubectl top nodes

# Scale up deployment
kubectl scale deployment anchor-api --replicas=5 -n anchor

# Optimize code
# - Use connection pooling
# - Implement caching
# - Optimize database queries
```

#### High Memory Usage

**Error:**
```
High memory usage detected
```

**Solution:**
```bash
# Check pod memory usage
kubectl top pods -n anchor

# Check for memory leaks
kubectl logs <pod-name> -n anchor | grep -i "memory"

# Increase memory limits
# In deployment.yml
resources:
  limits:
    memory: "1Gi"

# Restart pod
kubectl delete pod <pod-name> -n anchor
```

#### High Latency

**Error:**
```
High latency detected
```

**Solution:**
```bash
# Check API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.anchor.app/health

# Check database query performance
kubectl exec -it <db-pod> -n anchor -- psql -U postgres -c "EXPLAIN ANALYZE SELECT * FROM users LIMIT 10"

# Check Redis performance
kubectl exec -it <redis-pod> -n anchor -- redis-cli INFO stats

# Optimize code
# - Add database indexes
# - Implement caching
# - Use connection pooling
```

## Debugging Tools

### API Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run start:dev

# Check API logs
kubectl logs deployment/anchor-api -n anchor -f

# Check API metrics
curl http://localhost:3000/metrics
```

### Database Debugging

```bash
# Connect to database
psql -h localhost -U postgres -d anchor

# Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Check database size
SELECT pg_size_pretty(pg_database_size('anchor'));

# Check table sizes
SELECT 
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Redis Debugging

```bash
# Connect to Redis
redis-cli

# Check Redis info
INFO

# Check memory usage
INFO memory

# Check connected clients
INFO clients

# Monitor commands
MONITOR
```

### Network Debugging

```bash
# Test API endpoint
curl -v https://api.anchor.app/health

# Test database connection
telnet localhost 5432

# Test Redis connection
telnet localhost 6379

# Check DNS resolution
nslookup api.anchor.app

# Check SSL certificate
openssl s_client -connect api.anchor.app:443
```

## Log Analysis

### API Logs

```bash
# Check API logs
kubectl logs deployment/anchor-api -n anchor -f

# Filter by error level
kubectl logs deployment/anchor-api -n anchor | grep -i "error"

# Check specific time range
kubectl logs deployment/anchor-api -n anchor --since=1h
```

### Database Logs

```bash
# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Check slow queries
sudo grep "duration:" /var/log/postgresql/postgresql-16-main.log | tail -20

# Check connection attempts
sudo grep "connection authorized" /var/log/postgresql/postgresql-16-main.log
```

### Redis Logs

```bash
# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Check slow queries
redis-cli SLOWLOG GET 10

# Check memory warnings
sudo grep -i "memory" /var/log/redis/redis-server.log
```

## Getting Help

### Documentation

- [README.md](../README.md) - Project overview
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment guide
- [SECURITY.md](../SECURITY.md) - Security documentation

### Community

- **GitHub Issues**: Report bugs and feature requests
- **Discord**: Join our community
- **Email**: support@anchor.app

### Professional Support

- **Email**: support@anchor.app
- **Slack**: #anchor-support
- **Phone**: +1 (555) 123-4567

---

*Last updated: August 2026*
