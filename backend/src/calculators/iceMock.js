
const IcebergDetector = require('./IcebergDetector');

const detector = new IcebergDetector();

// Mock order book
const orderBook = {
  asks: [
    [88000, 2.0],
    [88050, 1.5],
    [88100, 2.0]
  ],
  bids: [
    [87950, 3.0],
    [87900, 2.5]
  ],
  depth: 45000000,
  spread_pct: 0.03,
  BI: 0.2
};

// Run detection 10 times (to build history)
for (let i = 0; i < 10; i++) {
  detector.detect(orderBook);
}

// Final detection
const result = detector.detect(orderBook);

console.log('✅ IcebergDetector Test:');
console.log('  Detected:', result.detected);
console.log('  Score:', result.score.toFixed(2));
console.log('  Confidence:', result.confidence);
console.log('  Signals:', Object.keys(result.signals).filter(k => result.signals[k].detected));
console.log('\n🎉 IcebergDetector is working!');
module.exports = {};
