#!/usr/bin/env python3
"""
Customer Churn Classification Model Training Script

This script creates and trains a Random Forest classifier to predict customer churn
based on customer demographics and behavior data.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import os

def generate_synthetic_data(n_samples=5000):
    """Generate synthetic customer churn data for training"""
    np.random.seed(42)
    
    # Generate features
    age = np.random.randint(18, 81, n_samples)
    tenure = np.random.randint(1, 73, n_samples)
    monthly_charges = np.random.uniform(20, 120, n_samples)
    total_charges = monthly_charges * tenure + np.random.normal(0, 100, n_samples)
    total_charges = np.maximum(total_charges, 20)  # Ensure positive values
    
    contract_type = np.random.choice([0, 1, 2], n_samples, p=[0.5, 0.3, 0.2])
    payment_method = np.random.choice([0, 1, 2, 3], n_samples, p=[0.4, 0.2, 0.2, 0.2])
    internet_service = np.random.choice([0, 1, 2], n_samples, p=[0.4, 0.4, 0.2])
    tech_support = np.random.choice([0, 1], n_samples, p=[0.6, 0.4])
    
    # Create DataFrame
    data = pd.DataFrame({
        'age': age,
        'tenure': tenure,
        'monthly_charges': monthly_charges,
        'total_charges': total_charges,
        'contract_type': contract_type,
        'payment_method': payment_method,
        'internet_service': internet_service,
        'tech_support': tech_support
    })
    
    # Generate target variable (churn) based on logical rules
    churn_probability = (
        0.1 +  # Base probability
        0.3 * (tenure < 6) +  # New customers more likely to churn
        0.2 * (contract_type == 0) +  # Month-to-month contracts
        0.15 * (payment_method == 0) +  # Electronic check payment
        0.1 * (monthly_charges > 80) +  # High charges
        0.1 * (age < 30) +  # Younger customers
        -0.15 * (tech_support == 1) +  # Tech support reduces churn
        0.1 * (internet_service == 1)  # Fiber optic issues
    )
    
    # Ensure probabilities are between 0 and 1
    churn_probability = np.clip(churn_probability, 0, 1)
    
    # Generate binary churn labels
    churn = np.random.binomial(1, churn_probability)
    data['churn'] = churn
    
    return data

def train_model():
    """Train the customer churn classification model"""
    print("🚀 Starting Customer Churn Model Training...")
    
    # Generate synthetic data
    print("📊 Generating synthetic customer data...")
    data = generate_synthetic_data(5000)
    
    print(f"✅ Generated {len(data)} customer records")
    print(f"📈 Churn rate: {data['churn'].mean():.2%}")
    
    # Prepare features and target
    feature_columns = [
        'age', 'tenure', 'monthly_charges', 'total_charges',
        'contract_type', 'payment_method', 'internet_service', 'tech_support'
    ]
    
    X = data[feature_columns]
    y = data['churn']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"📚 Training set: {len(X_train)} samples")
    print(f"🧪 Test set: {len(X_test)} samples")
    
    # Train Random Forest model
    print("🌳 Training Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    # Make predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Evaluate model
    accuracy = accuracy_score(y_test, y_pred)
    print(f"🎯 Model Accuracy: {accuracy:.3f}")
    
    print("\n📊 Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['No Churn', 'Churn']))
    
    print("\n🔍 Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n🔝 Feature Importance:")
    for _, row in feature_importance.iterrows():
        print(f"  {row['feature']}: {row['importance']:.3f}")
    
    # Save model
    model_path = 'customer_churn_model.pkl'
    joblib.dump(model, model_path)
    print(f"\n💾 Model saved to: {model_path}")
    
    # Save feature names for later use
    feature_info = {
        'feature_names': feature_columns,
        'model_type': 'RandomForestClassifier',
        'accuracy': accuracy,
        'feature_importance': feature_importance.to_dict('records')
    }
    
    joblib.dump(feature_info, 'model_info.pkl')
    print("📋 Model info saved to: model_info.pkl")
    
    return model, feature_columns, accuracy

def test_sample_predictions(model, feature_columns):
    """Test the model with sample data"""
    print("\n🧪 Testing Sample Predictions...")
    
    # Sample test cases
    test_cases = [
        {
            'name': 'Low Risk Customer',
            'data': {
                'age': 45,
                'tenure': 36,
                'monthly_charges': 65.0,
                'total_charges': 2340.0,
                'contract_type': 2,  # Two year
                'payment_method': 3,  # Credit card
                'internet_service': 0,  # DSL
                'tech_support': 1  # Yes
            }
        },
        {
            'name': 'High Risk Customer',
            'data': {
                'age': 25,
                'tenure': 3,
                'monthly_charges': 95.0,
                'total_charges': 285.0,
                'contract_type': 0,  # Month-to-month
                'payment_method': 0,  # Electronic check
                'internet_service': 1,  # Fiber optic
                'tech_support': 0  # No
            }
        },
        {
            'name': 'Medium Risk Customer',
            'data': {
                'age': 35,
                'tenure': 18,
                'monthly_charges': 75.0,
                'total_charges': 1350.0,
                'contract_type': 1,  # One year
                'payment_method': 2,  # Bank transfer
                'internet_service': 0,  # DSL
                'tech_support': 1  # Yes
            }
        }
    ]
    
    for test_case in test_cases:
        # Prepare input data
        input_data = pd.DataFrame([test_case['data']])
        input_data = input_data[feature_columns]  # Ensure correct order
        
        # Make prediction
        prediction = model.predict(input_data)[0]
        probability = model.predict_proba(input_data)[0, 1]
        
        print(f"\n👤 {test_case['name']}:")
        print(f"   Input: {test_case['data']}")
        print(f"   Prediction: {'Churn' if prediction == 1 else 'No Churn'} ({prediction})")
        print(f"   Churn Probability: {probability:.3f}")
        print(f"   Risk Level: {'High' if probability > 0.7 else 'Medium' if probability > 0.3 else 'Low'}")

if __name__ == "__main__":
    try:
        # Train the model
        model, feature_columns, accuracy = train_model()
        
        # Test with sample data
        test_sample_predictions(model, feature_columns)
        
        print(f"\n🎉 Model training completed successfully!")
        print(f"📁 Files created:")
        print(f"   - customer_churn_model.pkl (main model file)")
        print(f"   - model_info.pkl (model metadata)")
        print(f"\n📤 Ready to upload to your ML dashboard!")
        
    except Exception as e:
        print(f"❌ Error during training: {str(e)}")
        raise