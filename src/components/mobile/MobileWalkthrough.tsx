import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalkthroughScreen } from "@/hooks/useWalkthroughScreens";

interface MobileWalkthroughProps {
  screens: WalkthroughScreen[];
  onComplete: () => void;
}

export const MobileWalkthrough = ({ screens, onComplete }: MobileWalkthroughProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < screens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!screens.length) {
    onComplete();
    return null;
  }

  const currentScreen = screens[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
          className="h-full flex flex-col"
        >
          {/* Image */}
          <div className="flex-1 relative overflow-hidden">
            <img
              src={currentScreen.image_url}
              alt={currentScreen.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 space-y-6">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-display font-bold text-foreground">
                {currentScreen.title}
              </h2>
              {currentScreen.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {currentScreen.description}
                </p>
              )}
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2">
              {screens.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              {currentIndex > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrev}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className="flex-1 gap-2"
              >
                {currentIndex === screens.length - 1 ? "Get Started" : "Next"}
                {currentIndex < screens.length - 1 && <ChevronRight className="h-4 w-4" />}
              </Button>

              {currentIndex < screens.length - 1 && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
