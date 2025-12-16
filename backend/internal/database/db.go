package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/joho/godotenv/autoload" 
)


var DB *pgxpool.Pool

func ConnectDB() {
	// 1. Build the connection string (DSN)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	// 2. Configure the Pool
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		log.Fatalf("❌ Config error: %v\n", err)
	}

	// 3. Connect (Create the Pool)
	conn, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("❌ Connection error: %v\n", err)
	}

	DB = conn // Assign to global variable

	// 4. Test the connection (Ping)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = DB.Ping(ctx)
	if err != nil {
		log.Fatalf("❌ Database unresponsive: %v\n", err)
	}

	fmt.Println("✅ Connected to PostgreSQL successfully!")
}
