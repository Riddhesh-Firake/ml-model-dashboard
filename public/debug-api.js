function getCacheBuster() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

document.getElementById('cacheBuster').textContent = getCacheBuster();

async function testEndpoint(name, url, options = {}) {
    const resultsDiv = document.getElementById('results');
    const cacheBuster = getCacheBuster();
    const separator = url.includes('?') ? '&' : '?';
    const urlWithCacheBuster = `${url}${separator}_cb=${cacheBuster}`;
    
    try {
        const fetchOptions = {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            },
            ...options
        };
        
        const response = await fetch(urlWithCacheBuster, fetchOptions);
        const contentType = response.headers.get('content-type');
        
        let result = {
            name,
            url: urlWithCacheBuster,
            status: response.status,
            contentType,
            ok: response.ok
        };
        
        if (contentType && contentType.includes('application/json')) {
            result.data = await response.json();
            result.isJson = true;
        } else {
            const text = await response.text();
            result.data = text.substring(0, 300);
            result.isJson = false;
            result.isHtml = text.includes('<!DOCTYPE html>');
        }
        
        displayResult(result);
        return result;
        
    } catch (error) {
        const result = {
            name,
            url: urlWithCacheBuster,
            error: error.message,
            failed: true
        };
        displayResult(result);
        return result;
    }
}

function displayResult(result) {
    const resultsDiv = document.getElementById('results');
    const div = document.createElement('div');
    
    let className = 'info';
    if (result.failed) {
        className = 'error';
    } else if (result.ok && result.isJson) {
        className = 'success';
    } else if (result.isHtml) {
        className = 'error';
    }
    
    div.className = `test-result ${className}`;
    
    let html = `<h3>${result.name}</h3>`;
    html += `<p><strong>URL:</strong> ${result.url}</p>`;
    
    if (result.failed) {
        html += `<p><strong>Error:</strong> ${result.error}</p>`;
    } else {
        html += `<p><strong>Status:</strong> ${result.status}</p>`;
        html += `<p><strong>Content-Type:</strong> ${result.contentType}</p>`;
        html += `<p><strong>Is JSON:</strong> ${result.isJson ? '✅ Yes' : '❌ No'}</p>`;
        
        if (result.isHtml) {
            html += `<p><strong>⚠️ WARNING:</strong> Received HTML instead of JSON!</p>`;
        }
        
        if (result.isJson) {
            html += `<pre>${JSON.stringify(result.data, null, 2)}</pre>`;
        } else {
            html += `<pre>${result.data}...</pre>`;
        }
    }
    
    div.innerHTML = html;
    resultsDiv.appendChild(div);
}

async function testAllEndpoints() {
    clearResults();
    
    const endpoints = [
        { name: 'API Test', url: '/api/test' },
        { name: 'Models List', url: '/api/models' },
        { name: 'User Stats', url: '/api/monitoring/user/stats' },
        { name: 'Health Check', url: '/health' },
        { name: 'API Info', url: '/api' }
    ];
    
    for (const endpoint of endpoints) {
        await testEndpoint(endpoint.name, endpoint.url);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function testRegistration() {
    const testData = {
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123'
    };
    
    await testEndpoint('Registration Test', '/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
    });
}

function clearResults() {
    document.getElementById('results').innerHTML = '';
    document.getElementById('cacheBuster').textContent = getCacheBuster();
}

// Event listeners
document.getElementById('testAllBtn').addEventListener('click', testAllEndpoints);
document.getElementById('testRegBtn').addEventListener('click', testRegistration);
document.getElementById('clearBtn').addEventListener('click', clearResults);

// Auto-test on page load
window.addEventListener('load', () => {
    setTimeout(testAllEndpoints, 500);
});