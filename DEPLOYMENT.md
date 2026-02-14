# Production Deployment Guide

## Overview
This guide covers deploying the Presentation Designer application to production with CDN, rate limiting, security layers, error handling, logging, and infrastructure setup.

## Architecture

```
                                    ┌─────────────┐
                                    │   CDN       │
                                    │ (CloudFront)│
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │   Nginx     │
                                    │Load Balancer│
                                    └──────┬──────┘
                      ┌────────────────────┴────────────────────┐
                      │                                         │
              ┌───────▼────────┐                        ┌──────▼───────┐
              │   Frontend     │                        │   Backend    │
              │   (Next.js)    │◄──────────────────────►│   (NestJS)   │
              │   Pods (3-10)  │      API Calls         │   Pods (3-10)│
              └────────────────┘                        └──────┬───────┘
                                                               │
                                  ┌────────────────────────────┴───────┐
                                  │                                    │
                          ┌───────▼────────┐                  ┌────────▼─────┐
                          │   PostgreSQL   │                  │    Redis     │
                          │   (Primary +   │                  │   (Cluster)  │
                          │    Replica)    │                  └──────────────┘
                          └────────────────┘
```

## Prerequisites

- Docker & Docker Compose
- Kubernetes cluster (EKS, GKE, or AKS)
- kubectl configured
- Domain name with DNS access
- SSL certificates (Let's Encrypt)
- Container registry access (ghcr.io, ECR, GCR)

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.production.example .env.production

# Edit and fill in all required values
nano .env.production
```

### 2. Local Production Testing

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.production.yml up --build

# Access application
# Frontend: http://localhost
# Backend: http://localhost/api
# Health: http://localhost/health
```

### 3. Build Docker Images

```bash
# Backend
cd backend-nest
docker build -f Dockerfile.production -t your-registry/presentation-backend:latest .
docker push your-registry/presentation-backend:latest

# Frontend
cd frontend
docker build -f Dockerfile.production -t your-registry/presentation-frontend:latest .
docker push your-registry/presentation-frontend:latest
```

### 4. Deploy to Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl create secret generic app-secrets --from-env-file=.env.production -n presentation-designer
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Verify deployment
kubectl get pods -n presentation-designer
kubectl get services -n presentation-designer
kubectl get ingress -n presentation-designer
```

## Security Features

### 1. Rate Limiting

- **API endpoints**: 100 requests/minute per IP
- **Auth endpoints**: 5 requests/15 minutes per IP
- **OTP endpoints**: 3 requests/5 minutes per IP
- **General endpoints**: 300 requests/minute per IP

Custom rate limits can be applied per endpoint using decorators:

```typescript
@ThrottleStrict() // 10 req/min
@ThrottleModerate() // 30 req/min
@ThrottleRelaxed() // 100 req/min
```

### 2. Security Headers

All responses include:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`: HSTS enabled
- `Content-Security-Policy`: Configurable CSP
- `Referrer-Policy`: strict-origin-when-cross-origin

### 3. Request Sanitization

- XSS protection
- SQL injection prevention
- Prototype pollution prevention
- NoSQL injection prevention

### 4. CORS Configuration

Whitelist-based CORS with:
- Credentials support
- Preflight caching
- Origin validation

## CDN Configuration

### CloudFront Setup

1. Create CloudFront distribution
2. Configure origins:
   - Frontend: S3 bucket or origin domain
   - API: Backend ALB/origin
3. Set cache behaviors:
   - Static assets: Cache for 1 year
   - API calls: No caching
   - HTML: Cache with invalidation

### Next.js CDN Integration

```typescript
// next.config.ts
const nextConfig = {
  assetPrefix: process.env.NEXT_PUBLIC_CDN_URL,
  images: {
    domains: ['cdn.yourdomain.com'],
  },
};
```

## Logging & Monitoring

### Winston Logger

Structured logging with:
- Console output (development)
- File rotation (production)
- Daily archives
- Error tracking
- Performance metrics

Log levels:
- `error`: Application errors
- `warn`: Warning messages
- `info`: General information
- `debug`: Detailed debug info
- `verbose`: Very detailed logs

### Monitoring Endpoints

```bash
# Health check
GET /health

# Liveness probe
GET /health/liveness

# Readiness probe
GET /health/readiness
```

### Metrics

Monitor:
- Request rate
- Response times
- Error rates
- CPU/Memory usage
- Database connections
- Redis connections
- Cache hit rates

## Database Management

### Migrations

```bash
# Run migrations
cd backend-nest
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Backups

```bash
# Automated daily backups
kubectl create cronjob pg-backup \
  --image=postgres:16 \
  --schedule="0 2 * * *" \
  -- pg_dump -h postgres -U user db > backup.sql
```

## Scaling

### Horizontal Pod Autoscaling

Backend scales between 3-10 pods based on:
- CPU usage > 70%
- Memory usage > 80%

Frontend scales between 3-10 pods based on:
- CPU usage > 70%
- Memory usage > 80%

### Database Scaling

- Read replicas for queries
- Connection pooling
- Query optimization
- Indexes on frequently queried columns

## CI/CD Pipeline

GitHub Actions workflow:
1. **Test**: Run unit & e2e tests
2. **Build**: Create Docker images
3. **Push**: Push to container registry
4. **Deploy**: Apply Kubernetes manifests
5. **Verify**: Check deployment status

## Troubleshooting

### Check Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n presentation-designer

# Frontend logs
kubectl logs -f deployment/frontend -n presentation-designer

# Nginx logs
kubectl logs -f deployment/nginx -n presentation-designer
```

### Debug Pods

```bash
# Exec into pod
kubectl exec -it pod-name -n presentation-designer -- /bin/sh

# Describe pod
kubectl describe pod pod-name -n presentation-designer
```

### Common Issues

1. **Database connection failed**
   - Check DATABASE_URL
   - Verify PostgreSQL is running
   - Check network policies

2. **Redis connection failed**
   - Verify Redis password
   - Check Redis service
   - Review connection pooling

3. **High memory usage**
   - Increase pod limits
   - Check for memory leaks
   - Review query optimization

## Performance Optimization

### Caching Strategy

1. **Static assets**: CDN cache (1 year)
2. **API responses**: Redis cache (configurable TTL)
3. **Database queries**: Query result caching
4. **Email templates**: Pre-compiled templates

### Compression

- Gzip compression enabled
- Brotli compression (if available)
- Image optimization (WebP, AVIF)

### Database Optimization

- Indexes on frequently queried fields
- Connection pooling
- Query optimization
- Materialized views for analytics

## Security Checklist

- [ ] Environment variables secured
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting configured
- [ ] CORS whitelist updated
- [ ] Security headers enabled
- [ ] Request sanitization active
- [ ] Database credentials rotated
- [ ] API keys secured
- [ ] Secrets in Kubernetes/Vault
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] Regular security audits scheduled

## Monitoring Checklist

- [ ] Health checks configured
- [ ] Logging aggregation setup
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic/DataDog)
- [ ] Uptime monitoring (Pingdom)
- [ ] Alert notifications configured
- [ ] Dashboard created
- [ ] Metrics exported
- [ ] Log retention policy set
- [ ] Backup verification automated

## Support

For issues or questions:
- GitHub Issues: [repository-url]
- Documentation: [docs-url]
- Email: support@yourdomain.com
