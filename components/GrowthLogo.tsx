import React, { useState, useEffect } from 'react';

interface GrowthLogoProps {
  variant: 'header' | 'login';
}

const GrowthLogo = ({ variant }: GrowthLogoProps): React.ReactElement => {
  const [stage, setStage] = useState(0);

  const stages = [
    { 
      main: '🌱', 
      sub: '💧', 
      bg: 'bg-secondary', 
      border: 'border-green-200',
      desc: '새싹이 돋아나고' 
    },
    { 
      main: '🌳', 
      sub: '☀️', 
      bg: 'bg-secondary', 
      border: 'border-green-200',
      desc: '햇살을 받아 자라나' 
    },
    { 
      main: '🌸', 
      sub: '✨', 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-200',
      desc: '꽃을 피우는 우리 아이들 ❤️' 
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, 2500); // Change every 2.5 seconds
    return () => clearInterval(timer);
  }, []);

  const currentStage = stages[stage];
  const isLogin = variant === 'login';

  // Dimensions and styles based on variant
  const containerClass = isLogin 
    ? "w-24 h-24 border-4 mb-4 shadow-sm" 
    : "w-10 h-10 border-2 shadow-sm mx-0";
    
  const mainEmojiClass = isLogin ? "text-5xl" : "text-xl";
  
  // Adjust sub-emoji position and size
  const subEmojiClass = isLogin 
    ? "text-2xl -top-1 -right-1" 
    : "text-[10px] -top-1 -right-1";

  return (
    <div className="flex flex-col items-center justify-center">
      <div 
        className={`relative rounded-full flex items-center justify-center transition-all duration-700 ease-in-out ${currentStage.bg} ${currentStage.border} ${containerClass}`}
      >
        {/* Main Emoji (Sprout/Tree/Flower) */}
        <span 
          key={`main-${stage}`} 
          className={`${mainEmojiClass} animate-[bounce_2s_infinite] select-none leading-none`} 
          role="img" 
          aria-label="Growth Stage"
        >
          {currentStage.main}
        </span>

        {/* Sub Emoji (Water/Sun/Sparkle) */}
        <span 
          key={`sub-${stage}`}
          className={`absolute ${subEmojiClass} animate-[ping_1.5s_ease-in-out_infinite] select-none opacity-75`}
          role="img" 
          aria-label="Nurturing Element"
        >
          {currentStage.sub}
        </span>
      </div>

      {/* Caption text - Only for Login screen */}
      {isLogin && (
        <p 
          key={`text-${stage}`}
          className="text-sm font-bold text-secondary-content/80 animate-[fadeIn_0.5s_ease-in] h-6 whitespace-nowrap"
        >
          {currentStage.desc}
        </p>
      )}
    </div>
  );
};

export default GrowthLogo;