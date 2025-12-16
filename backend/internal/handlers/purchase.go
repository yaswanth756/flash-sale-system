package handlers

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"flash-sale-backend/internal/database"

	"github.com/gin-gonic/gin"
)

type PurchaseRequest struct {
	UserID    int `json:"user_id"`
	ProductID int `json:"product_id"`
}

// Stats tracking for dashboard
var (
	TotalRequests  int64
	SuccessCount   int64
	FailCount      int64
	OversellCount  int64
	TotalLatencyMs int64
)

func ResetStats() {
	atomic.StoreInt64(&TotalRequests, 0)
	atomic.StoreInt64(&SuccessCount, 0)
	atomic.StoreInt64(&FailCount, 0)
	atomic.StoreInt64(&OversellCount, 0)
	atomic.StoreInt64(&TotalLatencyMs, 0)
}

func GetStats() map[string]interface{} {
	total := atomic.LoadInt64(&TotalRequests)
	success := atomic.LoadInt64(&SuccessCount)
	fail := atomic.LoadInt64(&FailCount)
	oversell := atomic.LoadInt64(&OversellCount)
	latency := atomic.LoadInt64(&TotalLatencyMs)

	avgLatency := float64(0)
	if total > 0 {
		avgLatency = float64(latency) / float64(total)
	}

	return map[string]interface{}{
		"total_requests": total,
		"success":        success,
		"failed":         fail,
		"oversells":      oversell,
		"avg_latency_ms": avgLatency,
	}
}

// ============================================
// MODE 1: NAIVE (No Protection - Shows Race Condition)
// ============================================
func PurchaseNaive(c *gin.Context) {
	start := time.Now()
	atomic.AddInt64(&TotalRequests, 1)

	var req PurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// DANGER: No locking! Just read and write - WILL cause overselling
	var quantity int
	err := database.DB.QueryRow(context.Background(),
		"SELECT quantity FROM products WHERE id=$1", req.ProductID).Scan(&quantity)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}

	if quantity <= 0 {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Out of stock!"})
		return
	}

	// 🚨 INTENTIONAL DELAY: Widen the race condition window for demo purposes
	// In real apps, this delay exists due to network latency, processing, etc.
	time.Sleep(5 * time.Millisecond)

	// DANGER: Race condition window - another request could read same quantity!
	_, err = database.DB.Exec(context.Background(),
		"UPDATE products SET quantity = quantity - 1 WHERE id=$1", req.ProductID)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	_, err = database.DB.Exec(context.Background(),
		"INSERT INTO orders (user_id, product_id, status) VALUES ($1, $2, 'success')",
		req.UserID, req.ProductID)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Order failed"})
		return
	}

	atomic.AddInt64(&SuccessCount, 1)
	atomic.AddInt64(&TotalLatencyMs, time.Since(start).Milliseconds())

	c.JSON(http.StatusOK, gin.H{
		"message":    "Purchase successful!",
		"mode":       "naive",
		"latency_ms": time.Since(start).Milliseconds(),
	})
}

// ============================================
// MODE 2: PostgreSQL Pessimistic Locking (Safe but Slower)
// ============================================
func PurchasePostgresLock(c *gin.Context) {
	start := time.Now()
	atomic.AddInt64(&TotalRequests, 1)

	var req PurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	tx, err := database.DB.Begin(context.Background())
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback(context.Background())

	// SAFE: SELECT FOR UPDATE locks the row!
	var quantity int
	err = tx.QueryRow(context.Background(),
		"SELECT quantity FROM products WHERE id=$1 FOR UPDATE", req.ProductID).Scan(&quantity)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lock failed"})
		return
	}

	if quantity <= 0 {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Out of stock!"})
		return
	}

	_, err = tx.Exec(context.Background(),
		"UPDATE products SET quantity = quantity - 1 WHERE id=$1", req.ProductID)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		"INSERT INTO orders (user_id, product_id, status) VALUES ($1, $2, 'success')",
		req.UserID, req.ProductID)
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Order failed"})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit failed"})
		return
	}

	atomic.AddInt64(&SuccessCount, 1)
	atomic.AddInt64(&TotalLatencyMs, time.Since(start).Milliseconds())

	c.JSON(http.StatusOK, gin.H{
		"message":    "Purchase successful!",
		"mode":       "postgres_lock",
		"latency_ms": time.Since(start).Milliseconds(),
	})
}

// ============================================
// MODE 3: Redis + PostgreSQL (FASTEST - Production Ready)
// ============================================
func PurchaseRedisPostgres(c *gin.Context) {
	start := time.Now()
	atomic.AddInt64(&TotalRequests, 1)

	var req PurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// ⚡ STEP 1: Redis Gatekeeper (Microseconds!)
	// Use Lua script to atomically check and decrement - prevents negative stock
	luaScript := `
		local stock = redis.call('GET', KEYS[1])
		if stock == false then
			return -1
		end
		stock = tonumber(stock)
		if stock <= 0 then
			return -1
		end
		return redis.call('DECR', KEYS[1])
	`
	stock, err := database.Rdb.Eval(context.Background(), luaScript, []string{"product:1:stock"}).Int64()
	if err != nil {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Redis error"})
		return
	}

	if stock < 0 {
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Out of stock!"})
		return
	}

	// 🛡️ STEP 2: Persist to PostgreSQL
	tx, err := database.DB.Begin(context.Background())
	if err != nil {
		database.Rdb.Incr(context.Background(), "product:1:stock") // Compensate
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		"UPDATE products SET quantity = quantity - 1 WHERE id=$1", req.ProductID)
	if err != nil {
		database.Rdb.Incr(context.Background(), "product:1:stock")
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	_, err = tx.Exec(context.Background(),
		"INSERT INTO orders (user_id, product_id, status) VALUES ($1, $2, 'success')",
		req.UserID, req.ProductID)
	if err != nil {
		database.Rdb.Incr(context.Background(), "product:1:stock")
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Order failed"})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		database.Rdb.Incr(context.Background(), "product:1:stock")
		atomic.AddInt64(&FailCount, 1)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit failed"})
		return
	}

	atomic.AddInt64(&SuccessCount, 1)
	atomic.AddInt64(&TotalLatencyMs, time.Since(start).Milliseconds())

	c.JSON(http.StatusOK, gin.H{
		"message":    "Purchase successful!",
		"mode":       "redis_postgres",
		"latency_ms": time.Since(start).Milliseconds(),
	})
}

// Keep the original for backwards compatibility
func PurchaseProduct(c *gin.Context) {
	PurchaseRedisPostgres(c)
}
