'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Professional useFormDraft hook.
 * Persists form data to localStorage and provides helpers for input changes.
 */
export function useFormDraft<T extends Record<string, any>>(key: string | null, initialValues: T) {
  const [form, setForm] = useState<T>(initialValues)
  const [isLoaded, setIsLoaded] = useState(false)

  // Memoized key to ensure persistence per form
  const storageKey = useMemo(() => key ? `@eunaman:draft:${key}` : null, [key])

  // Load draft on mount
  useEffect(() => {
    if (!storageKey) {
      setIsLoaded(true)
      return
    }
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Remove date fields from the draft so they always initialize with today's date
        // and aren't cached from previous days.
        const cleanParsed = { ...parsed }
        Object.keys(cleanParsed).forEach(key => {
          if (key.startsWith('data_') || key === 'ultimaAtualizacao') {
            delete cleanParsed[key]
          }
        })
        
        // Merge with initial values to ensure new fields are present
        setForm(prev => ({ ...prev, ...cleanParsed }))
      } catch (e) {
        console.error('Error parsing form draft:', e)
      }
    }
    setIsLoaded(true)
  }, [storageKey])

  // Save to localStorage whenever form changes, but only after initial load
  useEffect(() => {
    if (isLoaded && storageKey) {
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
    if (storageKey) {
      localStorage.removeItem(storageKey)
    }
    setForm(initialValues)
  }, [storageKey, initialValues])

  const hasContent = useMemo(() => {
    // Basic check: if any field has content beyond initial
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
