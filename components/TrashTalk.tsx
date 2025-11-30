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
    <div className="flex items-start gap-4 p-4 border-l-4 border-pink-500 bg-gray-900/80 backdrop-blur-sm shadow-lg max-w-md w-full my-4 rounded-r-lg">
      <div className="relative">
        <Bot size={48} className="text-pink-500 animate-pulse" />
        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
      </div>
      <div className="flex flex-col">
        <span className="text-pink-500 text-xs font-bold tracking-widest uppercase">BOT_OS v9.0</span>
        <p className="text-cyan-300 font-mono text-lg min-h-[3.5rem] leading-tight mt-1">
          "{typedMessage}"<span className="animate-pulse">_</span>
        </p>
      </div>
    </div>
  );
};