// =====================================================
// TYPEBOT BRIDGE - Input Validation
// Validates user input based on TypeBot input types
// =====================================================

import { InputType } from "./bridge"

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate user input based on expected type
 */
export function validateInput(input: string, type: InputType): ValidationResult {
  switch (type) {
    case "text":
      return validateText(input)
    case "number":
      return validateNumber(input)
    case "email":
      return validateEmail(input)
    case "phone":
      return validatePhone(input)
    case "url":
      return validateUrl(input)
    case "date":
      return validateDate(input)
    case "file":
      return { valid: true } // Files are handled separately
    default:
      return { valid: true } // Unknown types pass through
  }
}

/**
 * Validate text input
 */
function validateText(input: string): ValidationResult {
  if (!input || input.trim().length === 0) {
    return {
      valid: false,
      error: "Please enter some text.",
    }
  }

  return { valid: true }
}

/**
 * Validate number input
 */
function validateNumber(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter a number.",
    }
  }

  const number = Number(trimmed)

  if (isNaN(number)) {
    return {
      valid: false,
      error: "Please enter a valid number.",
    }
  }

  return { valid: true }
}

/**
 * Validate email input
 */
function validateEmail(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter an email address.",
    }
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Please enter a valid email address (e.g., user@example.com).",
    }
  }

  return { valid: true }
}

/**
 * Validate phone input
 */
function validatePhone(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter a phone number.",
    }
  }

  // Remove common phone formatting characters
  const cleaned = trimmed.replace(/[\s\-\(\)\+]/g, "")

  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      error: "Please enter a valid phone number (digits only).",
    }
  }

  // Check reasonable length (8-15 digits)
  if (cleaned.length < 8 || cleaned.length > 15) {
    return {
      valid: false,
      error: "Please enter a phone number with 8-15 digits.",
    }
  }

  return { valid: true }
}

/**
 * Validate URL input
 */
function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter a URL.",
    }
  }

  try {
    new URL(trimmed)
    return { valid: true }
  } catch {
    return {
      valid: false,
      error: "Please enter a valid URL (e.g., https://example.com).",
    }
  }
}

/**
 * Validate date input
 */
function validateDate(input: string): ValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      valid: false,
      error: "Please enter a date.",
    }
  }

  // Try parsing as date
  const date = new Date(trimmed)

  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: "Please enter a valid date (e.g., YYYY-MM-DD or DD/MM/YYYY).",
    }
  }

  return { valid: true }
}

/**
 * Get user-friendly validation message for input type
 */
export function getInputTypeInstructions(type: InputType): string {
  const instructions: Record<InputType, string> = {
    text: "Please type your message.",
    number: "Please enter a number (digits only).",
    email: "Please enter a valid email address (e.g., user@example.com).",
    phone: "Please enter your phone number (digits only, 8-15 digits).",
    url: "Please enter a valid URL (e.g., https://example.com).",
    date: "Please enter a date (e.g., YYYY-MM-DD or DD/MM/YYYY).",
    file: "Please send a file.",
  }

  return instructions[type] || "Please provide your response."
}
