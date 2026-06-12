package middleware

import (
	"net/http"
	"strings"

	"server/db"
)

func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized: Missing token", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Unauthorized: Invalid token format", http.StatusUnauthorized)
			return
		}

		token := parts[1]

		valid, err := db.IsTokenValid(token)
		if err != nil || !valid {
			http.Error(w, "Unauthorized: Access denied", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}
