import React from 'react';

interface VoiceWaveProps {
  volume: number;
  barCount?: number;
  className?: string;
}

const VoiceWave: React.FC<VoiceWaveProps> = ({
  volume,
  barCount = 20,
  className = '',
}) => {
  const bars = Array.from({ length: barCount });

  return (
    <div className={`flex items-end justify-center h-10 space-x-1 ${className}`}>
      {bars.map((_, index) => {
        const barVolume = Math.max(0.05, Math.min(1, volume * (1 + Math.sin(index * Math.PI / (barCount -1)) * 0.5 + (Math.random() -0.5) * 0.3)));
        const barHeight = `${barVolume * 100}%`;

        return (
          <div
            key={index}
            className="w-1 bg-accent-turquoise rounded-full transition-all duration-75 ease-out"
            style={{
              height: barHeight,
              transformOrigin: 'bottom',
              transitionDelay: `${Math.random() * 50}ms`
             }}
          />
        );
      })}
    </div>
  );
};

export default VoiceWave;