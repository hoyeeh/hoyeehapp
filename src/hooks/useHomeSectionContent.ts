import { Content } from "@/types";

interface Section {
  id: string;
  section_type: string;
  title: string;
  max_items?: number;
  content_type_filter?: string;
  genre?: { name: string };
  year_filter?: number | null;
}

interface ProcessedSection {
  section: Section;
  content: Content[];
}

// Section types that allow duplicates (curated/featured content)
const EXEMPT_SECTION_TYPES = ['curated', 'top10', 'trending'];

// Sort content by year (newest first), with fallback to created_at
const sortByYear = (items: Content[]): Content[] => {
  return [...items].sort((a, b) => {
    const yearA = a.year || 0;
    const yearB = b.year || 0;
    if (yearB !== yearA) return yearB - yearA;
    // Secondary sort by createdAt if years are equal
    const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    return dateB - dateA;
  });
};

// Sort by view count for trending
const sortByViewCount = (items: Content[]): Content[] => {
  return [...items].sort((a, b) => {
    const viewsA = (a as any).viewCount || 0;
    const viewsB = (b as any).viewCount || 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    // Secondary sort by year
    return (b.year || 0) - (a.year || 0);
  });
};

// Sort by created_at for recently added
const sortByCreatedAt = (items: Content[]): Content[] => {
  return [...items].sort((a, b) => {
    const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
    const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
    return dateB - dateA;
  });
};

export const getSortedContent = (
  items: Content[],
  sectionType: string
): Content[] => {
  switch (sectionType) {
    case 'recently_added':
      return sortByCreatedAt(items);
    case 'trending':
      return sortByViewCount(items);
    case 'top10':
      // Keep original rank order for Top 10
      return items;
    default:
      // All other sections sorted by year (newest first)
      return sortByYear(items);
  }
};

export const processHomeSections = (
  sections: Section[],
  getSectionContent: (section: Section) => Content[]
): ProcessedSection[] => {
  const displayedContentIds = new Set<string>();
  const processedSections: ProcessedSection[] = [];

  for (const section of sections) {
    let sectionContent = getSectionContent(section);
    
    // Apply sorting based on section type
    sectionContent = getSortedContent(sectionContent, section.section_type);
    
    // Apply deduplication unless exempt
    if (!EXEMPT_SECTION_TYPES.includes(section.section_type)) {
      sectionContent = sectionContent.filter((item) => {
        if (displayedContentIds.has(item.id)) {
          return false;
        }
        displayedContentIds.add(item.id);
        return true;
      });
    } else {
      // Still track content from exempt sections for later deduplication
      sectionContent.forEach((item) => displayedContentIds.add(item.id));
    }

    processedSections.push({
      section,
      content: sectionContent,
    });
  }

  return processedSections;
};

// Hook to get deduplication tracker for manual use
export const createDeduplicationTracker = () => {
  const displayedContentIds = new Set<string>();
  
  return {
    isDisplayed: (id: string) => displayedContentIds.has(id),
    markDisplayed: (id: string) => displayedContentIds.add(id),
    filterAndMark: (items: Content[], exempt = false): Content[] => {
      if (exempt) {
        items.forEach((item) => displayedContentIds.add(item.id));
        return items;
      }
      return items.filter((item) => {
        if (displayedContentIds.has(item.id)) {
          return false;
        }
        displayedContentIds.add(item.id);
        return true;
      });
    },
    reset: () => displayedContentIds.clear(),
  };
};

