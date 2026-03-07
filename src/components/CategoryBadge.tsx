interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
}

// Color mapping for arXiv categories
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  // Computation and Language
  'cs.CL': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  // Machine Learning
  'cs.LG': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  // Artificial Intelligence
  'cs.AI': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  // Computer Vision
  'cs.CV': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  // Neural and Evolutionary Computing
  'cs.NE': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  // Robotics
  'cs.RO': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  // Statistics - Machine Learning
  'stat.ML': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  // Information Retrieval
  'cs.IR': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  // Databases
  'cs.DB': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  // Distributed Computing
  'cs.DC': { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  // Software Engineering
  'cs.SE': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  // Programming Languages
  'cs.PL': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  // Information Theory
  'cs.IT': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  // Cryptography
  'cs.CR': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  // Human-Computer Interaction
  'cs.HC': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  // Multiagent Systems
  'cs.MA': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  // Computation and Game Theory
  'cs.GT': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  // Data Structures and Algorithms
  'cs.DS': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

// Fallback color for unknown categories
const defaultColor = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };

function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const colors = categoryColors[category] || defaultColor;
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} transition-all hover:shadow-sm`}
      title={category}
    >
      {category}
    </span>
  );
}

export default CategoryBadge;
