#!/usr/bin/env python3
"""
Customer Churn Model Testing Script

This script loads the trained model and tests it with various customer profiles.
"""

import joblib
import pandas as pd
import numpy as np
import json
from datetime import datetime

def load_model():
    """Load the trained model and metadata"""
    try:
        model = joblib.load('customer_churn_model.pkl')
        model_info = joblib.load('model_info.pkl')
        return model, model_info
    except FileNotFoundError as e:
        print(f"❌ Model file not found: {e}")
        print("🔧 Please run 'python train_churn_model.py' first to create the model.")
        return None, None

def predict_churn(model, model_info, customer_data):
    """Make a churn prediction for a customer"""
    try:
        # Prepare input data
        input_df = pd.DataFrame([customer_data])
        input_df = input_df[model_info['feature_names']]  # Ensure correct order
        
        # Make prediction
        prediction = model.predict(input_df)[0]
        probabilities = model.predict_proba(input_df)[0]
        churn_probability = probabilities[1]
        
        # Determine risk level
        if churn_probability > 0.7:
            risk_level = "High"
        elif churn_probability > 0.3:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        return {
            'prediction': int(prediction),
            'churn_probability': float(churn_probability),
            'no_churn_probability': float(probabilities[0]),
            'risk_level': risk_level,
            'prediction_label': 'Churn' if prediction == 1 else 'No Churn'
        }
        
    except Exception as e:
        return {'error': str(e)}

def test_model():
    """Test the model with various customer profiles"""
    print("🧪 Customer Churn Model Testing")
    print("=" * 50)
    
    # Load model
    model, model_info = load_model()
    if model is None:
        return
    
    print(f"✅ Model loaded successfully")
    print(f"📊 Model accuracy: {model_info['accuracy']:.3f}")
    print(f"🔧 Model type: {model_info['model_type']}")
    
    # Test cases
    test_customers = [
        {
            'name': 'Loyal Long-term Customer',
            'profile': {
                'age': 55,
                'tenure': 60,
                'monthly_charges': 70.0,
                'total_charges': 4200.0,
                'contract_type': 2,  # Two year
                'payment_method': 3,  # Credit card
                'internet_service': 0,  # DSL
                'tech_support': 1  # Yes
            }
        },
        {
            'name': 'New High-Value Customer',
            'profile': {
                'age': 30,
                'tenure': 2,
                'monthly_charges': 110.0,
                'total_charges': 220.0,
                'contract_type': 0,  # Month-to-month
                'payment_method': 0,  # Electronic check
                'internet_service': 1,  # Fiber optic
                'tech_support': 0  # No
            }
        },
        {
            'name': 'Budget-Conscious Customer',
            'profile': {
                'age': 40,
                'tenure': 24,
                'monthly_charges': 35.0,
                'total_charges': 840.0,
                'contract_type': 1,  # One year
                'payment_method': 2,  # Bank transfer
                'internet_service': 2,  # No internet
                'tech_support': 0  # No
            }
        },
        {
            'name': 'Young Professional',
            'profile': {
                'age': 28,
                'tenure': 8,
                'monthly_charges': 85.0,
                'total_charges': 680.0,
                'contract_type': 0,  # Month-to-month
                'payment_method': 3,  # Credit card
                'internet_service': 1,  # Fiber optic
                'tech_support': 1  # Yes
            }
        },
        {
            'name': 'Senior Customer',
            'profile': {
                'age': 68,
                'tenure': 48,
                'monthly_charges': 45.0,
                'total_charges': 2160.0,
                'contract_type': 2,  # Two year
                'payment_method': 1,  # Mailed check
                'internet_service': 0,  # DSL
                'tech_support': 1  # Yes
            }
        }
    ]
    
    print(f"\n🔍 Testing {len(test_customers)} customer profiles...")
    print("-" * 80)
    
    for i, customer in enumerate(test_customers, 1):
        print(f"\n{i}. {customer['name']}")
        print(f"   Profile: {customer['profile']}")
        
        result = predict_churn(model, model_info, customer['profile'])
        
        if 'error' in result:
            print(f"   ❌ Error: {result['error']}")
        else:
            print(f"   🎯 Prediction: {result['prediction_label']}")
            print(f"   📊 Churn Probability: {result['churn_probability']:.3f}")
            print(f"   ⚠️  Risk Level: {result['risk_level']}")
    
    # Interactive testing
    print(f"\n" + "=" * 50)
    print("🎮 Interactive Testing")
    print("Enter customer data to get churn prediction:")
    
    while True:
        try:
            print(f"\nEnter customer details (or 'quit' to exit):")
            
            age = input("Age (18-80): ")
            if age.lower() == 'quit':
                break
            age = int(age)
            
            tenure = int(input("Tenure in months (1-72): "))
            monthly_charges = float(input("Monthly charges (20-120): "))
            total_charges = float(input("Total charges: "))
            
            print("Contract type: 0=Month-to-month, 1=One year, 2=Two year")
            contract_type = int(input("Contract type (0-2): "))
            
            print("Payment method: 0=Electronic check, 1=Mailed check, 2=Bank transfer, 3=Credit card")
            payment_method = int(input("Payment method (0-3): "))
            
            print("Internet service: 0=DSL, 1=Fiber optic, 2=No")
            internet_service = int(input("Internet service (0-2): "))
            
            print("Tech support: 0=No, 1=Yes")
            tech_support = int(input("Tech support (0-1): "))
            
            customer_data = {
                'age': age,
                'tenure': tenure,
                'monthly_charges': monthly_charges,
                'total_charges': total_charges,
                'contract_type': contract_type,
                'payment_method': payment_method,
                'internet_service': internet_service,
                'tech_support': tech_support
            }
            
            result = predict_churn(model, model_info, customer_data)
            
            print(f"\n🎯 Prediction Results:")
            print(f"   Prediction: {result['prediction_label']}")
            print(f"   Churn Probability: {result['churn_probability']:.3f}")
            print(f"   Risk Level: {result['risk_level']}")
            
            # Generate API-style response
            api_response = {
                'modelId': 'customer-churn-classifier',
                'prediction': result['prediction'],
                'probability': result['churn_probability'],
                'confidence': max(result['churn_probability'], result['no_churn_probability']),
                'risk_level': result['risk_level'],
                'prediction_label': result['prediction_label'],
                'processingTime': np.random.uniform(50, 150),
                'timestamp': datetime.now().isoformat(),
                'input': customer_data
            }
            
            print(f"\n📡 API Response Format:")
            print(json.dumps(api_response, indent=2))
            
        except KeyboardInterrupt:
            print(f"\n👋 Goodbye!")
            break
        except ValueError as e:
            print(f"❌ Invalid input: {e}")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_model()