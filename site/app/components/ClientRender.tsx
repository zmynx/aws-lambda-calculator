import React, { useEffect, useState } from 'react';

export const RenderMounted = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) {
    return null;
  }
  
  return <>{children}</>;
};