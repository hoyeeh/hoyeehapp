import { cn } from "@/lib/utils";
import logoImage from "@/assets/hoyeeh-logo-web.png";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className }: LogoProps) => {
  return (
    <div className={cn("flex items-center", className)}>
      <img 
        src={logoImage} 
        alt="Hoyeeh" 
        className="h-10 object-contain"
      />
    </div>
  );
};