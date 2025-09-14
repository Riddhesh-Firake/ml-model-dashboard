/**
 * Command-line test script for house prediction model
 * Run with: node test-house-model-api.js
 */

const http = require('http');

class HouseModelTester {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.modelId = null;
    }

    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(result);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${result.error?.message || body}`));
                        }
                    } catch (error) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(body);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                        }
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async findHouseModel() {
        console.log('🔍 Looking for house prediction models...');
        
        try {
            const models = await this.makeRequest('GET', '/api/models');
            console.log(`📋 Found ${models.length} total models`);

            // Look for house prediction models
            const houseModels = models.filter(model => 
                model.name.toLowerCase().includes('house') || 
                model.name.toLowerCase().includes('price') ||
                (model.description && model.description.toLowerCase().includes('house')) ||
                (model.description && model.description.toLowerCase().includes('price'))
            );

            if (houseModels.length === 0) {
                console.log('⚠️  No house prediction models found. Available models:');
                models.forEach((model, i) => {
                    console.log(`   ${i + 1}. ${model.name} (${model.format})`);
                });
                
                if (models.length > 0) {
                    console.log('🤔 Using the first available model for testing...');
                    this.modelId = models[0].id;
                    return models[0];
                } else {
                    throw new Error('No models available for testing');
                }
            }

            console.log(`🏠 Found ${houseModels.length} house prediction model(s):`);
            houseModels.forEach((model, i) => {
                console.log(`   ${i + 1}. ${model.name} (${model.format})`);
            });

            this.modelId = houseModels[0].id;
            return houseModels[0];

        } catch (error) {
            throw new Error(`Failed to load models: ${error.message}`);
        }
    }

    async testPrediction(features, description) {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`   Input: [${features.join(', ')}] (bedrooms, bathrooms, sqft, age)`);

        const inputFormats = [
            { features: features },
            { input: features },
            { data: features },
            features,
            { 
                bedrooms: features[0], 
                bathrooms: features[1], 
                sqft: features[2], 
                age: features[3] 
            }
        ];

        for (let i = 0; i < inputFormats.length; i++) {
            const inputFormat = inputFormats[i];
            
            try {
                console.log(`   Trying format ${i + 1}/${inputFormats.length}...`);
                const startTime = Date.now();
                
                const result = await this.makeRequest('POST', `/api/predict/${this.modelId}`, inputFormat);
                
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                const prediction = result.prediction || result.result || result;
                console.log(`   ✅ Success! Predicted price: $${typeof prediction === 'number' ? prediction.toLocaleString() : prediction}`);
                console.log(`   ⏱️  Response time: ${responseTime}ms`);
                
                return { prediction, responseTime, inputFormat };

            } catch (error) {
                console.log(`   ❌ Format ${i + 1} failed: ${error.message}`);
                
                if (i === inputFormats.length - 1) {
                    throw new Error(`All input formats failed. Last error: ${error.message}`);
                }
            }
        }
    }

    async runTestSuite() {
        console.log('🏠 House Prediction Model Test Suite');
        console.log('=' .repeat(50));

        try {
            // Find and select model
            const model = await this.findHouseModel();
            console.log(`\n✅ Selected model: ${model.name}`);
            console.log(`   ID: ${model.id}`);
            console.log(`   Format: ${model.format}`);
            console.log(`   Status: ${model.status}`);

            // Test cases
            const testCases = [
                {
                    features: [2, 1, 900, 25],
                    description: 'Small starter home (2 bed, 1 bath, 900 sqft, 25 years old)',
                    expectedRange: [150000, 250000]
                },
                {
                    features: [3, 2, 1500, 10],
                    description: 'Average family home (3 bed, 2 bath, 1500 sqft, 10 years old)',
                    expectedRange: [250000, 400000]
                },
                {
                    features: [5, 3, 3500, 5],
                    description: 'Large luxury home (5 bed, 3 bath, 3500 sqft, 5 years old)',
                    expectedRange: [500000, 800000]
                },
                {
                    features: [2, 1, 1000, 40],
                    description: 'Older compact home (2 bed, 1 bath, 1000 sqft, 40 years old)',
                    expectedRange: [120000, 200000]
                },
                {
                    features: [4, 3, 2500, 2],
                    description: 'New modern home (4 bed, 3 bath, 2500 sqft, 2 years old)',
                    expectedRange: [400000, 600000]
                }
            ];

            console.log('\n🧪 Running test cases...');
            
            const results = [];
            let successCount = 0;
            let totalResponseTime = 0;

            for (const testCase of testCases) {
                try {
                    const result = await this.testPrediction(testCase.features, testCase.description);
                    
                    const prediction = typeof result.prediction === 'number' ? result.prediction : parseFloat(result.prediction);
                    const inRange = prediction >= testCase.expectedRange[0] && prediction <= testCase.expectedRange[1];
                    
                    console.log(`   📊 Expected range: $${testCase.expectedRange[0].toLocaleString()} - $${testCase.expectedRange[1].toLocaleString()}`);
                    console.log(`   ${inRange ? '✅' : '⚠️ '} ${inRange ? 'Within expected range' : 'Outside expected range'}`);
                    
                    results.push({
                        ...testCase,
                        prediction,
                        responseTime: result.responseTime,
                        success: true,
                        inRange
                    });
                    
                    successCount++;
                    totalResponseTime += result.responseTime;

                } catch (error) {
                    console.log(`   ❌ Test failed: ${error.message}`);
                    results.push({
                        ...testCase,
                        error: error.message,
                        success: false
                    });
                }
            }

            // Performance test
            console.log('\n⚡ Running performance test...');
            const perfTestCount = 5;
            const perfFeatures = [3, 2, 1500, 10];
            const perfTimes = [];

            for (let i = 0; i < perfTestCount; i++) {
                try {
                    const result = await this.testPrediction(perfFeatures, `Performance test ${i + 1}/${perfTestCount}`);
                    perfTimes.push(result.responseTime);
                } catch (error) {
                    console.log(`   ❌ Performance test ${i + 1} failed: ${error.message}`);
                }
            }

            // Summary
            console.log('\n📊 Test Summary');
            console.log('=' .repeat(50));
            console.log(`✅ Successful tests: ${successCount}/${testCases.length}`);
            console.log(`📈 Success rate: ${((successCount / testCases.length) * 100).toFixed(1)}%`);
            
            if (successCount > 0) {
                const avgResponseTime = totalResponseTime / successCount;
                console.log(`⏱️  Average response time: ${avgResponseTime.toFixed(2)}ms`);
            }

            if (perfTimes.length > 0) {
                const avgPerfTime = perfTimes.reduce((a, b) => a + b, 0) / perfTimes.length;
                const minTime = Math.min(...perfTimes);
                const maxTime = Math.max(...perfTimes);
                
                console.log(`🚀 Performance test results:`);
                console.log(`   Average: ${avgPerfTime.toFixed(2)}ms`);
                console.log(`   Fastest: ${minTime}ms`);
                console.log(`   Slowest: ${maxTime}ms`);
                console.log(`   Throughput: ${(1000 / avgPerfTime).toFixed(2)} predictions/second`);
            }

            // Predictions in range
            const inRangeCount = results.filter(r => r.success && r.inRange).length;
            const successfulTests = results.filter(r => r.success).length;
            
            if (successfulTests > 0) {
                console.log(`🎯 Predictions in expected range: ${inRangeCount}/${successfulTests} (${((inRangeCount / successfulTests) * 100).toFixed(1)}%)`);
            }

            console.log('\n🎉 Test suite completed!');

            if (successCount === testCases.length && inRangeCount >= successfulTests * 0.8) {
                console.log('✅ Your house prediction model is working excellently!');
            } else if (successCount >= testCases.length * 0.8) {
                console.log('⚠️  Your model is working but some predictions may be outside expected ranges.');
            } else {
                console.log('❌ Your model needs attention - many tests failed.');
            }

        } catch (error) {
            console.error(`❌ Test suite failed: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run the test suite
if (require.main === module) {
    const tester = new HouseModelTester();
    tester.runTestSuite().catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = HouseModelTester;