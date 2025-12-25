import { Content } from "@/types";
import { KidsMobileContentCard } from "@/components/mobile/KidsMobileContentCard";
import { Baby, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

interface KidsMobileAgeGroupSectionsProps {
  content: Content[];
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

const YOUNG_KIDS_MAX_AGE = 6;
const OLDER_KIDS_MIN_AGE = 7;

export const KidsMobileAgeGroupSections = ({ content, onPlay, onDetails }: KidsMobileAgeGroupSectionsProps) => {
  const youngKidsContent = content.filter((c) => {
    const ageLimit = (c as any).age_limit || (c as any).ageLimit;
    return !ageLimit || ageLimit <= YOUNG_KIDS_MAX_AGE;
  });

  const olderKidsContent = content.filter((c) => {
    const ageLimit = (c as any).age_limit || (c as any).ageLimit;
    return ageLimit && ageLimit >= OLDER_KIDS_MIN_AGE && ageLimit <= 13;
  });

  return (
    <>
      {/* Young Kids Section */}
      {youngKidsContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-gradient-to-br from-pink-500/20 via-pink-500/10 to-rose-500/20 rounded-xl mx-3 py-4 border border-pink-500/20"
        >
          <div className="flex items-center gap-2.5 px-5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Baby className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Little Ones</h2>
              <p className="text-[10px] text-white/50">Ages 6 and under</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {youngKidsContent.slice(0, 10).map((item, index) => (
              <KidsMobileContentCard
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

      {/* Older Kids Section */}
      {olderKidsContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-teal-500/20 rounded-xl mx-3 py-4 border border-cyan-500/20"
        >
          <div className="flex items-center gap-2.5 px-5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Big Kids</h2>
              <p className="text-[10px] text-white/50">Ages 7-13</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {olderKidsContent.slice(0, 10).map((item, index) => (
              <KidsMobileContentCard
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