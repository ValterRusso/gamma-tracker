# API Timestamp Format Documentation

## Endpoint 3: Get Snapshot at Specific Time

**Endpoint:** `GET /api/dex/snapshot?timestamp=XXX`

---

## Timestamp Format

The API accepts timestamps in **ISO 8601 format** (UTC timezone).

### Format:
```
YYYY-MM-DDTHH:mm:ss.sssZ
```

### Examples:

**✅ Valid formats:**
```
2026-01-13T12:30:00.000Z
2026-01-13T09:47:15.123Z
2026-01-13T16:44:30.000Z
```

**❌ Invalid formats:**
```
2026-01-13 12:30:00        (missing T and Z)
1736772600000              (Unix milliseconds - not supported yet)
2026-01-13                 (date only)
```

---

## How to Get Valid Timestamps

### From Frontend:
```javascript
// Get current time
const timestamp = new Date().toISOString();
// Example: "2026-01-13T12:30:45.123Z"

// Get timestamp from heatmap data
const timestamp = heatmapData[0].timestamp;
```

### From `/api/dex/timestamps` endpoint:
```javascript
const response = await fetch('http://localhost:3300/api/dex/timestamps?timeframe=1h');
const data = await response.json();
const timestamps = data.data; // Array of ISO strings
```

---

## Complete Example

```javascript
// 1. Get available timestamps
const timestampsRes = await fetch('http://localhost:3300/api/dex/timestamps?timeframe=1h');
const timestampsData = await timestampsRes.json();
const timestamps = timestampsData.data;

// 2. Pick a timestamp
const selectedTimestamp = timestamps[0]; // "2026-01-13T12:30:00.000Z"

// 3. Get snapshot at that time
const snapshotRes = await fetch(
  `http://localhost:3300/api/dex/snapshot?timestamp=${encodeURIComponent(selectedTimestamp)}`
);
const snapshot = await snapshotRes.json();

console.log(snapshot.data); // Array of { strike, totalDex, callDex, putDex, spotPrice }
```

---

## Timezone Notes

- All timestamps are in **UTC** (Coordinated Universal Time)
- The `Z` suffix indicates UTC timezone
- Frontend should convert to local timezone for display if needed

```javascript
// Convert UTC to local time for display
const utcTime = "2026-01-13T12:30:00.000Z";
const localTime = new Date(utcTime).toLocaleString();
console.log(localTime); // "1/13/2026, 9:30:00 AM" (if you're in GMT-3)
```

---

## Error Responses

### Invalid timestamp format:
```json
{
  "success": false,
  "error": "Invalid timestamp format"
}
```

### No data found:
```json
{
  "success": true,
  "data": []
}
```

---

## Future Enhancement

We may add support for Unix milliseconds in the future:
```
/api/dex/snapshot?timestamp=1736772600000
```

But for now, please use ISO 8601 format only.
