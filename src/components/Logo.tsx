import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className }: LogoProps) => {
  return (
    <div className={cn("font-display text-brand font-bold tracking-wider", className)}>
      <span className="text-2xl md:text-4xl">HOYEEH</span>
    </div>
  );
};
