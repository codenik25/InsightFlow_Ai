import React from 'react';
import { motion } from 'framer-motion';

interface DataTerrainProps {
  hasLoaded?: boolean;
}

export const DataTerrain: React.FC<DataTerrainProps> = ({}) => {
  // Generate a complex SVG wave path
  // Density is concentrated around x=60-75% (Right-center)
  const generateWave = (offset: number, amplitude: number, frequency: number, phase: number, complexity: number) => {
    let d = `M 0 ${offset}`;
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * 1600; // 1600px width viewBox
      // Base sine wave
      let y = Math.sin((x * frequency) + phase) * amplitude;
      
      // Add noise/complexity
      y += Math.sin(x * frequency * complexity + phase * 1.5) * (amplitude * 0.3);
      
      // Right-side focus: Increase amplitude slightly around x=900-1200
      const rightFocus = Math.max(0, 1 - Math.abs(x - 1050) / 400);
      y += Math.sin(x * 0.01) * (amplitude * 0.5 * rightFocus);

      d += ` L ${x} ${offset + y}`;
    }
    return d;
  };

  const layers = [
    { duration: 27, color: 'rgba(59, 130, 246, 0.15)', dotColor: 'rgba(59, 130, 246, 0.4)', offset: 80, amp: 20, freq: 0.003, comp: 2.1, dash: '2 25' },
    { duration: 24, color: 'rgba(139, 92, 246, 0.18)', dotColor: 'rgba(139, 92, 246, 0.5)', offset: 120, amp: 25, freq: 0.004, comp: 2.5, dash: '2 20' },
    { duration: 21, color: 'rgba(34, 211, 238, 0.22)', dotColor: 'rgba(34, 211, 238, 0.7)', offset: 160, amp: 30, freq: 0.0035, comp: 3.0, dash: '2 18' },
    { duration: 18, color: 'rgba(10, 60, 100, 0.3)', dotColor: 'rgba(34, 211, 238, 0.6)', offset: 190, amp: 22, freq: 0.005, comp: 1.8, dash: '1.5 15' },
    { duration: 15, color: 'rgba(103, 232, 249, 0.25)', dotColor: 'rgba(103, 232, 249, 0.8)', offset: 230, amp: 35, freq: 0.0045, comp: 2.7, dash: '2.5 22' },
    { duration: 18, color: 'rgba(34, 211, 238, 0.15)', dotColor: 'rgba(255, 255, 255, 0.5)', offset: 260, amp: 18, freq: 0.006, comp: 2.0, dash: '1 30' },
    { duration: 21, color: 'rgba(59, 130, 246, 0.1)', dotColor: 'rgba(103, 232, 249, 0.9)', offset: 290, amp: 15, freq: 0.007, comp: 3.5, dash: '3 35' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[35vh] min-h-[300px] pointer-events-none z-[6] overflow-hidden select-none">
      <div className="w-full h-full relative">
        <svg
          viewBox="0 0 1600 350"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {layers.map((layer, index) => {
            const d1 = generateWave(layer.offset, layer.amp, layer.freq, 0, layer.comp);
            const d2 = generateWave(layer.offset, layer.amp, layer.freq, Math.PI, layer.comp);
            const d3 = generateWave(layer.offset, layer.amp, layer.freq, Math.PI * 2, layer.comp);

            return (
              <g key={`wave-layer-${index}`}>
                {/* Thin connecting segment */}
                <motion.path
                  d={d1}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth="1"
                  animate={{ d: [d1, d2, d3] }}
                  transition={{ duration: layer.duration, repeat: Infinity, ease: "linear" }}
                />
                {/* Glowing Nodes (using stroke-dasharray) */}
                <motion.path
                  d={d1}
                  fill="none"
                  stroke={layer.dotColor}
                  strokeWidth={index === 4 ? "3" : "2"}
                  strokeLinecap="round"
                  strokeDasharray={layer.dash}
                  className={index >= 3 ? "filter drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]" : ""}
                  animate={{ 
                    d: [d1, d2, d3],
                    strokeDashoffset: [0, -100] // Causes nodes to travel along the path!
                  }}
                  transition={{ 
                    d: { duration: layer.duration, repeat: Infinity, ease: "linear" },
                    strokeDashoffset: { duration: layer.duration * 0.8, repeat: Infinity, ease: "linear" }
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Gradient fade on left side (Left Side Protection) and bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#02050A] via-transparent to-transparent opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#02050A] via-transparent to-transparent opacity-90" />
      </div>
    </div>
  );
};
