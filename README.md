# ⚡ Flash Sale System - High Concurrency Demo

> A real-time demonstration of race conditions and solutions in high-concurrency e-commerce scenarios.

![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=nextdotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)

---

## 🎯 What This Project Demonstrates

When **2000 users** try to buy **100 items** simultaneously, what happens?

| Strategy | Result | Why? |
|----------|--------|------|
| **No Lock** | ❌ Overselling | Race condition - multiple reads before writes |
| **DB Lock** | ✅ Safe | PostgreSQL `FOR UPDATE` locks the row |
| **Redis Lock** | ✅ Safe + Fast | Redis Lua scripts are atomic |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│                   http://localhost:3000                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  No Lock    │  │  DB Lock    │  │ Redis Lock  │             │
│  │   Button    │  │   Button    │  │   Button    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Go + Gin)                          │
│                    http://localhost:8080                        │
│                                                                 │
│  POST /purchase/naive     → No protection (race condition!)    │
│  POST /purchase/postgres  → SELECT ... FOR UPDATE              │
│  POST /purchase/redis     → Redis Lua Script + PostgreSQL      │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌──────────────────┐              ┌──────────────────┐
│    PostgreSQL    │◄────────────►│      Redis       │
│   Port: 5432     │              │   Port: 6379     │
│   (Persistence)  │              │   (Speed Layer)  │
└──────────────────┘              └──────────────────┘
```

---

## 🧠 How Each Strategy Works

### 1. No Lock (Naive) - ❌ CAUSES OVERSELLING

```go
// BAD CODE - Race Condition!
stock := db.Query("SELECT quantity FROM products WHERE id=1")
if stock > 0 {
    // ⚠️ Another request can read the same stock value here!
    db.Exec("UPDATE products SET quantity = quantity - 1")
}
```

**Problem:** Multiple goroutines read `stock = 5`, all see it's available, all decrement. Result: 5 sales but stock only drops by 1-2.

---

### 2. DB Lock (PostgreSQL FOR UPDATE) - ✅ SAFE

```go
tx.Begin()
// 🔒 This LOCKS the row until COMMIT
tx.Query("SELECT * FROM products WHERE id=1 FOR UPDATE")
tx.Exec("UPDATE products SET quantity = quantity - 1")
tx.Commit() // 🔓 Release lock
```

**How it works:** `FOR UPDATE` makes other transactions WAIT until the lock is released. Safe but slower.

---

### 3. Redis Lock (Lua Script) - ✅ SAFE + FAST

```lua
-- This entire script runs ATOMICALLY in Redis
local stock = redis.call("GET", "product:1:stock")
if tonumber(stock) > 0 then
    return redis.call("DECR", "product:1:stock")
end
return -1
```

**How it works:** Redis is single-threaded. Lua scripts execute without interruption. No race condition possible!

---

## 📋 Prerequisites

Before running this project, make sure you have:

- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Go 1.21+** - [Download](https://go.dev/dl/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

---

## 🚀 Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/flash-sale-system.git
cd flash-sale-system
```

### Step 2: Start PostgreSQL & Redis (Docker)

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`

Verify containers are running:
```bash
docker ps
```

### Step 3: Start the Go Backend

```bash
cd backend
go mod download
go run ./cmd/api
```

You should see:
```
🚀 Starting Flash Sale Backend...
✅ Connected to PostgreSQL!
✅ Connected to Redis!
🎯 Server running on http://localhost:8080
```

### Step 4: Start the Next.js Frontend

Open a **new terminal**:

```bash
cd frontend/dashboard
npm install
npm run dev
```

### Step 5: Open the Dashboard

Visit: **http://localhost:3000**

---

## 🎮 How to Demo

1. **Select "No Lock"** strategy
2. Set **Requests: 1000**, **Concurrency: 100**
3. Click **"Launch Attack"**
4. 😱 See the **"X Oversold"** badge appear!
5. Click **"Reset"**
6. **Select "Redis Lock"**
7. Click **"Launch Attack"** again
8. ✅ See **"Safe"** - no overselling!

---

## 📁 Project Structure

```
flash-sale-system/
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       └── main.go          # Entry point, routes
│   ├── internal/
│   │   ├── database/
│   │   │   ├── db.go            # PostgreSQL connection
│   │   │   ├── redis.go         # Redis connection
│   │   │   ├── migrations.go    # Create tables
│   │   │   └── seed.go          # Insert initial data
│   │   └── handlers/
│   │       └── purchase.go      # 3 purchase strategies
│   ├── go.mod
│   └── go.sum
│
├── frontend/
│   └── dashboard/
│       ├── app/
│       │   └── page.tsx         # Main dashboard UI
│       ├── package.json
│       └── next.config.js
│
├── docker-compose.yml           # PostgreSQL + Redis
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/products` | List all products |
| `GET` | `/stats` | Live statistics (stock, orders, latency) |
| `GET` | `/orders` | View recent orders |
| `POST` | `/purchase/naive` | Buy with NO lock (race condition) |
| `POST` | `/purchase/postgres` | Buy with DB lock (FOR UPDATE) |
| `POST` | `/purchase/redis` | Buy with Redis lock (Lua script) |
| `POST` | `/reset` | Reset stock to 100, clear orders |
| `POST` | `/sync-redis` | Sync Redis stock with PostgreSQL |

### Example API Call

```bash
curl -X POST http://localhost:8080/purchase/redis \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "product_id": 1}'
```

---

## ⚙️ Configuration

### Environment Variables (backend/.env)

```env
DATABASE_URL=postgres://yaswanth:password123@localhost:5432/flashsale_db
REDIS_URL=localhost:6379
```

### Docker Compose (docker-compose.yml)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: yaswanth
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: flashsale_db
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## 🧪 Running Tests

```bash
cd backend
go test ./...
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React, Framer Motion, Tailwind CSS |
| **Backend** | Go 1.21, Gin Framework |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Containerization** | Docker, Docker Compose |

---

## 📊 Performance Comparison

| Strategy | Throughput | Latency | Safe? |
|----------|------------|---------|-------|
| No Lock | ~2000 req/s | ~30ms | ❌ No |
| DB Lock | ~1900 req/s | ~35ms | ✅ Yes |
| Redis Lock | ~2500 req/s | ~25ms | ✅ Yes |

*Results may vary based on hardware*

---

## 🐛 Troubleshooting

### "Connection refused" to PostgreSQL/Redis
```bash
# Make sure Docker containers are running
docker-compose up -d
docker ps
```

### "Port 8080 already in use"
```bash
# Find and kill the process
lsof -i :8080
kill -9 <PID>
```

### "Port 3000 already in use"
```bash
# Find and kill the process
lsof -i :3000
kill -9 <PID>
```

### Reset everything
```bash
docker-compose down -v  # Remove containers and volumes
docker-compose up -d    # Start fresh
```

---

## 🎓 Learning Resources

- [PostgreSQL FOR UPDATE Docs](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [Redis Lua Scripting](https://redis.io/docs/interact/programmability/eval-intro/)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Yaswanth**

- GitHub: [@yaswanth](https://github.com/yaswanth756)

---

<p align="center">
  Made with ❤️ to demonstrate high-concurrency patterns
</p>
