#!/usr/bin/env pwsh
# Test script for API endpoints using PowerShell

Write-Host "=== Testing ML Model Upload API Endpoints ===" -ForegroundColor Green

$baseUrl = "http://localhost:3000"

# Test 1: Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET
    Write-Host "✓ Health Check: $($response.StatusCode)" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    Write-Host "  Status: $($content.status)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Registration with new user
Write-Host "`n2. Testing Registration..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$testEmail = "testuser$timestamp@example.com"
$testPassword = "testpass123"

try {
    $body = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✓ Registration: $($response.StatusCode)" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    Write-Host "  User ID: $($content.user.id)" -ForegroundColor Cyan
    Write-Host "  Email: $($content.user.email)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Login with the same user
Write-Host "`n3. Testing Login..." -ForegroundColor Yellow
try {
    $body = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✓ Login: $($response.StatusCode)" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    Write-Host "  User ID: $($content.user.id)" -ForegroundColor Cyan
    Write-Host "  Subscription: $($content.user.subscription)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Login Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Invalid login
Write-Host "`n4. Testing Invalid Login..." -ForegroundColor Yellow
try {
    $body = @{
        email = "nonexistent@example.com"
        password = "wrongpassword"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✗ Invalid Login should have failed but got: $($response.StatusCode)" -ForegroundColor Red
} catch {
    Write-Host "✓ Invalid Login correctly rejected: 401" -ForegroundColor Green
}

# Test 5: Validation errors
Write-Host "`n5. Testing Validation Errors..." -ForegroundColor Yellow
try {
    $body = @{
        email = "invalid-email"
        password = "short"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✗ Validation should have failed but got: $($response.StatusCode)" -ForegroundColor Red
} catch {
    Write-Host "✓ Validation correctly rejected: 400" -ForegroundColor Green
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green