import { useMemo } from 'react';

interface HalfPipeVisualProps {
  currentPrice: number;
  putWall?: { strike: number; gex: number };
  callWall?: { strike: number; gex: number };
  gammaFlip?: number;
  P_escape: number;
  detectionType: 'H1' | 'H2' | 'H3' | 'NONE';
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

export default function HalfPipeVisual({
  currentPrice,
  putWall,
  callWall,
  gammaFlip,
  P_escape,
  detectionType,
  direction
}: HalfPipeVisualProps) {
  
  // Calculate visualization parameters
  const { priceY, putWallY, callWallY, gammaFlipY, halfPipeHeight } = useMemo(() => {
    const viewHeight = 400;
    const padding = 40;
    const usableHeight = viewHeight - 2 * padding;
    
    // Price range for visualization
    const minPrice = putWall ? putWall.strike * 0.98 : currentPrice * 0.95;
    const maxPrice = callWall ? callWall.strike * 1.02 : currentPrice * 1.05;
    const priceRange = maxPrice - minPrice;
    
    // Convert prices to Y coordinates (inverted, top = high price)
    const priceToY = (price: number) => {
      const ratio = (maxPrice - price) / priceRange;
      return padding + ratio * usableHeight;
    };
    
    return {
      priceY: priceToY(currentPrice),
      putWallY: putWall ? priceToY(putWall.strike) : null,
      callWallY: callWall ? priceToY(callWall.strike) : null,
      gammaFlipY: gammaFlip ? priceToY(gammaFlip) : null,
      halfPipeHeight: putWall && callWall 
        ? Math.abs(priceToY(callWall.strike) - priceToY(putWall.strike))
        : usableHeight * 0.6
    };
  }, [currentPrice, putWall, callWall, gammaFlip]);

  // Detection type colors
  const getDetectionColor = () => {
    switch (detectionType) {
      case 'H1': return '#34d399'; // emerald-400
      case 'H2': return '#fb7185'; // rose-400
      case 'H3': return '#fbbf24'; // amber-400
      default: return '#22d3ee'; // cyan-400
    }
  };

  // Direction arrow
  const getDirectionArrow = () => {
    if (direction === 'UP') return '↑';
    if (direction === 'DOWN') return '↓';
    return '↔';
  };

  return (
    <svg
      viewBox="0 0 600 400"
      className="w-full h-full"
      style={{ maxHeight: '500px' }}
    >
      {/* Background */}
      <rect width="600" height="400" fill="transparent" />
      
      {/* Half Pipe Structure */}
      <g opacity="0.3">
        {/* Put Wall (bottom) */}
        {putWallY && (
          <>
            <line
              x1="100"
              y1={putWallY}
              x2="500"
              y2={putWallY}
              stroke="#fb7185"
              strokeWidth="3"
              strokeDasharray="5,5"
            />
            <text
              x="510"
              y={putWallY + 5}
              fill="#fb7185"
              fontSize="12"
              fontFamily="monospace"
            >
              Put Wall ${putWall?.strike.toLocaleString()}
            </text>
          </>
        )}
        
        {/* Call Wall (top) */}
        {callWallY && (
          <>
            <line
              x1="100"
              y1={callWallY}
              x2="500"
              y2={callWallY}
              stroke="#34d399"
              strokeWidth="3"
              strokeDasharray="5,5"
            />
            <text
              x="510"
              y={callWallY + 5}
              fill="#34d399"
              fontSize="12"
              fontFamily="monospace"
            >
              Call Wall ${callWall?.strike.toLocaleString()}
            </text>
          </>
        )}
        
        {/* Gamma Flip */}
        {gammaFlipY && (
          <>
            <line
              x1="100"
              y1={gammaFlipY}
              x2="500"
              y2={gammaFlipY}
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="2,2"
              opacity="0.5"
            />
            <text
              x="510"
              y={gammaFlipY + 5}
              fill="#22d3ee"
              fontSize="10"
              fontFamily="monospace"
            >
              Gamma Flip ${gammaFlip?.toLocaleString()}
            </text>
          </>
        )}
        
        {/* Half Pipe Walls (curved) */}
        {putWallY && callWallY && (
          <>
            {/* Left curve */}
            <path
              d={`M 100 ${putWallY} Q 80 ${(putWallY + callWallY) / 2} 100 ${callWallY}`}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />
            {/* Right curve */}
            <path
              d={`M 500 ${putWallY} Q 520 ${(putWallY + callWallY) / 2} 500 ${callWallY}`}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />
          </>
        )}
      </g>

      {/* Current Price Line */}
      <g>
        <line
          x1="100"
          y1={priceY}
          x2="500"
          y2={priceY}
          stroke={getDetectionColor()}
          strokeWidth="4"
        />
        
        {/* Price label */}
        <text
          x="300"
          y={priceY - 10}
          fill={getDetectionColor()}
          fontSize="16"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          ${currentPrice.toLocaleString()} {getDirectionArrow()}
        </text>
        
        {/* Price dot */}
        <circle
          cx="300"
          cy={priceY}
          r="8"
          fill={getDetectionColor()}
        >
          <animate
            attributeName="r"
            values="8;12;8"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      {/* P_escape Visualization */}
      <g>
        {/* P_escape bar */}
        <rect
          x="50"
          y="50"
          width="30"
          height="300"
          fill="rgba(255,255,255,0.1)"
          rx="15"
        />
        <rect
          x="50"
          y={50 + 300 * (1 - P_escape)}
          width="30"
          height={300 * P_escape}
          fill={getDetectionColor()}
          rx="15"
        >
          <animate
            attributeName="height"
            to={300 * P_escape}
            dur="0.5s"
            fill="freeze"
          />
        </rect>
        
        {/* P_escape label */}
        <text
          x="65"
          y="30"
          fill="rgba(255,255,255,0.6)"
          fontSize="12"
          fontFamily="monospace"
          textAnchor="middle"
        >
          P_escape
        </text>
        <text
          x="65"
          y="370"
          fill={getDetectionColor()}
          fontSize="14"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {(P_escape * 100).toFixed(0)}%
        </text>
      </g>

      {/* Detection Type Badge */}
      <g>
        <rect
          x="250"
          y="10"
          width="100"
          height="30"
          fill={getDetectionColor()}
          fillOpacity="0.2"
          stroke={getDetectionColor()}
          strokeWidth="2"
          rx="15"
        />
        <text
          x="300"
          y="30"
          fill={getDetectionColor()}
          fontSize="14"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {detectionType}
        </text>
      </g>

      {/* Energy Arrows (if escaping) */}
      {detectionType !== 'NONE' && (
        <g opacity="0.6">
          {direction === 'UP' && (
            <>
              <path
                d="M 300 ${priceY + 20} L 300 ${priceY + 60} L 290 ${priceY + 50} M 300 ${priceY + 60} L 310 ${priceY + 50}"
                stroke={getDetectionColor()}
                strokeWidth="3"
                fill="none"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </>
          )}
          {direction === 'DOWN' && (
            <>
              <path
                d="M 300 ${priceY - 20} L 300 ${priceY - 60} L 290 ${priceY - 50} M 300 ${priceY - 60} L 310 ${priceY - 50}"
                stroke={getDetectionColor()}
                strokeWidth="3"
                fill="none"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </>
          )}
        </g>
      )}

      {/* Legend */}
      <g transform="translate(100, 370)">
        <text fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">
          <tspan x="0" dy="0">Half Pipe Model Visualization</tspan>
        </text>
      </g>
    </svg>
  );
}
