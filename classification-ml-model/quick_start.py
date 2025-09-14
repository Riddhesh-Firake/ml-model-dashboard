#!/usr/bin/env python3
"""
Quick Start Script for Customer Churn Model

This script trains the model and generates a ready-to-upload .pkl file.
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages"""
    print("📦 Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Packages installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install packages: {e}")
        return False
    return True

def train_model():
    """Train the model"""
    print("🚀 Training customer churn model...")
    try:
        subprocess.check_call([sys.executable, "train_churn_model.py"])
        print("✅ Model trained successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to train model: {e}")
        return False

def verify_model():
    """Verify the model was created"""
    model_file = "customer_churn_model.pkl"
    if os.path.exists(model_file):
        file_size = os.path.getsize(model_file)
        print(f"✅ Model file created: {model_file} ({file_size:,} bytes)")
        return True
    else:
        print(f"❌ Model file not found: {model_file}")
        return False

def main():
    """Main execution"""
    print("🎯 Customer Churn Model - Quick Start")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("requirements.txt"):
        print("❌ Please run this script from the classification-ml-model directory")
        return
    
    # Install requirements
    if not install_requirements():
        return
    
    # Train model
    if not train_model():
        return
    
    # Verify model
    if not verify_model():
        return
    
    print("\n🎉 Success! Your model is ready!")
    print("📁 Files created:")
    print("   - customer_churn_model.pkl (upload this to your dashboard)")
    print("   - model_info.pkl (model metadata)")
    
    print("\n📤 Next steps:")
    print("1. Go to your ML Model Dashboard")
    print("2. Click 'Upload Model'")
    print("3. Upload the 'customer_churn_model.pkl' file")
    print("4. Use these sample inputs for testing:")
    
    print("\n🧪 Sample test data:")
    print("""
    High Risk Customer:
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
    
    Low Risk Customer:
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
    """)

if __name__ == "__main__":
    main()