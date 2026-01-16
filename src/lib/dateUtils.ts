/**
 * Safely parse a date string and return a Date object or null if invalid.
 * This prevents crashes when date-fns functions receive invalid dates.
 */
export function safeDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: Date | null | undefined): date is Date {
  return date !== null && date !== undefined && !isNaN(date.getTime());
}
