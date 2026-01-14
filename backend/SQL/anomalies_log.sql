SELECT * FROM anomalies_log 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC
LIMIT 10;