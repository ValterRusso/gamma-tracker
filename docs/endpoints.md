

Entropy endpoints:

works:

✅ - api/entropy

✅ - api/entropy/events?limit=5

✅ - api/entropy/history?limit=100


✅ - api/entropy/divergence  (corrigido)

    success": true,
    "data": null
    

✅ - api/entropy/stats   (corrigido)

    success": true,
    "data": { ... }


comparison endpoints:

works:

✅ - api/iv-comparison/1

✅ - api/binance/iv-metrics/1

✅ - api/retail-panic-index

✅ - api/binance/iv-surface

✅ - api/binance/iv-metrics/:dte

✅ - api/binance/stats

✅ - api/deribit/iv-surface

✅ - api/deribit/iv-metrics/:dte

✅ - api/iv-comparison/:dte

not works

❌ - api/iv-comparison/multiple
      
     error:

      "success": false,
    "error": "Invalid DTE parameter"

❌ - api/iv-comparison/history 

     error:

    "success": false,
    "error": "Invalid DTE parameter"

❌ - api/iv-comparison/stats  

     error:

    "success": false,
    "error": "Invalid DTE parameter"   (muito estranho, pois nao usa dte)








