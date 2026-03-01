import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Plus, X, Loader2, FolderOpen, RefreshCw } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';
import { scanMyPapersDir } from '../utils/api';
import type { Config } from '../types';
import { open } from '@tauri-apps/plugin-dialog';

const DATE_RANGE_OPTIONS = [
  { value: 'last1day', label: 'Last 1 day' },
  { value: 'last3days', label: 'Last 3 days' },
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
];

const CATEGORY_OPTIONS = [
  { value: 'cs.CL', label: 'Computation and Language (cs.CL)' },
  { value: 'cs.LG', label: 'Machine Learning (cs.LG)' },
  { value: 'cs.AI', label: 'Artificial Intelligence (cs.AI)' },
  { value: 'cs.CV', label: 'Computer Vision (cs.CV)' },
  { value: 'cs.NE', label: 'Neural and Evolutionary Computing (cs.NE)' },
  { value: 'cs.RO', label: 'Robotics (cs.RO)' },
  { value: 'stat.ML', label: 'Machine Learning (stat.ML)' },
];

function Settings() {
  const { config, loading, saveConfig } = useConfig();
  const [localConfig, setLocalConfig] = useState<Config | null>(null);
  const [newQuery, setNewQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = async () => {
    if (!localConfig) return;
    try {
      setSaving(true);
      await saveConfig(localConfig);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addQuery = () => {
    if (!localConfig || !newQuery.trim()) return;
    setLocalConfig({
      ...localConfig,
      search_queries: [...localConfig.search_queries, newQuery.trim()],
    });
    setNewQuery('');
  };

  const removeQuery = (index: number) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      search_queries: localConfig.search_queries.filter((_, i) => i !== index),
    });
  };

  const toggleCategory = (category: string) => {
    if (!localConfig) return;
    const categories = localConfig.categories.includes(category)
      ? localConfig.categories.filter((c) => c !== category)
      : [...localConfig.categories, category];
    setLocalConfig({ ...localConfig, categories });
  };

  if (loading || !localConfig) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {saveMessage && (
          <div
              className={`mb-4 p-3 rounded-lg ${
              saveMessage.includes('success')
                || (saveMessage.startsWith('Indexed') && saveMessage.includes('failed 0'))
                || saveMessage === 'Scanning directory...'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {saveMessage}
          </div>
        )}

        {/* Search Queries */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Queries</h2>
          <p className="text-sm text-gray-500 mb-4">
            Topics to search for on arXiv. Papers matching these topics will be fetched.
          </p>

          <div className="space-y-2 mb-4">
            {localConfig.search_queries.map((query, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
              >
                <span className="text-gray-700">{query}</span>
                <button
                  onClick={() => removeQuery(index)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQuery()}
              placeholder="Add new search query..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={addQuery}
              disabled={!newQuery.trim()}
              className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Categories</h2>
          <p className="text-sm text-gray-500 mb-4">
            Filter papers by arXiv categories. Leave empty to search all categories.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  localConfig.categories.includes(option.value)
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={localConfig.categories.includes(option.value)}
                  onChange={() => toggleCategory(option.value)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Fetch Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fetch Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Papers Per Day
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={localConfig.max_papers_per_day}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    max_papers_per_day: parseInt(e.target.value) || 10,
                  })
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={localConfig.date_range}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, date_range: e.target.value })
                }
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* My Papers Directory */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Papers Directory</h2>
          <p className="text-sm text-gray-500 mb-4">
            Set a folder containing your personal PDF collection. Papers will be automatically loaded
            and available to add to projects.
          </p>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={localConfig.my_papers_dir || ''}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, my_papers_dir: e.target.value || null })
                }
                placeholder="/path/to/your/papers"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              />
              <button
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: 'Select My Papers Directory',
                  });
                  if (selected) {
                    setLocalConfig({ ...localConfig, my_papers_dir: selected as string });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>

            {localConfig.my_papers_dir && (
              <button
                onClick={async () => {
                  try {
                    // Save config first to ensure the backend reads the correct my_papers_dir
                    await saveConfig(localConfig);
                    setSaveMessage('Scanning directory...');
                    const scan = await scanMyPapersDir();
                    const summary =
                      `Indexed ${scan.indexed}, updated ${scan.updated}, skipped ${scan.skipped}, failed ${scan.failed}.`;
                    const warningSuffix = scan.warnings.length > 0 ? ` Warning: ${scan.warnings[0]}` : '';
                    setSaveMessage(summary + warningSuffix);
                    setTimeout(() => setSaveMessage(''), 3000);
                  } catch (err) {
                    setSaveMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Scan for New Papers
              </button>
            )}
          </div>
        </div>

        {/* About */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">About Daily Dose of Paper</h2>
          <p className="text-sm text-gray-600">
            A desktop application that helps you stay up-to-date with the latest research papers on
            arXiv. Powered by Claude AI for intelligent paper analysis and daily reviews.
          </p>
          <p className="text-xs text-gray-400 mt-4">Version 0.1.0</p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
