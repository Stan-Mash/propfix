import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'propfix_app_settings';

const DEFAULTS = {
  companyName: 'Your Company Name',
  monthlyBudget: 120000,
  unitLabel: 'units',
  unitCostDefault: 65,
};

const AppSettingsContext = createContext({
  settings: DEFAULTS,
  updateSettings: () => {},
});

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSettings(prev => ({ ...prev, ...JSON.parse(raw) }));
      } catch (_) {}
    })();
  }, []);

  const updateSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
