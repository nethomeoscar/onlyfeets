// hooks/useIntersection.ts
import { useEffect, useRef, useState } from 'react';

export function useIntersection(ref: React.RefObject<Element>, options?: IntersectionObserverInit): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, { threshold: 0.1, ...options });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options?.threshold]);

  return isIntersecting;
}
