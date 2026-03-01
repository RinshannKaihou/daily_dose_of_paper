import { useState, useEffect, useCallback } from 'react';
import type { Config } from '../types';
import { getConfig, saveConfig as saveConfigApi } from '../utils/api';

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = useCallback(async (newConfig: Config) => {
    try {
      await saveConfigApi(newConfig);
      setConfig(newConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
      throw err;
    }
  }, []);

  return { config, loading, error, saveConfig, reload: loadConfig };
}
