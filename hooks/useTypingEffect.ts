import { useState, useEffect, useRef } from 'react';

/**
 * 打字动画效果 Hook
 * @param text 要显示的目标文本
 * @param speed 打字速度（毫秒/字符），默认 50ms
 * @returns { displayedText, isTyping } 当前显示的文本和是否正在打字
 */
export function useTypingEffect(text: string, speed: number = 50) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    let charIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    setDisplayedText('');
    setIsTyping(true);

    const typeChar = () => {
      if (charIndex < text.length) {
        charIndex++;
        setDisplayedText(text.slice(0, charIndex));
        timeoutId = setTimeout(typeChar, speed);
      } else {
        setIsTyping(false);
      }
    };

    timeoutId = setTimeout(typeChar, speed);

    return () => clearTimeout(timeoutId);
  }, [text, speed]);

  return { displayedText, isTyping };
}
