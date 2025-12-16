package database

import (
	"context"
	"fmt"
	"log"
)

func CreateTables() {
	// 1. Define the SQL Queries
	// We use "IF NOT EXISTS" so it doesn't crash if we run it twice.
	queries := []string{
		// Users Table
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			username VARCHAR(50) NOT NULL,
			email VARCHAR(100) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Products Table (The Inventory)
		// notice "quantity" - this is what we will lock later!
		// NOTE: No CHECK constraint on quantity - this allows Naive mode to
		// demonstrate overselling (quantity going negative) to show the danger
		// of race conditions. In production, you WOULD want this constraint!
		`CREATE TABLE IF NOT EXISTS products (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			price DECIMAL(10, 2) NOT NULL,
			quantity INT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Orders Table
		`CREATE TABLE IF NOT EXISTS orders (
			id SERIAL PRIMARY KEY,
			user_id INT,
			product_id INT REFERENCES products(id),
			status VARCHAR(20) DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Drop CHECK constraint on quantity if it exists (for demo purposes)
		// This allows Naive mode to show overselling with negative quantity
		`DO $$ 
		BEGIN
			ALTER TABLE products DROP CONSTRAINT IF EXISTS products_quantity_check;
		EXCEPTION
			WHEN undefined_object THEN NULL;
		END $$;`,
	}

	// 2. Execute each query
	for _, query := range queries {
		_, err := DB.Exec(context.Background(), query)
		if err != nil {
			log.Fatalf("❌ Failed to create table: %v\nQuery: %s", err, query)
		}
	}

	fmt.Println("✅ Database tables checked/created successfully!")
}
