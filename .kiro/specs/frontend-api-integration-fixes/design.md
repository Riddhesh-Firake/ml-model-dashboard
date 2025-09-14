# Design Document

## Overview

The frontend API integration issues stem from a fundamental routing problem where static file serving middleware is intercepting API requests before they reach the API route handlers. This causes all API endpoints to return HTML content (likely the index.html file) instead of JSON responses, breaking frontend functionality.

## Architecture

### Root Cause Analysis

The primary issue is in the Express.js middleware order in `src/app.ts`. Static file serving middleware is positioned before API route handlers, causing:

1. **Route Interception**: Static middleware catches `/api/*` requests and serves HTML files
2. **Content-Type Mismatch**: Responses have `text/html; charset=utf-8` instead of `application/json`
3. **Status Code Confusion**: Returns 200 OK with HTML content instead of proper API responses

### Current Problematic Flow

```
Request: GET /api/models
↓
Static File Middleware (serves index.html)
↓
Response: 200 OK, Content-Type: text/html
```

### Target Fixed Flow

```
Request: GET /api/models
↓
API Route Handlers
↓
Response: 200 OK, Content-Type: application/json
```

## Components and Interfaces

### 1. Express Middleware Order Fix

**Component**: `src/app.ts`
- **Issue**: Static middleware before API routes
- **Solution**: Reorder middleware to prioritize API routes
- **Interface**: Express middleware stack configuration

### 2. API Route Handler Verification

**Component**: API route files (`src/api/routes/*.ts`)
- **Issue**: Routes may not be properly registered
- **Solution**: Verify route registration and response headers
- **Interface**: Express Router with proper JSON responses

### 3. Frontend Request Handling

**Component**: `public/js/api.js`
- **Issue**: XMLHttpRequest state management
- **Solution**: Proper request initialization sequence
- **Interface**: Fetch API or XMLHttpRequest with correct headers

### 4. Navigation Context Binding

**Component**: `public/js/app-initializer.js`
- **Issue**: Method binding losing `this` context
- **Solution**: Proper method binding in constructor
- **Interface**: Event handlers with correct context

## Data Models

### API Response Format

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
```

### Error Response Format

```typescript
interface APIError {
  success: false;
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}
```

## Error Handling

### 1. Server-Side Error Handling

- **Route Not Found**: Return 404 with JSON error response
- **Internal Errors**: Return 500 with JSON error response
- **Validation Errors**: Return 400 with JSON error response

### 2. Client-Side Error Handling

- **Network Errors**: Display user-friendly messages
- **API Errors**: Parse JSON error responses and show details
- **Timeout Errors**: Implement retry logic with exponential backoff

### 3. Logging Strategy

- **Server Logs**: Log all API requests, responses, and errors
- **Client Logs**: Log API call attempts, successes, and failures
- **Debug Mode**: Enhanced logging for development environment

## Testing Strategy

### 1. Integration Tests

- **API Endpoint Tests**: Verify each endpoint returns proper JSON
- **Route Order Tests**: Confirm API routes take precedence over static files
- **Error Response Tests**: Validate error handling returns JSON

### 2. Frontend Tests

- **API Client Tests**: Mock API responses and test frontend handling
- **Navigation Tests**: Verify navigation handlers work without errors
- **Upload Tests**: Test file upload functionality end-to-end

### 3. Manual Testing

- **Browser Testing**: Use browser dev tools to verify API responses
- **Network Tab**: Monitor actual HTTP requests and responses
- **Console Logs**: Check for JavaScript errors and warnings

### 4. Automated Testing

- **Unit Tests**: Test individual components and functions
- **E2E Tests**: Test complete user workflows
- **API Tests**: Test API endpoints directly with tools like curl or Postman

## Implementation Priority

### Phase 1: Critical Fixes
1. Fix middleware order in `src/app.ts`
2. Verify API route registration
3. Test basic API endpoints

### Phase 2: Frontend Fixes
1. Fix XMLHttpRequest state issues
2. Fix navigation handler binding
3. Implement proper error handling

### Phase 3: Validation & Testing
1. Comprehensive testing of all endpoints
2. Frontend integration testing
3. Error scenario testing

## Success Criteria

- All API endpoints return JSON with proper Content-Type headers
- Frontend can successfully fetch and display data
- File uploads work without XMLHttpRequest errors
- Navigation works without "Illegal invocation" errors
- Comprehensive error handling and logging in place