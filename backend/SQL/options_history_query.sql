-- Ver volume e bid/ask nos novos registros
SELECT symbol, volume, bid_price, ask_price 
FROM options_history 
WHERE snapshot_id = (SELECT MAX(id) FROM market_snapshots)
LIMIT 10;
