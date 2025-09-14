# 🔐 Fixed Postman Testing Guide for House Prediction Model

## 🚨 Authentication Required!

Your API requires authentication. I've created a fixed collection that handles this automatically.

## 🚀 Quick Setup

### Step 1: Import the Fixed Collection
1. **Open Postman**
2. **Click "Import"** (top left)
3. **Select "Upload Files"**
4. **Choose:** `House-Prediction-Model-Postman-Collection-Fixed.json`
5. **Click "Import"**

### Step 2: Run Authentication Setup (REQUIRED!)
**You MUST run these 3 requests in order:**

1. **🔐 Authentication Setup → 1. Register User**
   - Creates a test user account
   - Email: `test@example.com`
   - Password: `testpassword123`

2. **🔐 Authentication Setup → 2. Login User**
   - Logs in and gets authentication token
   - (Run this if registration fails because user already exists)

3. **🔐 Authentication Setup → 3. Create API Key**
   - Creates an API key for testing
   - This key will be used for all model requests

### Step 3: Test Your Model
Once authentication is set up, run:

1. **🏠 Model Testing → Get All Models**
   - Finds your house prediction model automatically
   - Sets the model ID for other tests

2. **🏠 Model Testing → Test [House Type]**
   - Run any of the house prediction tests
   - Each test shows expected vs actual results

## 📋 Step-by-Step Instructions

### Phase 1: Authentication (Run Once)
```
1. Register User     → Creates account
2. Login User        → Gets auth token  
3. Create API Key    → Gets API key for testing
```

### Phase 2: Model Testing (Run Multiple Times)
```
1. Get All Models    → Finds your house model
2. Test Small House  → $150K-$250K expected
3. Test Average House → $250K-$400K expected  
4. Test Luxury House → $500K-$800K expected
5. Test Custom House → Your own house details
```

### Phase 3: Format Testing (Optional)
```
1. Test Array Format    → [3, 2, 1500, 10]
2. Test Object Format   → {bedrooms: 3, bathrooms: 2, ...}
3. Test Input Wrapper   → {input: [3, 2, 1500, 10]}
```

## 🏠 House Input Format

Your model expects: `[bedrooms, bathrooms, sqft, age]`

**Examples:**
- Small house: `[2, 1, 900, 25]`
- Average house: `[3, 2, 1500, 10]`
- Luxury house: `[5, 3, 3500, 5]`
- Your house: `[4, 2.5, 2200, 8]` ← Modify this!

## 📊 Expected Results

### Successful Response:
```json
{
  "prediction": 285000.50,
  "model_id": "your-model-id",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Authentication Error (Before Setup):
```json
{
  "error": "Invalid or expired token",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## 🧪 Testing Checklist

### Authentication Setup:
- [ ] ✅ User registered successfully
- [ ] 🔑 Login successful  
- [ ] 🗝️ API key created
- [ ] 📋 Can get models list

### Model Testing:
- [ ] 🏠 Small house prediction works
- [ ] 🏡 Average house prediction works
- [ ] 🏰 Luxury house prediction works
- [ ] 🎯 Custom house prediction works

### Validation:
- [ ] 💰 Predictions are reasonable dollar amounts
- [ ] 📈 Larger houses generally cost more
- [ ] 🕐 Response time < 1000ms
- [ ] ✅ No authentication errors

## 🚨 Troubleshooting

### "Invalid or expired token" Error:
1. **Run authentication setup first!**
2. Make sure all 3 auth requests completed successfully
3. Check that API key was created in the console output

### "Model not found" Error:
1. Run "Get All Models" first
2. Check console output for your model ID
3. Verify your house prediction model is uploaded

### Prediction fails:
1. Try different input formats (Phase 3 tests)
2. Check that features are numbers: `[3, 2, 1500, 10]`
3. Verify model ID is correct

### Connection Error:
1. Check server is running: `http://localhost:3000/api/health`
2. Verify port 3000 is accessible

## 🎯 Success Criteria

Your model is working correctly if:
- ✅ Authentication setup completes without errors
- ✅ All prediction requests return HTTP 200
- ✅ Predictions are reasonable house prices ($100K-$1M range)
- ✅ Larger/newer houses generally cost more than smaller/older ones
- ✅ Response times are fast (< 1000ms)

## 🔧 Manual Testing (Alternative)

If you prefer manual setup:

### 1. Register/Login:
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'

# Login  
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}'
```

### 2. Create API Key:
```bash
curl -X POST http://localhost:3000/api/auth/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"name": "Test Key", "description": "Testing"}'
```

### 3. Test Prediction:
```bash
curl -X POST http://localhost:3000/api/predict/YOUR_MODEL_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"features": [3, 2, 1500, 10]}'
```

## 🎉 Ready to Test!

Import the fixed collection and run the authentication setup first. Then you can test your house prediction model with confidence!

The collection includes automatic console logging so you can see exactly what's happening at each step. 🚀