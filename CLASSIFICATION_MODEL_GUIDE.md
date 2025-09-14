# Customer Churn Classification Model - Complete Guide

## 🎯 **Overview**
A binary classification model that predicts whether a customer will churn (leave) based on their profile and behavior patterns.

## 🚀 **Quick Setup**

### **Step 1: Create the Model**
```bash
cd classification-ml-model
python quick_start.py
```

This will:
- Install required packages
- Train the model
- Create `customer_churn_model.pkl` file

### **Step 2: Upload to Dashboard**
1. Go to your ML Model Dashboard
2. Click "Upload Model"
3. Upload the `customer_churn_model.pkl` file
4. Name it "Customer Churn Predictor"
5. Description: "Predicts customer churn based on demographics and behavior"

## 📊 **Model Details**

### **Input Features**
| Feature | Type | Range | Description |
|---------|------|-------|-------------|
| `age` | number | 18-80 | Customer age |
| `tenure` | number | 1-72 | Months as customer |
| `monthly_charges` | number | 20-120 | Monthly bill amount |
| `total_charges` | number | 20-8000 | Total amount spent |
| `contract_type` | number | 0,1,2 | 0=Month-to-month, 1=One year, 2=Two year |
| `payment_method` | number | 0,1,2,3 | 0=Electronic check, 1=Mailed check, 2=Bank transfer, 3=Credit card |
| `internet_service` | number | 0,1,2 | 0=DSL, 1=Fiber optic, 2=No |
| `tech_support` | number | 0,1 | 0=No, 1=Yes |

### **Output**
- **prediction**: 0 (No Churn) or 1 (Churn)
- **churn_probability**: Probability of churn (0.0 to 1.0)
- **risk_level**: "Low", "Medium", or "High"
- **prediction_label**: "No Churn" or "Churn"

## 🧪 **Testing Examples**

### **High Risk Customer (Likely to Churn)**
```json
{
  "age": 25,
  "tenure": 3,
  "monthly_charges": 95.0,
  "total_charges": 285.0,
  "contract_type": 0,
  "payment_method": 0,
  "internet_service": 1,
  "tech_support": 0
}
```
**Expected**: Churn (1), High Risk

### **Low Risk Customer (Unlikely to Churn)**
```json
{
  "age": 45,
  "tenure": 36,
  "monthly_charges": 65.0,
  "total_charges": 2340.0,
  "contract_type": 2,
  "payment_method": 3,
  "internet_service": 0,
  "tech_support": 1
}
```
**Expected**: No Churn (0), Low Risk

### **Medium Risk Customer**
```json
{
  "age": 35,
  "tenure": 18,
  "monthly_charges": 75.0,
  "total_charges": 1350.0,
  "contract_type": 1,
  "payment_method": 2,
  "internet_service": 0,
  "tech_support": 1
}
```
**Expected**: No Churn (0), Medium Risk

## 🔧 **API Testing**

### **Using Postman**

1. **Get Bearer Token**:
   ```bash
   node get-bearer-token.js
   ```

2. **Test Prediction**:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/predict/YOUR_MODEL_ID`
   - **Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_TOKEN
     ```
   - **Body**: Use any of the examples above

### **Expected Response**
```json
{
  "modelId": "your-model-id",
  "prediction": 1,
  "confidence": 0.823,
  "processingTime": 67.45,
  "timestamp": "2025-09-14T10:30:00.000Z",
  "input": {
    "age": 25,
    "tenure": 3,
    "monthly_charges": 95.0,
    "total_charges": 285.0,
    "contract_type": 0,
    "payment_method": 0,
    "internet_service": 1,
    "tech_support": 0
  },
  "model_type": "classification",
  "prediction_type": "customer_churn",
  "prediction_label": "Churn",
  "churn_probability": 0.823,
  "no_churn_probability": 0.177,
  "risk_level": "High"
}
```

## 📈 **Business Use Cases**

### **1. Customer Retention**
- Identify high-risk customers before they churn
- Proactive outreach to at-risk customers
- Targeted retention campaigns

### **2. Resource Allocation**
- Focus retention efforts on high-value, high-risk customers
- Optimize customer service resources
- Prioritize customer success initiatives

### **3. Product Improvements**
- Identify factors that lead to churn
- Improve services based on churn patterns
- Develop better pricing strategies

## 🎯 **Risk Level Interpretation**

- **High Risk (>70% churn probability)**:
  - Immediate intervention required
  - Personal outreach recommended
  - Special offers or discounts

- **Medium Risk (30-70% churn probability)**:
  - Monitor closely
  - Proactive customer service
  - Satisfaction surveys

- **Low Risk (<30% churn probability)**:
  - Standard service level
  - Upselling opportunities
  - Loyalty programs

## 🔍 **Model Performance**

- **Accuracy**: ~85-90%
- **Algorithm**: Random Forest Classifier
- **Training Data**: 5,000 synthetic customer records
- **Features**: 8 customer attributes
- **Validation**: Train/test split with stratification

## 🛠️ **Customization**

### **Adding New Features**
1. Edit `train_churn_model.py`
2. Add new features to the `generate_synthetic_data()` function
3. Update the `feature_columns` list
4. Retrain the model

### **Improving Accuracy**
1. Collect real customer data
2. Increase training data size
3. Feature engineering (create new derived features)
4. Hyperparameter tuning
5. Try different algorithms (XGBoost, Neural Networks)

## 📝 **Integration Examples**

### **JavaScript/Node.js**
```javascript
const prediction = await fetch('http://localhost:3000/api/predict/model-id', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    age: 35,
    tenure: 18,
    monthly_charges: 75.0,
    total_charges: 1350.0,
    contract_type: 1,
    payment_method: 2,
    internet_service: 0,
    tech_support: 1
  })
});

const result = await prediction.json();
console.log('Churn Risk:', result.risk_level);
```

### **Python**
```python
import requests

response = requests.post(
    'http://localhost:3000/api/predict/model-id',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    },
    json={
        'age': 35,
        'tenure': 18,
        'monthly_charges': 75.0,
        'total_charges': 1350.0,
        'contract_type': 1,
        'payment_method': 2,
        'internet_service': 0,
        'tech_support': 1
    }
)

result = response.json()
print(f"Churn Risk: {result['risk_level']}")
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"Invalid or expired token"**
   - Get a new token using the auth endpoints
   - Make sure to include "Bearer " before the token

2. **"Missing input data"**
   - Ensure all 8 required fields are included
   - Check field names match exactly

3. **Unexpected predictions**
   - Verify input data types (numbers, not strings)
   - Check value ranges are within expected bounds

### **Model Not Working?**
1. Check if the model file was uploaded correctly
2. Verify the model ID in the URL
3. Test with the provided sample data first
4. Check server logs for errors

## 📚 **Next Steps**

1. **Upload and test** the classification model
2. **Compare results** with the house price model
3. **Try different input combinations** to understand the model behavior
4. **Integrate** into your applications using the API
5. **Monitor performance** and collect feedback for improvements

This classification model complements your existing regression model, giving you both continuous (house prices) and categorical (churn/no churn) prediction capabilities!