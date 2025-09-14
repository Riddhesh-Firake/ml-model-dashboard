#!/usr/bin/env python3
"""
Test the trained house price prediction model
"""

import joblib
import json
import numpy as np

def load_model():
    """Load the trained model and info"""
    try:
        model = joblib.load('house_price_model.pkl')
        with open('model_info.json', 'r') as f:
            model_info = json.load(f)
        return model, model_info
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("Please run 'python train_model.py' first to create the model.")
        return None, None

def test_predictions(model, model_info):
    """Test the model with various house configurations"""
    
    print("🏠 Testing House Price Predictions")
    print("=" * 50)
    
    # Test cases: [bedrooms, bathrooms, sqft, age]
    test_cases = [
        {
            'description': 'Small starter home',
            'features': [2, 1, 900, 25],
        },
        {
            'description': 'Average family home',
            'features': [3, 2, 1500, 10],
        },
        {
            'description': 'Large luxury home',
            'features': [5, 3, 3500, 5],
        },
        {
            'description': 'Older compact home',
            'features': [2, 1, 1000, 40],
        },
        {
            'description': 'New modern home',
            'features': [4, 3, 2500, 2],
        }
    ]
    
    feature_names = model_info['features']
    
    for i, test_case in enumerate(test_cases, 1):
        features = test_case['features']
        description = test_case['description']
        
        # Make prediction
        prediction = model.predict([features])[0]
        
        print(f"\n🏡 Test {i}: {description}")
        for j, (name, value) in enumerate(zip(feature_names, features)):
            print(f"  {name}: {value}")
        print(f"  💰 Predicted price: ${prediction:,.2f}")

def interactive_prediction(model, model_info):
    """Allow user to input custom house features"""
    print("\n" + "=" * 50)
    print("🎯 Interactive Prediction")
    print("Enter house details to get a price prediction:")
    
    try:
        bedrooms = int(input("Number of bedrooms (1-5): "))
        bathrooms = int(input("Number of bathrooms (1-3): "))
        sqft = int(input("Square footage (800-4000): "))
        age = int(input("Age in years (0-50): "))
        
        features = [bedrooms, bathrooms, sqft, age]
        prediction = model.predict([features])[0]
        
        print(f"\n🏠 Your house:")
        print(f"  Bedrooms: {bedrooms}")
        print(f"  Bathrooms: {bathrooms}")
        print(f"  Square feet: {sqft:,}")
        print(f"  Age: {age} years")
        print(f"  💰 Predicted price: ${prediction:,.2f}")
        
    except (ValueError, KeyboardInterrupt):
        print("\n⏭️ Skipping interactive prediction")

def show_api_usage_example(model_info):
    """Show how to use this model via API"""
    print("\n" + "=" * 50)
    print("🚀 API Usage Example")
    print("After uploading to your ML API dashboard:")
    
    sample_input = model_info['sample_input']
    
    print(f"\nCURL example:")
    print(f"```bash")
    print(f"curl -X POST http://localhost:3000/api/models/YOUR_MODEL_ID/predict \\")
    print(f"  -H \"Content-Type: application/json\" \\")
    print(f"  -H \"X-API-Key: YOUR_API_KEY\" \\")
    print(f"  -d '{json.dumps(sample_input)}'")
    print(f"```")
    
    print(f"\nExpected response:")
    print(f"```json")
    print(f"{{")
    print(f"  \"prediction\": 285000.50,")
    print(f"  \"model_id\": \"your-model-id\",")
    print(f"  \"timestamp\": \"2025-01-01T12:00:00Z\"")
    print(f"}}")
    print(f"```")

if __name__ == "__main__":
    print("🧪 Testing Trained ML Model")
    
    # Load model
    model, model_info = load_model()
    if model is None:
        exit(1)
    
    # Show model info
    print(f"\n📊 Model Information:")
    print(f"  Type: {model_info['model_type']}")
    print(f"  R² Score: {model_info['performance']['r2_score']:.4f}")
    print(f"  RMSE: ${model_info['performance']['rmse']:,.2f}")
    
    # Run test predictions
    test_predictions(model, model_info)
    
    # Interactive prediction
    interactive_prediction(model, model_info)
    
    # Show API usage
    show_api_usage_example(model_info)
    
    print(f"\n✅ Testing completed!")
    print(f"Ready to upload 'house_price_model.pkl' to your ML API dashboard!")