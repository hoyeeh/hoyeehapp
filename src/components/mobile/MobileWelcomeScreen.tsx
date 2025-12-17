import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, ChevronRight } from "lucide-react";
import logo from "@/assets/hoyeeh-logo-web.png";

interface MobileWelcomeScreenProps {
  userName: string;
  avatarUrl?: string;
  onStartExploring: () => void;
}

export function MobileWelcomeScreen({ 
  userName, 
  avatarUrl,
  onStartExploring 
}: MobileWelcomeScreenProps) {
  const defaultAvatar = "/src/assets/avatars/avatar-blue.png";
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
      
      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-sm"
      >
        {/* Logo */}
        <motion.img
          src={logo}
          alt="Hoyeeh"
          className="h-8 mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        />
        
        {/* Avatar with Glow */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150" />
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-primary shadow-2xl">
            <img
              src={avatarUrl || defaultAvatar}
              alt={userName}
              className="w-full h-full object-cover"
            />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="absolute -bottom-1 -right-1 bg-primary rounded-full p-2"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </motion.div>
        </motion.div>
        
        {/* Welcome Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2 mb-8"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Welcome, {userName}!
          </h1>
          <p className="text-muted-foreground text-sm">
            Your account is all set up. Get ready to explore amazing content.
          </p>
        </motion.div>
        
        {/* Features List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-3 mb-10 w-full"
        >
          {[
            "Unlimited movies & TV shows",
            "Download for offline viewing",
            "Create profiles for your family"
          ].map((feature, index) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <Play className="h-2.5 w-2.5 text-primary" fill="currentColor" />
              </div>
              {feature}
            </motion.div>
          ))}
        </motion.div>
        
        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="w-full"
        >
          <Button
            onClick={onStartExploring}
            variant="brand"
            size="lg"
            className="w-full h-14 text-lg font-semibold gap-2 group"
          >
            Start Exploring
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
