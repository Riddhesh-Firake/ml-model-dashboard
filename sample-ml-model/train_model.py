#!/usr/bin/env python3
"""
Simple House Price Prediction Model
Creates a linear regression model to predict house prices based on basic features.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import json

def generate_sample_data(n_samples=1000):
    """Generate synthetic house data for training"""
    np.random.seed(42)  # For reproducible results
    
    # Generate features
    bedrooms = np.random.randint(1, 6, n_samples)  # 1-5 bedrooms
    bathrooms = np.random.randint(1, 4, n_samples)  # 1-3 bathrooms
    sqft = np.random.randint(800, 4000, n_samples)  # 800-4000 sqft
    age = np.random.randint(0, 50, n_samples)  # 0-50 years old
    
    # Create realistic price based on features (with some noise)
    base_price = 50000
    price_per_bedroom = 25000
    price_per_bathroom = 15000
    price_per_sqft = 100
    age_depreciation = 1000
    
    prices = (base_price + 
             bedrooms * price_per_bedroom + 
             bathrooms * price_per_bathroom + 
             sqft * price_per_sqft - 
             age * age_depreciation +
             np.random.normal(0, 20000, n_samples))  # Add noise
    
    # Ensure no negative prices
    prices = np.maximum(prices, 50000)
    
    # Create DataFrame
    data = pd.DataFrame({
        'bedrooms': bedrooms,
        'bathrooms': bathrooms,
        'sqft': sqft,
        'age': age,
        'price': prices
    })
    
    return data

def train_model():
    """Train the house price prediction model"""
    print("🏠 Generating sample house data...")
    data = generate_sample_data(1000)
    
    print(f"📊 Dataset shape: {data.shape}")
    print("\n📈 Sample data:")
    print(data.head())
    
    print(f"\n💰 Price statistics:")
    print(f"  Mean: ${data['price'].mean():,.2f}")
    print(f"  Min:  ${data['price'].min():,.2f}")
    print(f"  Max:  ${data['price'].max():,.2f}")
    
    # Prepare features and target
    features = ['bedrooms', 'bathrooms', 'sqft', 'age']
    X = data[features]
    y = data['price']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\n🔄 Training model...")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")
    
    # Train model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Evaluate model
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"\n✅ Model trained successfully!")
    print(f"  R² Score: {r2:.4f}")
    print(f"  RMSE: ${np.sqrt(mse):,.2f}")
    
    # Save model
    model_filename = 'house_price_model.pkl'
    joblib.dump(model, model_filename)
    print(f"\n💾 Model saved as: {model_filename}")
    
    # Save feature names and model info
    model_info = {
        'model_type': 'LinearRegression',
        'features': features,
        'feature_descriptions': {
            'bedrooms': 'Number of bedrooms (1-5)',
            'bathrooms': 'Number of bathrooms (1-3)', 
            'sqft': 'Square footage (800-4000)',
            'age': 'Age of house in years (0-50)'
        },
        'target': 'price',
        'target_description': 'House price in USD',
        'performance': {
            'r2_score': float(r2),
            'rmse': float(np.sqrt(mse))
        },
        'sample_input': {
            'bedrooms': 3,
            'bathrooms': 2,
            'sqft': 1500,
            'age': 10
        }
    }
    
    with open('model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)
    
    print(f"📋 Model info saved as: model_info.json")
    
    # Test with sample prediction
    sample_house = [[3, 2, 1500, 10]]  # 3br, 2ba, 1500sqft, 10 years old
    sample_prediction = model.predict(sample_house)[0]
    print(f"\n🏡 Sample prediction:")
    print(f"  House: 3 bedrooms, 2 bathrooms, 1500 sqft, 10 years old")
    print(f"  Predicted price: ${sample_prediction:,.2f}")
    
    return model, model_info

if __name__ == "__main__":
    print("🚀 Starting ML Model Training")
    print("=" * 50)
    
    model, info = train_model()
    
    print("\n" + "=" * 50)
    print("✅ Training completed!")
    print("\nFiles created:")
    print("  📦 house_price_model.pkl - The trained model")
    print("  📋 model_info.json - Model metadata")
    print("\nNext steps:")
    print("  1. Run 'python test_model.py' to test the model")
    print("  2. Upload 'house_price_model.pkl' to your ML API dashboard")
    print("  3. Use the API endpoint to make predictions!")