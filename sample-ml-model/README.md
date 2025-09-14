# Sample ML Model for Testing

This directory contains a simple machine learning model that you can use to test your ML Model Upload API.

## What's included:
- `train_model.py` - Script to create and train a simple model
- `test_model.py` - Script to test the trained model locally
- `requirements.txt` - Python dependencies
- Generated model files (after running the training script)

## Quick Start:

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Train the model:
```bash
python train_model.py
```

3. Test the model locally:
```bash
python test_model.py
```

4. Upload the generated `.pkl` file to your ML API dashboard!

## Model Details:
- **Type**: Linear Regression
- **Purpose**: Predicts house prices based on features
- **Input**: JSON with features like `[bedrooms, bathrooms, sqft, age]`
- **Output**: Predicted price in dollars