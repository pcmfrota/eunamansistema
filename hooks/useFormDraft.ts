'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Professional useFormDraft hook.
 * Persists form data to localStorage and provides helpers for input changes.
 */
export function useFormDraft<T extends Record<string, any>>(key: string, initialValues: T) {
  const [form, setForm] = useState<T>(initialValues)
  const [isLoaded, setIsLoaded] = useState(false)

  // Memoized key to ensure persistence per form
  const storageKey = useMemo(() => `@eunaman:draft:${key}`, [key])

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Merge with initial values to ensure new fields are present
        setForm(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Error parsing form draft:', e)
      }
    }
    setIsLoaded(true)
  }, [storageKey])

  // Save to localStorage whenever form changes, but only after initial load
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(storageKey, JSON.stringify(form))
    }
  }, [form, storageKey, isLoaded])

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    
    setForm(prev => ({
      ...prev,
      [name]: val
    }))
  }, [])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey)
    setForm(initialValues)
  }, [storageKey, initialValues])

  // Helper to check if the current form is different from initial (has content)
  const hasContent = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialValues)
  }, [form, initialValues])

  return {
    form,
    setForm,
    handleInputChange,
    clearDraft,
    hasContent,
    isLoaded
  }
}
