# Postman Testing Guide for ML Model Prediction API

## Endpoint to Test
```
POST http://localhost:3000/api/predict/335358cb-1193-4300-baa3-6b29254e2421
```

## Step-by-Step Postman Setup

### Step 1: Get Authentication Token

First, you need to get a Bearer token by registering/logging in:

#### Option A: Register New User
1. **Method**: POST
2. **URL**: `http://localhost:3000/api/auth/register`
3. **Headers**:
   ```
   Content-Type: application/json
   ```
4. **Body** (raw JSON):
   ```json
   {
     "email": "test@example.com",
     "password": "TestPassword123!"
   }
   ```
5. **Send** and copy the `token` from the response

#### Option B: Login Existing User
1. **Method**: POST
2. **URL**: `http://localhost:3000/api/auth/login`
3. **Headers**:
   ```
   Content-Type: application/json
   ```
4. **Body** (raw JSON):
   ```json
   {
     "email": "test@example.com",
     "password": "TestPassword123!"
   }
   ```
5. **Send** and copy the `token` from the response

### Step 2: Test Model Prediction

1. **Method**: POST
2. **URL**: `http://localhost:3000/api/predict/335358cb-1193-4300-baa3-6b29254e2421`
3. **Headers**:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_TOKEN_HERE
   ```
4. **Body** (raw JSON) - House Price Prediction Example:
   ```json
   {
     "bedrooms": 3,
     "bathrooms": 2,
     "sqft": 1500,
     "age": 10
   }
   ```

### Step 3: Alternative - Use API Key Authentication

If you prefer API key authentication:

1. First create an API key using your Bearer token:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/keys`
   - **Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_TOKEN_HERE
     ```
   - **Body**:
     ```json
     {
       "name": "Test API Key"
     }
     ```

2. Then use the API key for prediction:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/predict/335358cb-1193-4300-baa3-6b29254e2421`
   - **Headers**:
     ```
     Content-Type: application/json
     X-API-Key: YOUR_API_KEY_HERE
     ```
   - **Body**: Same as above

## Expected Response

```json
{
  "modelId": "335358cb-1193-4300-baa3-6b29254e2421",
  "prediction": 275000,
  "confidence": 0.85,
  "processingTime": 67.45,
  "timestamp": "2025-09-14T10:30:00.000Z",
  "input": {
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 1500,
    "age": 10
  }
}
```

## Common Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "timestamp": "2025-09-14T10:30:00.000Z"
  }
}
```
**Solution**: Get a new token using the auth endpoints above.

### 400 Bad Request
```json
{
  "error": {
    "code": "MISSING_INPUT_DATA",
    "message": "Input data is required for prediction",
    "timestamp": "2025-09-14T10:30:00.000Z"
  }
}
```
**Solution**: Make sure you include the required input data in the request body.

## Sample Input Data Variations

### Minimal Input
```json
{
  "bedrooms": 2,
  "bathrooms": 1,
  "sqft": 800,
  "age": 5
}
```

### Luxury House
```json
{
  "bedrooms": 5,
  "bathrooms": 4,
  "sqft": 3500,
  "age": 2
}
```

### Older House
```json
{
  "bedrooms": 4,
  "bathrooms": 2,
  "sqft": 2000,
  "age": 25
}
```

## Troubleshooting

### If you get "Invalid or expired token":
1. Make sure your server is running on `http://localhost:3000`
2. Register a new user or login to get a fresh token
3. Copy the entire token (it should start with `eyJ`)
4. Use `Bearer ` (with space) before the token in Authorization header

### If you get connection errors:
1. Verify your server is running: `npm start` or `node src/app.js`
2. Check the server logs for any errors
3. Try accessing `http://localhost:3000/health` first to verify the server is up

### If you get 404 errors:
1. Make sure the model ID exists in your database
2. Try using a different model ID or upload a new model first
3. Check server logs to see if the route is being hit

## Quick Test Script

You can also test this with curl:

```bash
# First, get a token
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# Then use the token for prediction (replace YOUR_TOKEN with actual token)
curl -X POST http://localhost:3000/api/predict/335358cb-1193-4300-baa3-6b29254e2421 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"bedrooms":3,"bathrooms":2,"sqft":1500,"age":10}'
```