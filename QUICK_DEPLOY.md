# 🚀 Quick Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Kubernetes cluster (for production)

## Step-by-Step Deployment

### 1. Install Dependencies
```bash
cd backend-nest
npm install
```

### 2. Setup Environment
```bash
cp .env.scalability .env
# Edit .env with your actual values
```

### 3. Run Database Migration
```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start Redis (if not running)
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or use existing Redis cluster
```

### 5. Build Application
```bash
npm run build
```

### 6. Start Application
```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

### 7. Verify Deployment
```bash
# Health check
curl http://localhost:3001/api/health

# Check queue status
curl http://localhost:3001/api/admin/queues/stats

# Check cache stats
curl http://localhost:3001/api/admin/cache/stats
```

### 8. Run Load Tests (Optional)
```bash
cd scripts
npm install autocannon axios ws
node load-test.js --scenario=all
```

## Production Deployment (Kubernetes)

### 1. Apply Kubernetes Configurations
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### 2. Monitor Scaling
```bash
# Watch HPA
kubectl get hpa -n presentation-designer --watch

# Check pods
kubectl get pods -n presentation-designer

# View logs
kubectl logs -f deployment/backend -n presentation-designer
```

## Environment Variables Reference

Key variables for scalability:
```bash
# Concurrency
AI_GENERATION_CONCURRENCY=15
THINKING_QUEUE_CONCURRENCY=8
IMAGE_GENERATION_CONCURRENCY=5

# Database
DB_POOL_MIN=20
DB_POOL_MAX=200

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# WebSocket
WS_MAX_CONNECTIONS=20000
```

## Monitoring

Dashboard URLs (update with your domains):
- Application: https://your-domain.com
- Metrics: https://your-domain.com/metrics
- Health: https://your-domain.com/api/health

## Troubleshooting

See [SCALABILITY_IMPROVEMENTS.md](./SCALABILITY_IMPROVEMENTS.md) for detailed troubleshooting guide.

## Support

For issues, check:
1. Application logs: `kubectl logs -f <pod-name>`
2. Redis logs: `redis-cli MONITOR`
3. Database logs: Check PostgreSQL logs
4. Queue status: Check BullBoard dashboard

---
**Last Updated:** February 15, 2026
