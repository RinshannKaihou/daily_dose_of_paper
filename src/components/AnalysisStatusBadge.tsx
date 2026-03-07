import { Sparkles, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface AnalysisStatusBadgeProps {
  status: 'analyzed' | 'pending' | 'analyzing' | 'error';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig = {
  analyzed: {
    icon: CheckCircle,
    label: 'Analyzed',
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
  analyzing: {
    icon: Sparkles,
    label: 'Analyzing...',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

function AnalysisStatusBadge({
  status,
  size = 'sm',
  showLabel = true,
}: AnalysisStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
    >
      <Icon className={`${iconSizes[size]} ${status === 'analyzing' ? 'animate-pulse' : ''}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export default AnalysisStatusBadge;
