# 🚀 Postman Testing Guide for House Prediction Model

## Quick Setup

### Step 1: Import the Collection
1. **Open Postman**
2. **Click "Import"** (top left)
3. **Select "Upload Files"**
4. **Choose:** `House-Prediction-Model-Postman-Collection.json`
5. **Click "Import"**

### Step 2: Set Your Model ID
1. **Get your model ID** by running request #2 "Get All Models"
2. **Copy the ID** of your house prediction model
3. **Go to Collection Variables** (click on the collection name)
4. **Update `model_id`** variable with your actual model ID

## 📋 Test Sequence

### 1. Health Check ✅
**Request:** `GET /api/health`
**Expected:** Status 200, server health info

### 2. Get All Models 📋
**Request:** `GET /api/models`
**Expected:** Array of models including your house prediction model
**Action:** Copy your model ID for next tests

### 3. Get Model Details 🔍
**Request:** `GET /api/models/{model_id}`
**Expected:** Detailed info about your house model

### 4-8. House Prediction Tests 🏠

#### Test 4: Small Starter Home
```json
{
  "features": [2, 1, 900, 25]
}
```
**Expected Price:** $150,000 - $250,000

#### Test 5: Average Family Home
```json
{
  "features": [3, 2, 1500, 10]
}
```
**Expected Price:** $250,000 - $400,000

#### Test 6: Large Luxury Home
```json
{
  "features": [5, 3, 3500, 5]
}
```
**Expected Price:** $500,000 - $800,000

#### Test 7: Older Compact Home
```json
{
  "features": [2, 1, 1000, 40]
}
```
**Expected Price:** $120,000 - $200,000

#### Test 8: New Modern Home
```json
{
  "features": [4, 3, 2500, 2]
}
```
**Expected Price:** $400,000 - $600,000

### 9-12. Alternative Input Formats 🔄

Test different ways to send data to see which format your model accepts:

- **Array format:** `[3, 2, 1500, 10]`
- **Object format:** `{"bedrooms": 3, "bathrooms": 2, "sqft": 1500, "age": 10}`
- **Input wrapper:** `{"input": [3, 2, 1500, 10]}`
- **Data wrapper:** `{"data": [3, 2, 1500, 10]}`

### 13. Custom House Test 🎯
**Modify the request** with your own house details:
```json
{
  "features": [bedrooms, bathrooms, sqft, age]
}
```

### 14-15. Error Handling Tests ⚠️
Test how your model handles invalid inputs.

## 🔧 Manual Setup (Alternative)

If you prefer to set up manually:

### Base URL
```
http://localhost:3000
```

### Get Models Endpoint
```
GET http://localhost:3000/api/models
```

### Prediction Endpoint
```
POST http://localhost:3000/api/predict/{YOUR_MODEL_ID}
Content-Type: application/json

{
  "features": [3, 2, 1500, 10]
}
```

## 📊 Expected Response Format

### Successful Prediction
```json
{
  "prediction": 285000.50,
  "model_id": "your-model-id",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Error Response
```json
{
  "error": {
    "code": "PREDICTION_ERROR",
    "message": "Invalid input format",
    "timestamp": "2025-01-01T12:00:00Z"
  }
}
```

## 🏠 House Features Explanation

The model expects 4 features in this order:
1. **Bedrooms** (integer): Number of bedrooms (1-10)
2. **Bathrooms** (number): Number of bathrooms (1-5, can be decimal like 2.5)
3. **Square Feet** (integer): Total living area (500-10000)
4. **Age** (integer): Age of the house in years (0-100)

## 🧪 Testing Checklist

- [ ] ✅ Health check passes
- [ ] 📋 Can retrieve models list
- [ ] 🔍 Can get model details
- [ ] 🏠 Small house prediction works
- [ ] 🏡 Average house prediction works
- [ ] 🏰 Luxury house prediction works
- [ ] 🏚️ Old house prediction works
- [ ] 🏢 New house prediction works
- [ ] 🔄 At least one alternative format works
- [ ] 🎯 Custom house prediction works
- [ ] ⚠️ Error handling works properly

## 🚨 Troubleshooting

### Common Issues:

1. **Connection Error**
   - Check if server is running: `http://localhost:3000/api/health`
   - Verify port 3000 is not blocked

2. **Model Not Found**
   - Run "Get All Models" to find correct model ID
   - Update the `model_id` variable in collection

3. **Prediction Fails**
   - Try different input formats (tests 9-12)
   - Check if features are in correct order: [bedrooms, bathrooms, sqft, age]
   - Ensure all values are numbers

4. **Invalid Response**
   - Check server logs for errors
   - Verify model was uploaded correctly
   - Try simpler input like `[3, 2, 1500, 10]`

## 🎯 Success Criteria

Your model is working correctly if:
- ✅ All prediction requests return HTTP 200
- ✅ Predictions are reasonable numbers (not NaN or negative)
- ✅ Small houses < Average houses < Luxury houses (generally)
- ✅ Older houses typically cost less than newer ones
- ✅ At least one input format works consistently

## 📈 Performance Testing

To test performance, run the same prediction multiple times and check:
- **Response Time:** Should be < 1000ms
- **Consistency:** Same input should give same output
- **Reliability:** No random failures

Happy testing! 🚀