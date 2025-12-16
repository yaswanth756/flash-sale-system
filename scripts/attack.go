package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

func main() {
	// 1. Configuration
	totalRequests := 500 // Let's try to buy 500 times (Stock is only 100)
	url := "http://localhost:8080/purchase"

	fmt.Printf("⚠️  Starting Attack: %d requests targeting 100 iPhones...\n", totalRequests)

	var wg sync.WaitGroup
	wg.Add(totalRequests)

	// 2. Launch Concurrent Requests
	// This loop runs INSTANTLY. It doesn't wait for the previous one to finish.
	start := time.Now()
	for i := 0; i < totalRequests; i++ {
		go func(userID int) {
			defer wg.Done()

			// Create JSON payload
			payload := map[string]int{"user_id": userID, "product_id": 1}
			jsonData, _ := json.Marshal(payload)

			// Send POST Request
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
			if err != nil {
				fmt.Printf("Request failed: %v\n", err)
				return
			}
			defer resp.Body.Close()
			
			// We just discard the response, we only care about the server state
			io.Copy(io.Discard, resp.Body)
		}(i)
	}

	// 3. Wait for all requests to finish
	wg.Wait()
	elapsed := time.Since(start)

	fmt.Printf("\n💥 Attack Complete!\n")
	fmt.Printf("⏱️  Time taken: %s\n", elapsed)
	fmt.Println("👉 Now check your Database: SELECT quantity FROM products;")
}