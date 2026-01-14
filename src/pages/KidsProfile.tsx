import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Heart, Play, Sparkles } from "lucide-react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Button } from "@/components/ui/button";

const floatingEmojis = ["🎬", "🍿", "⭐", "🎪", "🦁", "🐻", "🌈", "🎨"];

export default function KidsProfile() {
  const navigate = useNavigate();
  const { currentProfile } = useProfileContext();

  useEffect(() => {
    // Redirect if not on a kids profile
    if (currentProfile && !currentProfile.is_kids) {
      navigate("/profile");
    }
  }, [currentProfile, navigate]);

  const achievements = [
    { icon: "🎬", label: "Movie Fan", count: 10 },
    { icon: "⭐", label: "Super Star", count: 5 },
    { icon: "🍿", label: "Binge Watcher", count: 3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-900 via-fuchsia-900 to-[#0A0A0F] overflow-hidden">
      {/* Floating Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {floatingEmojis.map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl"
            style={{
              left: `${10 + (i * 12)}%`,
              top: `${15 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe">
        <div className="bg-gradient-to-b from-violet-900/95 to-transparent backdrop-blur-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full bg-white/10 hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </Button>
            <h1 className="text-xl font-bold text-white">My Profile</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-[calc(80px+env(safe-area-inset-top,20px))] pb-[calc(100px+env(safe-area-inset-bottom,0px))] px-6">
        {/* Avatar Section */}
        <motion.div 
          className="flex flex-col items-center mb-8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
        >
          <div className="relative mb-4">
            {/* Glowing ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-violet-500 animate-spin-slow blur-md opacity-70" 
                 style={{ animation: "spin 4s linear infinite" }} />
            
            {/* Avatar container */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 p-1">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                {currentProfile?.avatar_url ? (
                  <img 
                    src={currentProfile.avatar_url} 
                    alt={currentProfile.name || "Kid"} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-bold text-white">
                    {currentProfile?.name?.charAt(0)?.toUpperCase() || "K"}
                  </span>
                )}
              </div>
            </div>

            {/* Sparkles */}
            <motion.div
              className="absolute -top-2 -right-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-8 w-8 text-yellow-400" />
            </motion.div>
          </div>

          {/* Name */}
          <motion.h2 
            className="text-3xl font-bold text-white mb-2"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {currentProfile?.name || "Little Star"}
          </motion.h2>
          
          <motion.div 
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400/20 to-pink-400/20 border border-white/20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="text-white/90 text-sm font-medium">Super Viewer</span>
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </motion.div>
        </motion.div>

        {/* Achievements */}
        <motion.div 
          className="mb-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-white/80 mb-4 text-center">
            ✨ My Achievements ✨
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((achievement, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 + i * 0.1, type: "spring", bounce: 0.5 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-3xl mb-2">{achievement.icon}</span>
                <span className="text-white/60 text-xs text-center">{achievement.label}</span>
                <span className="text-white font-bold">{achievement.count}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Fun Stats */}
        <motion.div 
          className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/10"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <Heart className="h-6 w-6 text-white fill-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Favorites</p>
                <p className="text-white font-bold text-lg">12</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Play className="h-6 w-6 text-white fill-white" />
              </div>
              <div>
                <p className="text-white/60 text-xs">Watched</p>
                <p className="text-white font-bold text-lg">28</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Back to Home Button */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={() => navigate("/")}
            className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30"
          >
            🏠 Back to Home
          </Button>
        </motion.div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
