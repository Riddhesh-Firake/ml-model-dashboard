/**
 * Script to add sample model data for testing the frontend
 */

const sampleModels = [
    {
        id: 'model-1',
        name: 'Customer Churn Predictor',
        description: 'Predicts customer churn based on usage patterns and demographics',
        format: 'pkl',
        status: 'active',
        fileSize: 2048576, // 2MB
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        requestCount: 1247,
        successfulRequests: 1198,
        avgResponseTime: 145,
        endpointUrl: 'http://localhost:3000/api/predict/model-1'
    },
    {
        id: 'model-2',
        name: 'Sales Forecasting Model',
        description: 'Time series forecasting model for monthly sales predictions',
        format: 'h5',
        status: 'active',
        fileSize: 5242880, // 5MB
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
        lastUsed: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        requestCount: 892,
        successfulRequests: 876,
        avgResponseTime: 234,
        endpointUrl: 'http://localhost:3000/api/predict/model-2'
    },
    {
        id: 'model-3',
        name: 'Image Classification CNN',
        description: 'Convolutional neural network for product image classification',
        format: 'onnx',
        status: 'inactive',
        fileSize: 15728640, // 15MB
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        requestCount: 456,
        successfulRequests: 445,
        avgResponseTime: 567,
        endpointUrl: 'http://localhost:3000/api/predict/model-3'
    },
    {
        id: 'model-4',
        name: 'Sentiment Analysis BERT',
        description: 'BERT-based model for customer review sentiment analysis',
        format: 'pt',
        status: 'active',
        fileSize: 438291456, // 418MB
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        lastUsed: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        requestCount: 2341,
        successfulRequests: 2298,
        avgResponseTime: 89,
        endpointUrl: 'http://localhost:3000/api/predict/model-4'
    },
    {
        id: 'model-5',
        name: 'Fraud Detection XGBoost',
        description: 'XGBoost model for real-time fraud detection in transactions',
        format: 'joblib',
        status: 'active',
        fileSize: 1048576, // 1MB
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        lastUsed: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        requestCount: 3456,
        successfulRequests: 3401,
        avgResponseTime: 67,
        endpointUrl: 'http://localhost:3000/api/predict/model-5'
    }
];

// Store sample data in localStorage for the frontend to use
localStorage.setItem('sample_models', JSON.stringify(sampleModels));

console.log('✅ Sample model data added to localStorage');
console.log('📊 Added', sampleModels.length, 'sample models');

// Also create sample user stats
const sampleUserStats = {
    totalRequests: sampleModels.reduce((sum, model) => sum + model.requestCount, 0),
    avgResponseTime: Math.round(sampleModels.reduce((sum, model) => sum + model.avgResponseTime, 0) / sampleModels.length),
    successfulRequests: sampleModels.reduce((sum, model) => sum + model.successfulRequests, 0),
    errorCount: sampleModels.reduce((sum, model) => sum + (model.requestCount - model.successfulRequests), 0)
};

localStorage.setItem('sample_user_stats', JSON.stringify(sampleUserStats));

console.log('✅ Sample user stats added to localStorage');
console.log('📈 Stats:', sampleUserStats);