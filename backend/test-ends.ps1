# ============================================================================
# ENDPOINT TESTER - GAMMA TRACKER (Windows - FIXED)
# ============================================================================
# 
# Testa TODOS os endpoints do backend
# Mostra quais funcionam e quais estao quebrados
#
# Uso: .\test_endpoints.ps1
# ============================================================================

$API_BASE = "http://localhost:3300/api"

Write-Host "============================================================================"
Write-Host "  GAMMA TRACKER - ENDPOINT TESTER"
Write-Host "============================================================================"
Write-Host ""

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET"
    )
    
    Write-Host -NoNewline ("{0,-40}" -f $Name)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        
        if ($statusCode -eq 200) {
            Write-Host "OK ($statusCode)" -ForegroundColor Green
        } else {
            Write-Host "UNKNOWN ($statusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 503) {
            Write-Host "NOT READY ($statusCode)" -ForegroundColor Yellow
        } else {
            Write-Host "FAILED ($statusCode)" -ForegroundColor Red
            
            # Try to get error message
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                $errorJson = $errorBody | ConvertFrom-Json
                if ($errorJson.error) {
                    Write-Host "   Error: $($errorJson.error)" -ForegroundColor Red
                }
            } catch {
                # Silent fail
            }
        }
    }
}

Write-Host "[CORE] TESTING CORE ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Health Check" "$API_BASE/../health"
Test-Endpoint "Status" "$API_BASE/status"
Test-Endpoint "Metrics" "$API_BASE/metrics"
Test-Endpoint "Insights" "$API_BASE/insights"
Write-Host ""

Write-Host "[GAMMA] TESTING GAMMA ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Gamma Profile" "$API_BASE/gamma-profile"
Test-Endpoint "Total GEX" "$API_BASE/total-gex"
Test-Endpoint "Gamma Flip" "$API_BASE/gamma-flip"
Test-Endpoint "Walls" "$API_BASE/walls"
Test-Endpoint "Wall Zones" "$API_BASE/wall-zones"
Write-Host ""

Write-Host "[VOL] TESTING VOLATILITY ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Vol Surface" "$API_BASE/vol-surface"
Test-Endpoint "Vol Skew" "$API_BASE/vol-skew"
Test-Endpoint "Anomalies (default)" "$API_BASE/vol-anomalies"
Test-Endpoint "Anomalies (filtered)" "$API_BASE/vol-anomalies?threshold=2.0`&limit=50`&severity=HIGH`&type=IV_OUTLIER"
Write-Host ""

Write-Host "[STRATEGY] TESTING STRATEGY ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Strategies Recommend" "$API_BASE/strategies/recommend?topN=5`&minScore=0"
Test-Endpoint "Strategies All" "$API_BASE/strategies/all"
Test-Endpoint "Strategy Detail" "$API_BASE/strategies/iron-condor"
Write-Host ""

Write-Host "[ESCAPE] TESTING ESCAPE DETECTION..."
Write-Host "----------------------------------------"
Test-Endpoint "Escape Detect" "$API_BASE/escape/detect"
Test-Endpoint "Escape Energy" "$API_BASE/escape/energy"
Test-Endpoint "Escape History" "$API_BASE/escape/history"
Write-Host ""

Write-Host "[LIQUIDATIONS] TESTING LIQUIDATIONS..."
Write-Host "----------------------------------------"
Test-Endpoint "Liquidations Summary" "$API_BASE/liquidations/summary"
Test-Endpoint "Liquidations Heatmap" "$API_BASE/liquidations/heatmap"
Write-Host ""

Write-Host "[ENTROPY] TESTING ENTROPY & MARKET..."
Write-Host "----------------------------------------"
Test-Endpoint "Entropy Current" "$API_BASE/entropy/current"
Test-Endpoint "Entropy History" "$API_BASE/entropy/history"
Test-Endpoint "RSI Current" "$API_BASE/rsi/current"
Test-Endpoint "Market Analysis" "$API_BASE/market/analysis"
Write-Host ""

Write-Host "[SENTIMENT] TESTING SENTIMENT..."
Write-Host "----------------------------------------"
Test-Endpoint "Sentiment" "$API_BASE/sentiment"
Test-Endpoint "Max Pain" "$API_BASE/max-pain"
Test-Endpoint "Put/Call Ratio" "$API_BASE/pcr"
Write-Host ""

Write-Host "[IV] TESTING IV COMPARISON..."
Write-Host "----------------------------------------"
Test-Endpoint "IV Comparison" "$API_BASE/iv/comparison"
Test-Endpoint "Retail Panic Index" "$API_BASE/iv/retail-panic"
Write-Host ""

Write-Host "[HISTORICAL] TESTING HISTORICAL..."
Write-Host "----------------------------------------"
Test-Endpoint "Historical Snapshots" "$API_BASE/market-history"
Test-Endpoint "Historical Anomalies" "$API_BASE/historical/anomalies?limit=10"
Write-Host ""

Write-Host "============================================================================"
Write-Host "Testing complete!"
Write-Host "============================================================================"