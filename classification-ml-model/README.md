# Customer Churn Classification Model

## Overview
A simple binary classification model to predict customer churn based on customer behavior and demographics.

## Model Details
- **Type**: Binary Classification
- **Algorithm**: Random Forest Classifier
- **Target**: Churn (0 = No Churn, 1 = Churn)
- **Format**: Pickle (.pkl)
- **Accuracy**: ~85-90%

## Input Features
1. **age**: Customer age (18-80)
2. **tenure**: Months as customer (1-72)
3. **monthly_charges**: Monthly bill amount (20-120)
4. **total_charges**: Total amount spent (20-8000)
5. **contract_type**: Contract type (0=Month-to-month, 1=One year, 2=Two year)
6. **payment_method**: Payment method (0=Electronic check, 1=Mailed check, 2=Bank transfer, 3=Credit card)
7. **internet_service**: Internet service (0=DSL, 1=Fiber optic, 2=No)
8. **tech_support**: Has tech support (0=No, 1=Yes)

## Output
- **prediction**: 0 (No Churn) or 1 (Churn)
- **probability**: Probability of churn (0.0 to 1.0)
- **confidence**: Model confidence level

## Usage Examples

### Low Risk Customer
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
Expected: No Churn (0)

### High Risk Customer
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
Expected: Churn (1)

## Files
- `train_churn_model.py`: Script to train the model
- `test_churn_model.py`: Script to test the model
- `customer_churn_model.pkl`: Trained model file
- `requirements.txt`: Python dependencies