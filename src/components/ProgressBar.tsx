interface ProgressBarProps {
  progress: number; // 0-100
  current?: number; // Current count (e.g., 5 papers analyzed)
  total?: number; // Total count (e.g., 10 total papers)
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'amber' | 'purple';
  showPercentage?: boolean;
  showCounts?: boolean; // Whether to show "X of Y" counts
  label?: string;
  countLabel?: string; // Label for counts (e.g., "papers", "completed")
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

function ProgressBar({
  progress,
  current,
  total,
  size = 'md',
  color = 'blue',
  showPercentage = true,
  showCounts = false,
  label,
  countLabel = 'papers',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Build the right-side display text
  const getRightSideText = () => {
    const parts: string[] = [];

    // Add counts if available
    if (showCounts && current !== undefined && total !== undefined) {
      parts.push(`${current} of ${total} ${countLabel}`);
    }

    // Add percentage
    if (showPercentage) {
      parts.push(`${Math.round(clampedProgress)}%`);
    }

    return parts.join(' · ');
  };

  return (
    <div className="w-full">
      {(label || showPercentage || showCounts) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {(showPercentage || showCounts) && (
            <span className="text-sm font-medium text-gray-900">
              {getRightSideText()}
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
      >
        <div
          className={`${colorClasses[color]} transition-all duration-300 ease-out rounded-full ${sizeClasses[size]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
