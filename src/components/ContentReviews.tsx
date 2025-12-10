import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Edit2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ContentReviewsProps {
  contentId: string;
}

export const ContentReviews = ({ contentId }: ContentReviewsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch reviews for this content
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id,
          rating,
          review_text,
          created_at,
          updated_at,
          user_id,
          profiles:user_id (display_name, avatar_url)
        `)
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get user's existing review
  const userReview = reviews.find((r: any) => r.user_id === user?.id);

  // Calculate average rating
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  // Submit review mutation
  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (rating === 0) throw new Error("Please select a rating");

      const reviewData = {
        user_id: user.id,
        content_id: contentId,
        rating,
        review_text: reviewText.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("reviews")
          .update({ rating, review_text: reviewText.trim() || null })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert(reviewData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", contentId] });
      setRating(0);
      setReviewText("");
      setIsEditing(false);
      setEditingId(null);
      toast.success(editingId ? "Review updated!" : "Review submitted!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to submit review");
    },
  });

  // Delete review mutation
  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", contentId] });
      toast.success("Review deleted");
    },
    onError: () => {
      toast.error("Failed to delete review");
    },
  });

  const startEditing = (review: any) => {
    setRating(review.rating);
    setReviewText(review.review_text || "");
    setIsEditing(true);
    setEditingId(review.id);
  };

  const cancelEditing = () => {
    setRating(0);
    setReviewText("");
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {averageRating && (
            <>
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              <span className="text-2xl font-bold">{averageRating}</span>
              <span className="text-muted-foreground">/ 5</span>
            </>
          )}
        </div>
        <span className="text-muted-foreground">
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>

      {/* Write Review Form */}
      {user && (!userReview || isEditing) && (
        <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold">
            {isEditing ? "Edit your review" : "Write a review"}
          </h3>

          {/* Star Rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {rating > 0 ? `${rating} star${rating > 1 ? "s" : ""}` : "Select rating"}
            </span>
          </div>

          {/* Review Text */}
          <Textarea
            placeholder="Share your thoughts about this content (optional)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            className="bg-background"
          />

          <div className="flex gap-2">
            <Button
              onClick={() => submitReview.mutate()}
              disabled={rating === 0 || submitReview.isPending}
            >
              {submitReview.isPending ? "Submitting..." : isEditing ? "Update Review" : "Submit Review"}
            </Button>
            {isEditing && (
              <Button variant="outline" onClick={cancelEditing}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-muted-foreground">No reviews yet. Be the first to review!</div>
        ) : (
          reviews.map((review: any) => (
            <div
              key={review.id}
              className="bg-secondary/30 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
                    {review.profiles?.avatar_url ? (
                      <img
                        src={review.profiles.avatar_url}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-brand" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {review.profiles?.display_name || "Anonymous"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit/Delete for own reviews */}
                {user?.id === review.user_id && !isEditing && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(review)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteReview.mutate(review.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {review.review_text && (
                <p className="text-sm text-muted-foreground pl-13">
                  {review.review_text}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
