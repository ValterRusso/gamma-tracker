# ============================================================================
# ENDPOINT TESTER - GAMMA TRACKER (Windows - FIXED)
# ============================================================================
# 
# Testa TODOS os endpoints do backend
# Mostra quais funcionam e quais estao quebrados
#
# Uso: .\test_ends.ps1
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

Write-Host "[OPTIONS] TESTING OPTIONS DATA..."
Write-Host "----------------------------------------"
Test-Endpoint "List all Options" "$API_BASE/options"
Test-Endpoint "By Strike" "$API_BASE/options/strike/90000"
Test-Endpoint "Unique strikes" "$API_BASE/strikes"
Test-Endpoint "Unique Expires" "$API_BASE/expiries"
Write-Host ""

Write-Host "[VOL] TESTING VOLATILITY ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Vol Surface" "$API_BASE/vol-surface"
Test-Endpoint "Anomalies (default)" "$API_BASE/anomalies"
Test-Endpoint "Anomalies (filtered)" "$API_BASE/anomalies?threshold=2.0`&limit=50`&severity=HIGH`&type=IV_OUTLIER"
Write-Host ""

Write-Host "[STRATEGY] TESTING STRATEGY ENDPOINTS..."
Write-Host "----------------------------------------"
Test-Endpoint "Strategies Recommend" "$API_BASE/strategies/recommend?topN=5`&minScore=0"
Test-Endpoint "Strategies All" "$API_BASE/strategies/all"
Test-Endpoint "Strategy Detail" "$API_BASE/strategies/iron_condor"
Write-Host ""

Write-Host "[ESCAPE] TESTING ESCAPE DETECTION..."
Write-Host "----------------------------------------"
Test-Endpoint "Escape Detect" "$API_BASE/escape/detect"
Test-Endpoint "Escape probability" "$API_BASE/escape/probability"
Test-Endpoint "Escape conditions" "$API_BASE/escape/conditions"
Test-Endpoint "Escape summary" "$API_BASE/escape/summary"
Test-Endpoint "Escape active alerts" "$API_BASE/escape/detect"
Test-Endpoint "Escape Energy" "$API_BASE/escape/energy"
Test-Endpoint "Escape History" "$API_BASE/escape/history"
Write-Host ""

Write-Host "[LIQUIDATIONS] TESTING LIQUIDATIONS..."
Write-Host "----------------------------------------"
Test-Endpoint "Liquidations Summary" "$API_BASE/liquidations/summary"
Test-Endpoint "Liquidations Stats" "$API_BASE/liquidations/stats"
Test-Endpoint "Liquidations Energy" "$API_BASE/liquidations/energy"
Test-Endpoint "Liquidations Recent" "$API_BASE/liquidations/recent"
Test-Endpoint "Liquidations Early" "$API_BASE/liquidations/early"
Test-Endpoint "Liquidations Growth" "$API_BASE/liquidations/growth"
Test-Endpoint "Liquidations Cascade" "$API_BASE/liquidations/cascade"
Write-Host ""

Write-Host "[ORDERBOOK] TESTING ORDERBOOK..."
Write-Host "----------------------------------------"
Test-Endpoint "Orderbiik metrics" "$API_BASE/orderbook/metrics"
Test-Endpoint "Orderbook Imbalance" "$API_BASE/orderbook/imbalance"
Test-Endpoint "Orderbook depth" "$API_BASE/orderbook/depth"
Test-Endpoint "Orderbook spread" "$API_BASE/orderbook/spread"
Test-Endpoint "Orderbook walls" "$API_BASE/orderbook/walls"
Test-Endpoint "Orderbook energy" "$API_BASE/orderbook/energy"
Test-Endpoint "Orderbook history" "$API_BASE/orderbook/history"
Write-Host ""


Write-Host "[ENTROPY] TESTING ENTROPY..."
Write-Host "----------------------------------------"
Test-Endpoint "Entropy Current + RSI" "$API_BASE/entropy-rsi"
Test-Endpoint "Entropy Stats" "$API_BASE/entropy/stats"
Test-Endpoint "Entropy Events" "$API_BASE/entropy/events"
Test-Endpoint "Entropy history" "$API_BASE/entropy/history"
Test-Endpoint "Entropy divergence" "$API_BASE/entropy/divergence"
Test-Endpoint "Entropy depth" "$API_BASE/entropy/depth"
Test-Endpoint "Entropy Assets" "$API_BASE/entropy/assets"
Test-Endpoint "RSI + Volume" "$API_BASE/rsi"
Test-Endpoint "volume trend" "$API_BASE/volume"
Test-Endpoint "Todas divergencias" "$API_BASE/divergences"
Write-Host ""

Write-Host "[SENTIMENT] TESTING SENTIMENT..."
Write-Host "----------------------------------------"
Test-Endpoint "Sentiment" "$API_BASE/sentiment"
Test-Endpoint "Max Pain" "$API_BASE/max-pain"
Write-Host ""

Write-Host "[IV] TESTING IV COMPARISON..."
Write-Host "----------------------------------------"
Test-Endpoint "IV Comparison" "$API_BASE/iv-comparison/1"
Test-Endpoint "history" "$API_BASE/iv-compare/history"
Test-Endpoint "multiple" "$API_BASE/iv-compare/multiple"
Test-Endpoint "Stats" "$API_BASE/iv-compare/stats"
Test-Endpoint "Retail Panic Index" "$API_BASE/retail-panic-index"
Test-Endpoint "IV Surface Binance" "$API_BASE/binance/iv-surface"
Test-Endpoint "Metrics by dte" "$API_BASE/binance/iv-metrics/1"
Test-Endpoint "Adapter stats" "$API_BASE/binance/stats"
Test-Endpoint "IV Surface Deribit" "$API_BASE/deribit/iv-surface"
Test-Endpoint "Metrics Deribit by dte" "$API_BASE/deribit/iv-metrics/1"
Test-Endpoint "Retail Panic Index" "$API_BASE/retail-panic-index"
Write-Host ""

Write-Host "[MARKET ANALYSIS] TESTING MARKET_ANALYSIS..."
Write-Host "----------------------------------------"
Test-Endpoint "Complete Analysis" "$API_BASE/market-analysis"
Test-Endpoint "Analysis History" "$API_BASE/market-analysis/history?2"
Test-Endpoint "Analysis Stats" "$API_BASE/market-analysis/stats"
Test-Endpoint "Analysis pattern" "$API_BASE/patterns/squeeze"
Write-Host ""

Write-Host "[HISTORICAL] TESTING HISTORICAL..."
Write-Host "----------------------------------------"
Test-Endpoint "Historical Snapshots" "$API_BASE/market-history"
Test-Endpoint "Historical regime" "$API_BASE/regime-history"
Write-Host ""

Write-Host "============================================================================"
Write-Host "Testing complete!"
Write-Host "============================================================================"