import hoyeehLogo from "@/assets/hoyeeh-logo.png";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export const LoadingSpinner = ({ size = "md", text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Pulsing glow effect */}
        <div 
          className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-primary/30 animate-ping`}
          style={{ animationDuration: "1.5s" }}
        />
        
        {/* Rotating ring */}
        <div 
          className={`absolute inset-0 ${sizeClasses[size]} rounded-full border-4 border-transparent border-t-primary animate-spin`}
          style={{ animationDuration: "1s" }}
        />
        
        {/* Logo with pulse animation */}
        <img
          src={hoyeehLogo}
          alt="Loading..."
          className={`${sizeClasses[size]} object-contain animate-pulse relative z-10`}
          style={{ animationDuration: "1.5s" }}
        />
      </div>
      
      {text && (
        <p className="text-muted-foreground text-sm animate-pulse">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
