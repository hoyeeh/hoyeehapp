import { ReactNode, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionProps {
  children: ReactNode;
}

// Enhanced page transition with framer-motion
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ 
          duration: 0.2, 
          ease: [0.25, 0.46, 0.45, 0.94] 
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Simple fade wrapper for individual components
export function FadeIn({ 
  children, 
  delay = 0,
  className 
}: { 
  children: ReactNode; 
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: delay / 1000,
        ease: "easeOut" 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger animation for lists
export function StaggerList({ 
  children, 
  staggerDelay = 50 
}: { 
  children: ReactNode[];
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay / 1000
          }
        }
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 }
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Slide in from direction
export function SlideIn({ 
  children, 
  direction = "right",
  delay = 0,
  className
}: { 
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}) {
  const directionOffset = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: -50 },
    down: { x: 0, y: 50 },
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        ...directionOffset[direction] 
      }}
      animate={{ 
        opacity: 1, 
        x: 0, 
        y: 0 
      }}
      transition={{ 
        duration: 0.3, 
        delay: delay / 1000,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scale in animation
export function ScaleIn({ 
  children, 
  delay = 0,
  className
}: { 
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.2, 
        delay: delay / 1000,
        ease: "easeOut" 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Smooth navigation wrapper for mobile pages
export function MobilePageWrapper({ 
  children,
  className
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("min-h-screen bg-background", className)}
    >
      {children}
    </motion.div>
  );
}
