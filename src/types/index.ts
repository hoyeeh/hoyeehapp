export interface WatchHistoryItem {
  contentId: string;
  progress: number;
  lastWatched: string;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  mobileNumber: string;
  role: 'user' | 'admin';
  country: string;
  isSubscribed: boolean;
  subscriptionExpiry?: string;
  token?: string;
  myList: string[];
  watchHistory: WatchHistoryItem[];
}

export interface Content {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  genre: string;
  contentType: 'movie' | 'series';
  isPremium: boolean;
  duration: number;
  year?: number;
  releaseDate?: string;
  rating?: string;
  contentRating?: string;
  age_limit?: number;
  createdAt?: string;
  lifecycleStatus?: 'active' | 'leaving_soon' | 'hidden' | 'kept';
  expiresAt?: string;
  viewsLast30Days?: number;
}

export type ViewState = 'home' | 'movies' | 'shows' | 'player' | 'admin' | 'mylist' | 'profile' | 'search';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  type: ToastType;
}
