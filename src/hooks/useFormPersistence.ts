import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFormPersistenceOptions<T> {
  key: string;
  initialValue: T;
  userId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormPersistence<T extends Record<string, any>>({
  key,
  initialValue,
  userId,
}: UseFormPersistenceOptions<T>) {
  const storageKey = userId ? `${key}_${userId}` : key;
  const initialValueRef = useRef(initialValue);

  const [formData, setFormData] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialValue, ...parsed };
      }
    } catch (error) {
      console.error('Error loading saved form data:', error);
    }
    return initialValue;
  });

  // Save to localStorage whenever formData changes
  useEffect(() => {
    const hasData = Object.entries(formData).some(([key, value]) => {
      const initial = initialValueRef.current[key];
      return value !== initial && value !== '' && value !== false && value !== null && value !== undefined;
    });
    
    if (hasData) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch (error) {
        console.error('Error saving form data:', error);
      }
    } else {
      // If no meaningful data, remove from storage
      localStorage.removeItem(storageKey);
    }
  }, [formData, storageKey]);

  const clearSavedData = useCallback(() => {
    localStorage.removeItem(storageKey);
    setFormData(initialValueRef.current);
  }, [storageKey]);

  const hasUnsavedData = useCallback(() => {
    return Object.entries(formData).some(([key, value]) => {
      const initial = initialValueRef.current[key];
      return value !== initial && value !== '' && value !== false && value !== null && value !== undefined;
    });
  }, [formData]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const hasSavedDraft = useCallback(() => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  return {
    formData,
    setFormData,
    updateField,
    clearSavedData,
    hasUnsavedData,
    hasSavedDraft,
  };
}
