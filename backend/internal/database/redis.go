package database

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

// Global Redis Client
var Rdb *redis.Client

func ConnectRedis() {
	// 1. Configure the client
	dsn := fmt.Sprintf("%s:%s", os.Getenv("REDIS_HOST"), os.Getenv("REDIS_PORT"))
	
	Rdb = redis.NewClient(&redis.Options{
		Addr: dsn, 
		// No password set in docker-compose, so empty string
		Password: "", 
		DB:       0,  // Default DB
	})

	// 2. Test Connection (Ping)
	_, err := Rdb.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("❌ Redis connection failed: %v", err)
	}

	fmt.Println("⚡ Connected to Redis successfully!")
}