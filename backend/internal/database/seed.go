package database

import (
	"context"
	"fmt"
	"log"
)

func SeedDatabase() {
	// 1. Check if we already have a product (Idempotency)
	// We don't want to add a new iPhone every time we restart the server!
	var count int
	err := DB.QueryRow(context.Background(), "SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil {
		log.Printf("⚠️ Failed to check product count: %v", err)
		return
	}

	// 2. If data exists, skip seeding
	if count > 0 {
		fmt.Println("ℹ️ Database already seeded. Skipping...")
		return
	}

	// 3. Insert a Test User
	// We insert a user with ID 1 so we can use it for testing later
	_, err = DB.Exec(context.Background(), `
		INSERT INTO users (username, email, password_hash) 
		VALUES ('testuser', 'test@example.com', 'hashed_secret_password');
	`)
	if err != nil {
		log.Printf("❌ Failed to seed user: %v", err)
	}

	// 4. Insert the "Flash Sale" Product
	// 100 iPhones available. Price $999.
	_, err = DB.Exec(context.Background(), `
		INSERT INTO products (name, price, quantity) 
		VALUES ('iPhone 15 Pro', 999.00, 100);
	`)
	if err != nil {
		log.Printf("❌ Failed to seed product: %v", err)
	}

	err = Rdb.Set(context.Background(), "product:1:stock", 100, 0).Err()
	if err != nil {
		log.Printf("❌ Failed to seed Redis: %v", err)
	} else {
		fmt.Println("⚡ Redis cache seeded with 100 stock!")
	}

	fmt.Println("🌱 Database seeded successfully with 100 iPhones!")
}
