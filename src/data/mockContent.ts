import { Content } from "@/types";

export const mockContent: Content[] = [
  {
    id: "1",
    title: "Lion King: Return",
    description: "A young lion prince must reclaim his homeland after the murder of his father.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg",
    videoUrl: "/videos/lionking.mp4",
    genre: "Drama",
    contentType: "movie",
    isPremium: false,
    duration: 7200,
    year: 2024,
    rating: "PG"
  },
  {
    id: "2",
    title: "Wakanda Forever",
    description: "The nation of Wakanda fights to protect their home from intervening world powers.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/sv1xJUazXeYqALzczSZ3O6nkH75.jpg",
    videoUrl: "/videos/wakanda.mp4",
    genre: "Action",
    contentType: "movie",
    isPremium: true,
    duration: 9000,
    year: 2023,
    rating: "PG-13"
  },
  {
    id: "3",
    title: "Queen of Katwe",
    description: "A Ugandan girl's life changes forever when she discovers chess.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/tYqFVDBEZq9bMIbG8Nm3D2zAZMS.jpg",
    videoUrl: "/videos/katwe.mp4",
    genre: "Biography",
    contentType: "movie",
    isPremium: false,
    duration: 6900,
    year: 2022,
    rating: "PG"
  },
  {
    id: "4",
    title: "Blood Diamond",
    description: "A fisherman, a smuggler, and a syndicate of businessmen match wits over a diamond.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/dvMQOFVNOd7Rh9rQPKMbpj5FQtC.jpg",
    videoUrl: "/videos/blooddiamond.mp4",
    genre: "Thriller",
    contentType: "movie",
    isPremium: true,
    duration: 8400,
    year: 2021,
    rating: "R"
  },
  {
    id: "5",
    title: "African Queens",
    description: "The untold stories of Africa's most powerful queens throughout history.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/AjV6jFJ2YFIluYo4GRT9issEXpG.jpg",
    videoUrl: "/videos/queens.mp4",
    genre: "Documentary",
    contentType: "series",
    isPremium: false,
    duration: 3600,
    year: 2024,
    rating: "TV-14"
  },
  {
    id: "6",
    title: "Lagos Chronicles",
    description: "Five friends navigate love, business, and dreams in the heart of Lagos.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/6POBWybSBDBKjSs1VAQcnQC1qyt.jpg",
    videoUrl: "/videos/lagos.mp4",
    genre: "Drama",
    contentType: "series",
    isPremium: true,
    duration: 2700,
    year: 2024,
    rating: "TV-MA"
  },
  {
    id: "7",
    title: "Safari Adventures",
    description: "Wildlife documentary exploring the Serengeti and its magnificent creatures.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/rMvPXy8PUjj1o8o1pzgQbwUhOYZ.jpg",
    videoUrl: "/videos/safari.mp4",
    genre: "Documentary",
    contentType: "series",
    isPremium: false,
    duration: 2400,
    year: 2023,
    rating: "G"
  },
  {
    id: "8",
    title: "Nairobi Heat",
    description: "A detective duo solves crimes in the bustling streets of Nairobi.",
    thumbnailUrl: "https://image.tmdb.org/t/p/w500/dqK9Hag1054tghRQSqLSfrkvQnA.jpg",
    videoUrl: "/videos/nairobi.mp4",
    genre: "Crime",
    contentType: "series",
    isPremium: true,
    duration: 3000,
    year: 2024,
    rating: "TV-14"
  }
];

export const featuredContent = mockContent[0];
