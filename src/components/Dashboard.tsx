import { useMemo } from 'react';
import {
  FileText,
  Sparkles,
  Clock,
  BarChart3,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import StatsCard from './StatsCard';
import type { UnifiedPaper } from '../types';

interface DashboardProps {
  papers: UnifiedPaper[];
}

function Dashboard({ papers }: DashboardProps) {
  const stats = useMemo(() => {
    const total = papers.length;
    const analyzed = papers.filter((p) => p.analysis_path).length;
    const arxivCount = papers.filter((p) => p.source === 'arxiv').length;
    const importedCount = papers.filter((p) => p.source === 'imported').length;

    // Get unique dates for reading streak calculation
    const dates = new Set(papers.map((p) => p.date_folder || p.imported_at?.split('T')[0]).filter(Boolean));
    const uniqueDates = dates.size;

    // Category distribution
    const categoryCount: Record<string, number> = {};
    papers.forEach((paper) => {
      paper.categories.forEach((cat) => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    });

    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Analysis rate
    const analysisRate = total > 0 ? (analyzed / total) * 100 : 0;

    return {
      total,
      analyzed,
      arxivCount,
      importedCount,
      uniqueDates,
      topCategories,
      analysisRate,
      pending: total - analyzed,
    };
  }, [papers]);

  if (papers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        </div>
        <span className="text-xs text-gray-500">
          {stats.uniqueDates} active day{stats.uniqueDates !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          icon={FileText}
          label="Total Papers"
          value={stats.total}
          subtext={`${stats.arxivCount} arXiv · ${stats.importedCount} imported`}
          color="blue"
        />
        <StatsCard
          icon={Sparkles}
          label="Analyzed"
          value={stats.analyzed}
          subtext={`${Math.round(stats.analysisRate)}% completion rate`}
          color="amber"
        />
        <StatsCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          subtext={stats.pending > 0 ? 'Ready for analysis' : 'All caught up!'}
          color={stats.pending > 0 ? 'purple' : 'green'}
        />
        <StatsCard
          icon={TrendingUp}
          label="Top Category"
          value={stats.topCategories[0]?.[0].split('.')[1] || 'N/A'}
          subtext={
            stats.topCategories[0]
              ? `${stats.topCategories[0][1]} papers`
              : 'No data'
          }
          color="green"
        />
      </div>

      {/* Top Categories Mini Chart */}
      {stats.topCategories.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Top Categories
            </span>
          </div>
          <div className="space-y-2">
            {stats.topCategories.map(([category, count]) => {
              const percentage = (count / stats.total) * 100;
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20 truncate">
                    {category}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
