import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

interface TrashTalkProps {
  message: string;
}

export const TrashTalk: React.FC<TrashTalkProps> = ({ message }) => {
  const [typedMessage, setTypedMessage] = useState('');

  useEffect(() => {
    setTypedMessage('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < message.length) {
        setTypedMessage((prev) => prev + message.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30); // Typing effect speed

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="flex items-start gap-4 p-4 md:p-6 border-l-4 border-pink-500 bg-gray-900/80 backdrop-blur-sm shadow-lg w-full max-w-md md:max-w-2xl my-4 rounded-r-lg transition-all duration-300">
      <div className="relative shrink-0">
        <Bot className="text-pink-500 animate-pulse w-12 h-12 md:w-16 md:h-16" />
        <div className="absolute top-0 right-0 w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded-full animate-ping"></div>
      </div>
      <div className="flex flex-col w-full">
        <span className="text-pink-500 text-xs md:text-sm font-bold tracking-widest uppercase">BOT_OS v9.0</span>
        <p className="text-cyan-300 font-mono text-lg md:text-2xl min-h-[3.5rem] leading-tight mt-1">
          "{typedMessage}"<span className="animate-pulse">_</span>
        </p>
      </div>
    </div>
  );
};