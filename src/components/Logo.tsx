import { cn } from "@/lib/utils";
import logoImage from "@/assets/logo.png";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className, showText = true }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img 
        src={logoImage} 
        alt="Hoyeeh" 
        className="h-10 w-10 rounded-lg object-contain"
      />
      {showText && (
        <span className="font-display text-2xl md:text-3xl text-primary font-bold tracking-wider">
          HOYEEH
        </span>
      )}
    </div>
  );
};