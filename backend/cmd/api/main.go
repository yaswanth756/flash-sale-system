package main

import (
	"fmt"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"flash-sale-backend/internal/database"
	"flash-sale-backend/internal/handlers"
)

func main() {
	fmt.Println("🚀 Starting Flash Sale Backend...")

	// 1. Initialize Database Connection
	database.ConnectDB()

	// 2. Run Migrations to Create Tables
	database.CreateTables()

	// 3. Seed Initial Data
	database.SeedDatabase()

	// 4. Initialize Redis Connection
	database.ConnectRedis()

	r := gin.Default()

	// CORS for frontend
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "up",
			"message": "✅ System is running smoothly",
		})
	})

	// Get products
	r.GET("/products", func(c *gin.Context) {
		rows, err := database.DB.Query(c, "SELECT id, name, quantity FROM products")
		if err != nil {
			c.JSON(500, gin.H{"error": "Database error"})
			return
		}
		defer rows.Close()

		var products []map[string]interface{}
		for rows.Next() {
			var id, quantity int
			var name string
			rows.Scan(&id, &name, &quantity)

			products = append(products, map[string]interface{}{
				"id":       id,
				"name":     name,
				"quantity": quantity,
			})
		}

		c.JSON(200, products)
	})

	// ============================================
	// 🎯 THREE PURCHASE MODES
	// ============================================
	r.POST("/purchase", handlers.PurchaseProduct)               // Default (Redis+Postgres)
	r.POST("/purchase/naive", handlers.PurchaseNaive)           // Mode 1: Naive (Race Condition)
	r.POST("/purchase/postgres", handlers.PurchasePostgresLock) // Mode 2: PostgreSQL Lock
	r.POST("/purchase/redis", handlers.PurchaseRedisPostgres)   // Mode 3: Redis + PostgreSQL

	// ============================================
	// 📊 STATS ENDPOINT FOR DASHBOARD
	// ============================================
	r.GET("/stats", func(c *gin.Context) {
		// Get current stock from both DB and Redis
		var dbStock int
		database.DB.QueryRow(c, "SELECT quantity FROM products WHERE id=1").Scan(&dbStock)

		redisStock, _ := database.Rdb.Get(c, "product:1:stock").Int()

		// Get order count
		var orderCount int
		database.DB.QueryRow(c, "SELECT COUNT(*) FROM orders").Scan(&orderCount)

		stats := handlers.GetStats()
		stats["db_stock"] = dbStock
		stats["redis_stock"] = redisStock
		stats["order_count"] = orderCount

		c.JSON(200, stats)
	})

	// View all orders
	r.GET("/orders", func(c *gin.Context) {
		rows, err := database.DB.Query(c, "SELECT id, user_id, product_id, status, created_at FROM orders ORDER BY id DESC LIMIT 100")
		if err != nil {
			c.JSON(500, gin.H{"error": "Database error"})
			return
		}
		defer rows.Close()

		var orders []map[string]interface{}
		for rows.Next() {
			var id, userID, productID int
			var status string
			var createdAt interface{}
			rows.Scan(&id, &userID, &productID, &status, &createdAt)

			orders = append(orders, map[string]interface{}{
				"id":         id,
				"user_id":    userID,
				"product_id": productID,
				"status":     status,
				"created_at": createdAt,
			})
		}

		c.JSON(200, gin.H{
			"total_orders": len(orders),
			"orders":       orders,
		})
	})

	// Reset everything
	r.POST("/reset", func(c *gin.Context) {
		// Reset Postgres
		_, err := database.DB.Exec(c, "UPDATE products SET quantity = 100 WHERE id = 1")
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to reset DB"})
			return
		}
		database.DB.Exec(c, "DELETE FROM orders")

		// Reset Redis - explicitly set to 100 (fixes any negative values)
		err = database.Rdb.Set(c, "product:1:stock", 100, 0).Err()
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to reset Redis"})
			return
		}

		// Reset Stats
		handlers.ResetStats()

		c.JSON(200, gin.H{"message": "✅ Stock reset to 100, orders cleared, stats reset!"})
	})

	// Sync Redis with Postgres (useful if Redis gets out of sync)
	r.POST("/sync-redis", func(c *gin.Context) {
		var dbStock int
		err := database.DB.QueryRow(c, "SELECT quantity FROM products WHERE id=1").Scan(&dbStock)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to read DB stock"})
			return
		}

		// Ensure stock is never negative
		if dbStock < 0 {
			dbStock = 0
		}

		err = database.Rdb.Set(c, "product:1:stock", dbStock, 0).Err()
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to sync Redis"})
			return
		}

		c.JSON(200, gin.H{"message": "✅ Redis synced with PostgreSQL", "stock": dbStock})
	})

	fmt.Println("🎯 Server running on http://localhost:8080")
	fmt.Println("📊 Dashboard API ready!")
	fmt.Println("")
	fmt.Println("Available endpoints:")
	fmt.Println("  POST /purchase/naive    - Mode 1: Naive (Shows Race Condition)")
	fmt.Println("  POST /purchase/postgres - Mode 2: PostgreSQL Locking")
	fmt.Println("  POST /purchase/redis    - Mode 3: Redis + PostgreSQL (Fastest)")
	fmt.Println("  GET  /stats             - Live statistics")
	fmt.Println("  POST /reset             - Reset stock to 100")

	if err := r.Run(":8080"); err != nil {
		fmt.Printf("❌ Failed to start server: %v\n", err)
	}
}
