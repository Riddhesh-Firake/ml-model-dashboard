#!/usr/bin/env python3
"""
Quick start script - trains and tests the model in one go
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully!")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed!")
        print(f"Error: {e.stderr}")
        return False

def check_python_packages():
    """Check if required packages are installed"""
    required_packages = ['sklearn', 'pandas', 'numpy', 'joblib']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        print(f"Installing required packages...")
        if not run_command("pip install -r requirements.txt", "Installing dependencies"):
            return False
    else:
        print("✅ All required packages are installed!")
    
    return True

def main():
    print("🚀 ML Model Quick Start")
    print("=" * 50)
    print("This script will:")
    print("1. Check/install Python dependencies")
    print("2. Train a house price prediction model")
    print("3. Test the model with sample data")
    print("4. Generate files ready for upload")
    
    # Check if we're in the right directory
    if not os.path.exists('train_model.py'):
        print("❌ Error: Please run this script from the sample-ml-model directory")
        sys.exit(1)
    
    # Check Python packages
    if not check_python_packages():
        print("❌ Failed to install dependencies")
        sys.exit(1)
    
    # Train model
    if not run_command("python train_model.py", "Training model"):
        sys.exit(1)
    
    # Test model
    if not run_command("python test_model.py", "Testing model"):
        print("⚠️ Testing failed, but model was created successfully")
    
    print("\n" + "=" * 50)
    print("🎉 Quick start completed!")
    print("\nFiles created:")
    print("  📦 house_price_model.pkl - Upload this to your ML API")
    print("  📋 model_info.json - Model metadata")
    
    print("\nNext steps:")
    print("1. Go to your ML API dashboard (http://localhost:3000)")
    print("2. Click 'Upload' in the navigation")
    print("3. Upload the 'house_price_model.pkl' file")
    print("4. Test predictions via the API!")
    
    print(f"\n💡 Sample API input format:")
    print(f"{{")
    print(f"  \"bedrooms\": 3,")
    print(f"  \"bathrooms\": 2,")
    print(f"  \"sqft\": 1500,")
    print(f"  \"age\": 10")
    print(f"}}")

if __name__ == "__main__":
    main()