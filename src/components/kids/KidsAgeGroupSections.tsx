import { Content } from "@/types";
import { KidsContentCard } from "@/components/KidsContentCard";
import { Baby, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

interface KidsAgeGroupSectionsProps {
  content: Content[];
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

// Age limits for different groups
const YOUNG_KIDS_MAX_AGE = 6; // Content suitable for under 7
const OLDER_KIDS_MIN_AGE = 7; // Content for 7-13

export const KidsAgeGroupSections = ({ content, onPlay, onDetails }: KidsAgeGroupSectionsProps) => {
  // Filter content by age appropriateness
  // Young kids (under 7): age_limit is null OR age_limit <= 6
  const youngKidsContent = content.filter((c) => {
    const ageLimit = (c as any).age_limit || (c as any).ageLimit;
    return !ageLimit || ageLimit <= YOUNG_KIDS_MAX_AGE;
  });

  // Older kids (7-13): age_limit between 7 and 13
  const olderKidsContent = content.filter((c) => {
    const ageLimit = (c as any).age_limit || (c as any).ageLimit;
    return ageLimit && ageLimit >= OLDER_KIDS_MIN_AGE && ageLimit <= 13;
  });

  return (
    <>
      {/* Young Kids Section (Under 7) */}
      {youngKidsContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-gradient-to-br from-pink-500/20 via-pink-500/10 to-rose-500/20 rounded-2xl p-4 md:p-6 border border-pink-500/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
              <Baby className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Little Ones</h2>
              <p className="text-xs text-white/50">Perfect for ages 6 and under</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {youngKidsContent.slice(0, 12).map((item, index) => (
              <KidsContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Older Kids Section (7-13) */}
      {olderKidsContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-teal-500/20 rounded-2xl p-4 md:p-6 border border-cyan-500/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg">
              <GraduationCap className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Big Kids</h2>
              <p className="text-xs text-white/50">For ages 7-13</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {olderKidsContent.slice(0, 12).map((item, index) => (
              <KidsContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
              />
            ))}
          </div>
        </motion.section>
      )}
    </>
  );
};