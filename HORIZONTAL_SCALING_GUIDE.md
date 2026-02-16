# Horizontal Scaling Guide (Without Kubernetes)

This guide covers how to scale the Presentation Generator application to handle high traffic without using Kubernetes.

## Architecture Overview

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (Nginx/HAProxy)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Server 1│        │ Server 2│        │ Server N│
    │  PM2    │        │  PM2    │        │  PM2    │
    │ Cluster │        │ Cluster │        │ Cluster │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
         ┌────▼────┐                  ┌────▼────┐
         │ Redis   │                  │PostgreSQL│
         │ Cluster │                  │  Primary │
         │ (Cache) │                  │  + Read  │
         └─────────┘                  │ Replicas │
                                      └──────────┘
```

## 1. PM2 Cluster Mode

### Installation

```bash
npm install -g pm2
```

### Configuration

Use the provided `ecosystem.config.js`:

```bash
# Start in cluster mode
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart with zero downtime
pm2 reload ecosystem.config.js
```

### Key Features

- **Auto-scaling**: Uses all CPU cores (`instances: 'max'`)
- **Zero-downtime restarts**: Rolling restarts during deployments
- **Memory limits**: Auto-restart when memory exceeds 1GB
- **Graceful shutdown**: 5-second timeout for cleanup

## 2. Load Balancer Configuration

### Nginx (Recommended)

```nginx
upstream presentation_backend {
    least_conn;
    server 10.0.1.10:3001 weight=5;
    server 10.0.1.11:3001 weight=5;
    server 10.0.1.12:3001 weight=5;
    
    # Health checks
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name api.presentation.app;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/presentation.crt;
    ssl_certificate_key /etc/ssl/private/presentation.key;

    # Proxy settings
    location / {
        proxy_pass http://presentation_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support for collaboration
    location /socket.io/ {
        proxy_pass http://presentation_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://presentation_backend;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

### HAProxy Alternative

```haproxy
global
    maxconn 50000
    log stdout format raw local0

defaults
    mode http
    timeout connect 10s
    timeout client 30s
    timeout server 30s
    option httplog
    option dontlognull

frontend http_front
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/presentation.pem
    redirect scheme https code 301 if !{ ssl_fc }
    default_backend api_servers

backend api_servers
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    
    server api1 10.0.1.10:3001 check inter 5s fall 3 rise 2
    server api2 10.0.1.11:3001 check inter 5s fall 3 rise 2
    server api3 10.0.1.12:3001 check inter 5s fall 3 rise 2
```

## 3. Database Scaling

### Connection Pooling

Configure in `.env`:

```env
# Connection pool per PM2 instance
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=10

# With 8 PM2 instances, this gives 80 connections
# Ensure PostgreSQL max_connections > total pool size
```

### PostgreSQL Tuning

```sql
-- /etc/postgresql/15/main/postgresql.conf

-- Connections (adjust based on total PM2 instances * pool size)
max_connections = 200
superuser_reserved_connections = 3

-- Memory (adjust based on available RAM)
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB

-- Write-ahead log
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB

-- Query planning
random_page_cost = 1.1  # For SSDs
effective_io_concurrency = 200

-- Parallel queries
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
```

### Read Replicas

For read-heavy workloads, use read replicas:

```typescript
// In service files, use read replica for SELECT queries
const users = await this.prisma.$queryRaw`SELECT * FROM users` // Uses primary
const users = await this.readReplica.$queryRaw`SELECT * FROM users` // Uses replica
```

## 4. Redis Scaling

### Cluster Mode

```env
REDIS_CLUSTER_MODE=true
REDIS_CLUSTER_NODES=10.0.2.10:6379,10.0.2.11:6379,10.0.2.12:6379
REDIS_PASSWORD=your-secure-password
```

### Single Instance with Sentinel

For simpler setups, use Redis Sentinel for failover:

```env
REDIS_SENTINEL_MODE=true
REDIS_SENTINEL_HOSTS=10.0.2.10:26379,10.0.2.11:26379,10.0.2.12:26379
REDIS_SENTINEL_MASTER=mymaster
```

## 5. Session Management

Sessions are stored in Redis for cross-instance access:

```typescript
// Sessions work across all PM2 instances
await redis.setSession(sessionId, userData, 86400);
const session = await redis.getSession(sessionId);
```

## 6. File Storage

Use S3-compatible storage for file uploads:

```env
AWS_S3_BUCKET=presentation-files
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Or use MinIO for self-hosted
S3_ENDPOINT=https://minio.internal:9000
```

## 7. Background Jobs with BullMQ

BullMQ uses Redis for distributed job processing:

```typescript
// Jobs are distributed across all worker instances
await exportQueue.add('pdf-export', { projectId, userId });
```

## 8. Monitoring

### PM2 Metrics

```bash
# Real-time monitoring
pm2 monit

# Export metrics for Prometheus
pm2 install pm2-prometheus-exporter
```

### Application Metrics

The app exposes metrics at `/metrics` for Prometheus:

- Request latency
- Error rates
- Active connections
- Database pool usage
- Redis connection status

## 9. Deployment Strategy

### Blue-Green Deployment

```bash
# Deploy to blue environment
pm2 start ecosystem.config.js --name blue --env production

# Test blue environment
curl http://localhost:3001/health

# Switch load balancer to blue
# Update nginx upstream to point to blue servers

# Gracefully stop green
pm2 delete green
```

### Rolling Deployment

```bash
# Update code
git pull origin main

# Build
npm run build

# Zero-downtime restart
pm2 reload ecosystem.config.js
```

## 10. Capacity Planning

| Users | API Servers | DB Connections | Redis Memory |
|-------|-------------|----------------|--------------|
| 1,000 | 1 (4 cores) | 40 | 512MB |
| 10,000 | 2 (8 cores) | 160 | 2GB |
| 50,000 | 4 (16 cores) | 320 | 8GB |
| 100,000 | 8 (32 cores) | 640 | 16GB |

## 11. Environment Variables

```env
# Application
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@db-primary:5432/presentation
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=10

# Redis
REDIS_URL=redis://redis-primary:6379
REDIS_PASSWORD=secure-password
REDIS_CLUSTER_MODE=false

# S3 Storage
AWS_S3_BUCKET=presentation-files
AWS_S3_REGION=us-east-1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRATION=7d
```

## Quick Start Commands

```bash
# Initial setup
npm ci --production
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# View status
pm2 status

# Logs
pm2 logs --lines 100

# Restart all
pm2 reload all

# Stop all
pm2 stop all
```
