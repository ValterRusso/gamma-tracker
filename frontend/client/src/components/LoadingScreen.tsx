interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ 
  message = "Loading Gamma Tracker...", 
  fullScreen = true 
}: LoadingScreenProps) {
  const containerClass = fullScreen 
    ? "min-h-screen bg-slate-950 flex items-center justify-center"
    : "w-full h-full flex items-center justify-center py-12";

  return (
    <div className={containerClass}>
      <div className="text-center">
        {/* Animated Logo 3 - Energy Pulse */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          {/* Main logo with pulse animation */}
          <img 
            src="/logo-option-3.png" 
            alt="Gamma Tracker" 
            className="w-full h-full object-contain animate-pulse-slow"
          />
          
          {/* Rotating ring overlay */}
          <div className="absolute inset-0 animate-spin-slow">
            <div className="w-full h-full rounded-full border-2 border-transparent border-t-cyan-500 border-r-purple-500"></div>
          </div>
          
          {/* Expanding ripple effect */}
          <div className="absolute inset-0 animate-ping-slow opacity-20">
            <div className="w-full h-full rounded-full bg-linear-to-r from-cyan-500 to-purple-500"></div>
          </div>
        </div>
        
        {/* Loading text */}
        <p className="text-slate-400 text-lg font-medium animate-pulse">
          {message}
        </p>
        
        {/* Loading dots animation */}
        <div className="flex justify-center gap-2 mt-4">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
