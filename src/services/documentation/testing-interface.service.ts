import { ModelMetadata } from '../../models/model.model';
import { DocumentationService } from './documentation.service';
import { InferenceService } from '../inference';

export interface TestingInterfaceConfig {
  modelId: string;
  name: string;
  description: string;
  inputSchema: any;
  examples: any[];
  endpointUrl: string;
}

export class TestingInterfaceService {
  constructor(
    private documentationService: DocumentationService,
    private inferenceService: InferenceService
  ) {}

  /**
   * Generate testing interface configuration for a model
   */
  async generateTestingInterface(model: ModelMetadata): Promise<TestingInterfaceConfig> {
    try {
      const documentation = await this.documentationService.generateModelDocumentation(model);

      return {
        modelId: model.id,
        name: model.name,
        description: documentation.description,
        inputSchema: documentation.inputSchema,
        examples: documentation.examples.map(ex => ex.request),
        endpointUrl: documentation.endpointUrl
      };
    } catch (error) {
      console.error(`Error generating testing interface for model ${model.id}:`, error);
      throw new Error(`Failed to generate testing interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML for the testing interface
   */
  generateTestingInterfaceHTML(config: TestingInterfaceConfig, userToken?: string): string {
    const examplesJson = JSON.stringify(config.examples, null, 2);
    const schemaJson = JSON.stringify(config.inputSchema, null, 2);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name} - Model Testing Interface</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }

        .header p {
            color: #666;
            font-size: 16px;
        }

        .endpoint-info {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }

        .endpoint-info code {
            background: #fff;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
        }

        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        .panel {
            background: white;
            border-radius: 8px;
            padding: 25px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .panel h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 20px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #555;
        }

        .form-control {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            font-family: 'Monaco', 'Menlo', monospace;
        }

        .form-control:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }

        textarea.form-control {
            min-height: 200px;
            resize: vertical;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .btn-primary {
            background: #007bff;
            color: white;
        }

        .btn-primary:hover {
            background: #0056b3;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
            margin-left: 10px;
        }

        .btn-secondary:hover {
            background: #545b62;
        }

        .btn-example {
            background: #28a745;
            color: white;
            margin: 5px;
            padding: 8px 16px;
            font-size: 12px;
        }

        .btn-example:hover {
            background: #1e7e34;
        }

        .examples-section {
            margin-bottom: 20px;
        }

        .examples-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }

        .response-section {
            margin-top: 20px;
        }

        .response-success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
        }

        .response-error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
        }

        .response-loading {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
        }

        .response-content {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-top: 10px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            overflow-x: auto;
        }

        .schema-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .schema-section h3 {
            margin-bottom: 10px;
            color: #495057;
        }

        .schema-content {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            color: #666;
        }

        .auth-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .auth-section h3 {
            color: #856404;
            margin-bottom: 10px;
        }

        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .validation-error {
            color: #dc3545;
            font-size: 12px;
            margin-top: 5px;
        }

        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.name}</h1>
            <p>${config.description}</p>
            <div class="endpoint-info">
                <strong>Endpoint:</strong> <code>${config.endpointUrl}</code>
            </div>
        </div>

        <div class="main-content">
            <div class="panel">
                <h2>Test Your Model</h2>
                
                <div class="auth-section">
                    <h3>Authentication</h3>
                    <div class="form-group">
                        <label for="authToken">JWT Token or API Key:</label>
                        <input type="text" id="authToken" class="form-control" 
                               placeholder="Bearer token or API key" 
                               value="${userToken || ''}">
                        <small>Get your token from <a href="/api/auth/login" target="_blank">login</a> or <a href="/api/keys" target="_blank">API keys</a></small>
                    </div>
                </div>

                <div class="examples-section">
                    <label>Quick Examples:</label>
                    <div class="examples-grid" id="examplesGrid">
                        <!-- Examples will be populated by JavaScript -->
                    </div>
                </div>

                <div class="form-group">
                    <label for="inputData">Input Data (JSON):</label>
                    <textarea id="inputData" class="form-control" 
                              placeholder="Enter your input data as JSON..."></textarea>
                    <div id="inputValidation" class="validation-error"></div>
                </div>

                <div class="form-group">
                    <button id="testButton" class="btn btn-primary">
                        Test Model
                    </button>
                    <button id="validateButton" class="btn btn-secondary">
                        Validate Input
                    </button>
                </div>

                <div id="responseSection" class="response-section" style="display: none;">
                    <h3>Response</h3>
                    <div id="responseStatus"></div>
                    <div id="responseContent" class="response-content"></div>
                </div>
            </div>

            <div class="panel">
                <h2>Model Information</h2>
                
                <div class="schema-section">
                    <h3>Input Schema</h3>
                    <div class="schema-content" id="inputSchema"></div>
                </div>

                <div class="form-group">
                    <h3>Usage Examples</h3>
                    <div class="form-group">
                        <label>cURL:</label>
                        <textarea class="form-control" readonly id="curlExample" style="height: 120px;"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>JavaScript:</label>
                        <textarea class="form-control" readonly id="jsExample" style="height: 150px;"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Python:</label>
                        <textarea class="form-control" readonly id="pythonExample" style="height: 150px;"></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration data
        const config = {
            modelId: '${config.modelId}',
            endpointUrl: '${config.endpointUrl}',
            examples: ${examplesJson},
            schema: ${schemaJson}
        };

        // DOM elements
        const authTokenInput = document.getElementById('authToken');
        const inputDataTextarea = document.getElementById('inputData');
        const testButton = document.getElementById('testButton');
        const validateButton = document.getElementById('validateButton');
        const responseSection = document.getElementById('responseSection');
        const responseStatus = document.getElementById('responseStatus');
        const responseContent = document.getElementById('responseContent');
        const inputValidation = document.getElementById('inputValidation');
        const examplesGrid = document.getElementById('examplesGrid');
        const inputSchema = document.getElementById('inputSchema');

        // Initialize interface
        function initializeInterface() {
            // Display schema
            inputSchema.textContent = JSON.stringify(config.schema, null, 2);
            
            // Create example buttons
            config.examples.forEach((example, index) => {
                const button = document.createElement('button');
                button.className = 'btn btn-example';
                button.textContent = \`Example \${index + 1}\`;
                button.onclick = () => loadExample(example);
                examplesGrid.appendChild(button);
            });

            // Generate usage examples
            generateUsageExamples();
            
            // Load first example by default
            if (config.examples.length > 0) {
                loadExample(config.examples[0]);
            }
        }

        function loadExample(example) {
            inputDataTextarea.value = JSON.stringify(example, null, 2);
            validateInput();
        }

        function validateInput() {
            const inputText = inputDataTextarea.value.trim();
            inputValidation.textContent = '';
            
            if (!inputText) {
                inputValidation.textContent = 'Input data is required';
                return false;
            }

            try {
                JSON.parse(inputText);
                return true;
            } catch (error) {
                inputValidation.textContent = 'Invalid JSON format: ' + error.message;
                return false;
            }
        }

        function getAuthHeaders() {
            const token = authTokenInput.value.trim();
            if (!token) {
                throw new Error('Authentication token is required');
            }

            // Determine if it's a JWT token or API key
            if (token.startsWith('Bearer ') || token.includes('.')) {
                return { 'Authorization': token.startsWith('Bearer ') ? token : \`Bearer \${token}\` };
            } else {
                return { 'X-API-Key': token };
            }
        }

        async function testModel() {
            if (!validateInput()) {
                return;
            }

            const inputData = JSON.parse(inputDataTextarea.value);
            
            try {
                const headers = getAuthHeaders();
                
                showLoading('Testing model...');
                
                const response = await fetch(config.endpointUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    },
                    body: JSON.stringify(inputData)
                });

                const result = await response.json();
                
                if (response.ok) {
                    showSuccess('Prediction successful!', result);
                } else {
                    showError('Prediction failed', result);
                }
            } catch (error) {
                showError('Request failed', { error: error.message });
            }
        }

        async function validateInputData() {
            if (!validateInput()) {
                return;
            }

            const inputData = JSON.parse(inputDataTextarea.value);
            
            try {
                const headers = getAuthHeaders();
                
                showLoading('Validating input...');
                
                const response = await fetch(\`\${config.endpointUrl}/validate\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    },
                    body: JSON.stringify(inputData)
                });

                const result = await response.json();
                
                if (response.ok) {
                    if (result.isValid) {
                        showSuccess('Input data is valid!', result);
                    } else {
                        showError('Input data is invalid', result);
                    }
                } else {
                    showError('Validation failed', result);
                }
            } catch (error) {
                showError('Validation request failed', { error: error.message });
            }
        }

        function showLoading(message) {
            responseSection.style.display = 'block';
            responseStatus.className = 'response-loading';
            responseStatus.innerHTML = \`<span class="loading-spinner"></span>\${message}\`;
            responseContent.textContent = '';
        }

        function showSuccess(message, data) {
            responseSection.style.display = 'block';
            responseStatus.className = 'response-success';
            responseStatus.textContent = message;
            responseContent.textContent = JSON.stringify(data, null, 2);
        }

        function showError(message, data) {
            responseSection.style.display = 'block';
            responseStatus.className = 'response-error';
            responseStatus.textContent = message;
            responseContent.textContent = JSON.stringify(data, null, 2);
        }

        function generateUsageExamples() {
            const sampleInput = config.examples[0] || { input: 'example_value' };
            const inputJson = JSON.stringify(sampleInput);
            
            // cURL example
            document.getElementById('curlExample').value = \`curl -X POST "\${config.endpointUrl}" \\\\
  -H "Content-Type: application/json" \\\\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\\\
  -d '\${inputJson}'\`;

            // JavaScript example
            document.getElementById('jsExample').value = \`const response = await fetch('\${config.endpointUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify(\${JSON.stringify(sampleInput, null, 2)})
});

const result = await response.json();
console.log(result);\`;

            // Python example
            document.getElementById('pythonExample').value = \`import requests

url = "\${config.endpointUrl}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_JWT_TOKEN"
}
data = \${JSON.stringify(sampleInput, null, 2)}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)\`;
        }

        // Event listeners
        testButton.addEventListener('click', testModel);
        validateButton.addEventListener('click', validateInputData);
        inputDataTextarea.addEventListener('input', validateInput);

        // Initialize the interface
        initializeInterface();
    </script>
</body>
</html>`;
  }

  /**
   * Validate input data against model schema
   */
  validateInputAgainstSchema(inputData: any, schema: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema || !schema.properties) {
      return { isValid: true, errors: [] };
    }

    // Check required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in inputData)) {
          errors.push(`Missing required field: ${requiredField}`);
        }
      }
    }

    // Validate field types
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const fieldValue = inputData[fieldName];
      const fieldDef = fieldSchema as any;

      if (fieldValue !== undefined) {
        const validationError = this.validateFieldType(fieldName, fieldValue, fieldDef);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateFieldType(fieldName: string, value: any, schema: any): string | null {
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Field '${fieldName}' must be a string`;
        }
        if (schema.enum && !schema.enum.includes(value)) {
          return `Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`;
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          return `Field '${fieldName}' must be a number`;
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          return `Field '${fieldName}' must be >= ${schema.minimum}`;
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          return `Field '${fieldName}' must be <= ${schema.maximum}`;
        }
        break;

      case 'integer':
        if (!Number.isInteger(value)) {
          return `Field '${fieldName}' must be an integer`;
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          return `Field '${fieldName}' must be >= ${schema.minimum}`;
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          return `Field '${fieldName}' must be <= ${schema.maximum}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Field '${fieldName}' must be a boolean`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `Field '${fieldName}' must be an array`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `Field '${fieldName}' must be an object`;
        }
        break;
    }

    return null;
  }
}