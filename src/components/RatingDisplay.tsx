import { Star, Sparkles } from 'lucide-react';

interface RatingDisplayProps {
  rating?: number; // 1-5 or 1-10
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

function RatingDisplay({
  rating,
  maxRating = 5,
  size = 'md',
  showLabel = true,
}: RatingDisplayProps) {
  if (rating === undefined || rating === null) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm">Not rated</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: { star: 'w-3 h-3', text: 'text-xs' },
    md: { star: 'w-4 h-4', text: 'text-sm' },
    lg: { star: 'w-5 h-5', text: 'text-base' },
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

  // Determine color based on rating
  const getRatingColor = () => {
    const percentage = rating / maxRating;
    if (percentage >= 0.8) return 'text-green-500';
    if (percentage >= 0.6) return 'text-blue-500';
    if (percentage >= 0.4) return 'text-amber-500';
    return 'text-gray-400';
  };

  const getRatingLabel = () => {
    const percentage = rating / maxRating;
    if (percentage >= 0.9) return 'Must Read';
    if (percentage >= 0.8) return 'Highly Recommended';
    if (percentage >= 0.7) return 'Recommended';
    if (percentage >= 0.6) return 'Worth Reading';
    if (percentage >= 0.4) return 'Optional';
    return 'Low Priority';
  };

  const colorClass = getRatingColor();
  const classes = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star
            key={`full-${i}`}
            className={`${classes.star} ${colorClass} fill-current`}
          />
        ))}
        {/* Half star */}
        {hasHalfStar && (
          <div className="relative">
            <Star className={`${classes.star} text-gray-300`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${classes.star} ${colorClass} fill-current`} />
            </div>
          </div>
        )}
        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${classes.star} text-gray-300`} />
        ))}
      </div>
      {showLabel && (
        <span className={`${classes.text} font-medium ${colorClass}`}>
          {rating.toFixed(1)}/{maxRating} · {getRatingLabel()}
        </span>
      )}
    </div>
  );
}

export default RatingDisplay;
