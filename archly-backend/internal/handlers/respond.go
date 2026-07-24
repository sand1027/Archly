package handlers

import (
	"encoding/json"
	"net/http"
)

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes a structured JSON error response.
func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, map[string]string{
		"code":    code,
		"message": message,
	})
}

// BadRequest writes a 400 error.
func BadRequest(w http.ResponseWriter, message string) {
	Error(w, http.StatusBadRequest, "BAD_REQUEST", message)
}

// Unauthorized writes a 401 error.
func Unauthorized(w http.ResponseWriter) {
	Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
}

// Forbidden writes a 403 error.
func Forbidden(w http.ResponseWriter, message string) {
	Error(w, http.StatusForbidden, "FORBIDDEN", message)
}

// NotFound writes a 404 error.
func NotFound(w http.ResponseWriter, resource string) {
	Error(w, http.StatusNotFound, "NOT_FOUND", resource+" not found")
}

// InternalError writes a 500 error.
func InternalError(w http.ResponseWriter, err error) {
	Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "an unexpected error occurred")
}

// Decode decodes JSON request body into v. Writes 400 on error and returns false.
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		BadRequest(w, "invalid JSON: "+err.Error())
		return false
	}
	return true
}
