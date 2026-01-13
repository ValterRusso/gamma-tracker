# Deribit Volatility Index (DVOL) API Documentation

## Endpoint: `public/get_volatility_index_data`

**Description:** Public market data request for volatility index candles

**Method:** GET

**URL:** `https://www.deribit.com/api/v2/public/get_volatility_index_data`

---

## Parameters

### `currency` (enum<string>, required)
The currency symbol

**Available options:**
- `BTC` - Bitcoin
- `ETH` - Ethereum  
- `USDC`
- `USDT`
- `EURR`

**Example:** `"BTC"`

---

### `start_timestamp` (integer, required)
The earliest timestamp to return result from (milliseconds since the Unix epoch)

**Example:** `1536569522277`

---

### `end_timestamp` (integer, required)
The most recent timestamp to return result from (milliseconds since the Unix epoch)

**Example:** `1536569522277`

---

### `resolution` (enum<string>, required)
Time resolution given in full seconds or keyword `1D` (only some specific resolution are supported)

**Available options:**
- `1` - 1 second
- `60` - 1 minute
- `3600` - 1 hour
- `43200` - 12 hours
- `1D` - 1 day

---

## Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "data": [
      [
        1598019580000,  // timestamp (ms)
        0.210884879,    // volatility value
        0.212860821,
        0.210884879,
        0.212860821
      ],
      [
        1598019540000,
        0.212869011,
        0.212987527,
        0.212869011,
        0.212987527
      ]
    ]
  }
}
```

---

## Data Array Format

Each data point is an array with 5 elements:
1. **Timestamp** (milliseconds since Unix epoch)
2. **Open** (volatility at start of period)
3. **High** (highest volatility in period)
4. **Low** (lowest volatility in period)
5. **Close** (volatility at end of period)

---

## Example Request

```bash
curl --request GET \
  --url 'https://test.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=1599373800000&end_timestamp=1599373800000&resolution=60' \
  --header 'Content-Type: application/json'
```

---

## Notes

- **No authentication required** (public endpoint)
- **Rate limits apply** (check Deribit rate limit documentation)
- **DVOL calculation:** 30-day annualized implied volatility from ATM options
- **Similar to VIX:** Measures market expectation of volatility
- **Values:** Typically 40-150% for crypto (higher than traditional markets)

---

## Implementation Strategy

### Backend Service
```javascript
// Fetch current DVOL
GET /api/v2/public/get_volatility_index_data?currency=BTC&resolution=60&start_timestamp={now-60s}&end_timestamp={now}

// Fetch historical DVOL (7 days)
GET /api/v2/public/get_volatility_index_data?currency=BTC&resolution=3600&start_timestamp={now-7d}&end_timestamp={now}
```

### Caching Strategy
- **Current value:** Cache for 5 minutes (DVOL doesn't change rapidly)
- **Historical data:** Cache for 1 hour (historical data is immutable)

### Frontend Display
- **Gauge:** Show latest close value
- **Chart:** Plot close values over time
- **24h Change:** Compare current vs 24h ago
