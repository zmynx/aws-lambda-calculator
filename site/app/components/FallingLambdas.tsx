import { useEffect, useState } from 'react';

interface LambdaSymbol {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  animationType: 'fall' | 'fall-wiggle';
}

const FallingLambdas: React.FC = () => {
  const [lambdas, setLambdas] = useState<LambdaSymbol[]>([]);

  useEffect(() => {
    // Generate lambda symbols with random properties
    const generateLambdas = () => {
      const symbols: LambdaSymbol[] = [];
      const numberOfLambdas = 30; // Increased for more visual density

      for (let i = 0; i < numberOfLambdas; i++) {
        symbols.push({
          id: i,
          x: Math.random() * 100, // Random horizontal position (0-100%)
          size: Math.random() * 1.5 + 1, // Size between 1rem and 2.5rem
          duration: Math.random() * 25 + 20, // Duration between 20-45 seconds (slower spread)
          delay: Math.random() * -40, // Start at different times (-40 to 0 seconds - more spread)
          opacity: Math.random() * 0.25 + 0.05, // Very subtle opacity (0.05-0.3)
          animationType: Math.random() > 0.5 ? 'fall' : 'fall-wiggle',
        });
      }
      setLambdas(symbols);
    };

    generateLambdas();
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      
      {lambdas.map((lambda) => (
        <div
          key={lambda.id}
          className={`absolute font-mono font-bold select-none will-change-transform
            text-blue-600 dark:text-blue-400
            ${lambda.animationType === 'fall' ? 'animate-lambda-fall' : 'animate-lambda-wiggle'}
          `}
          style={{
            left: `${lambda.x}%`,
            fontSize: `${lambda.size}rem`,
            opacity: lambda.opacity,
            animationDuration: `${lambda.duration}s`,
            animationDelay: `${lambda.delay}s`,
            top: '-10vh', // Start above viewport
          }}
        >
          λ
        </div>
      ))}
    </div>
  );
};

export default FallingLambdas;