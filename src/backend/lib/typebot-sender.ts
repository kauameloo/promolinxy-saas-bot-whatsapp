// =====================================================
// TYPEBOT BRIDGE - WhatsApp Sender
// Sends TypeBot messages back to WhatsApp
// =====================================================

import { WhatsAppMessage, WhatsAppTextMessage, WhatsAppMediaMessage, WhatsAppButtonsMessage, WhatsAppListMessage } from "../integrations/typebot-bridge"
import { WhatsAppEngine } from "./whatsapp-engine"
import * as fs from "fs"

/**
 * Send TypeBot messages to WhatsApp
 */
export async function sendTypeBotMessages(
  engine: WhatsAppEngine,
  to: string,
  messages: WhatsAppMessage[],
  delay?: number
): Promise<void> {
  try {
    // Apply delay if specified
    if (delay && delay > 0) {
      await sleep(delay)
    }

    for (const message of messages) {
      try {
        // Send message based on type
        switch (message.type) {
          case "text":
            await sendTextMessage(engine, to, message)
            break
          case "media":
            await sendMediaMessage(engine, to, message)
            break
          case "buttons":
            await sendButtonsMessage(engine, to, message)
            break
          case "list":
            await sendListMessage(engine, to, message)
            break
          default:
            console.warn(`[TypeBot Sender] Unknown message type:`, message)
        }

        // Small delay between messages
        await sleep(500)
      } catch (error) {
        console.error(`[TypeBot Sender] Error sending message:`, error)
      }
    }
  } catch (error) {
    console.error(`[TypeBot Sender] Error in sendTypeBotMessages:`, error)
  }
}

/**
 * Send text message
 */
async function sendTextMessage(engine: WhatsAppEngine, to: string, message: WhatsAppTextMessage): Promise<void> {
  await engine.sendMessage({
    to,
    content: message.text,
  })
}

/**
 * Send media message
 */
async function sendMediaMessage(engine: WhatsAppEngine, to: string, message: WhatsAppMediaMessage): Promise<void> {
  // If we have a local file path, send it directly
  if (message.mediaPath && fs.existsSync(message.mediaPath)) {
    try {
      await engine.sendMediaMessage({
        to,
        content: message.caption || "",
        mediaUrl: message.mediaPath,
      })
      
      // Clean up temporary file
      try {
        fs.unlinkSync(message.mediaPath)
      } catch (err) {
        console.warn(`[TypeBot Sender] Failed to delete temp file:`, err)
      }
    } catch (error) {
      console.error(`[TypeBot Sender] Failed to send media from path, trying URL:`, error)
      // Fallback to URL if available
      if (message.mediaUrl) {
        await engine.sendMediaMessage({
          to,
          content: message.caption || "",
          mediaUrl: message.mediaUrl,
        })
      }
    }
  } else if (message.mediaUrl) {
    // Send from URL
    await engine.sendMediaMessage({
      to,
      content: message.caption || "",
      mediaUrl: message.mediaUrl,
    })
  } else {
    console.warn(`[TypeBot Sender] Media message has no URL or path`)
  }
}

/**
 * Send buttons message
 * Note: WhatsApp Web doesn't have native button support via whatsapp-web.js
 * We'll send as text with numbered options
 */
async function sendButtonsMessage(engine: WhatsAppEngine, to: string, message: WhatsAppButtonsMessage): Promise<void> {
  // Format as text with options
  let text = message.text + "\n\n"
  message.buttons.forEach((button, index) => {
    text += `${index + 1}. ${button.label}\n`
  })
  text += "\nReply with the number or text of your choice."

  await engine.sendMessage({
    to,
    content: text,
  })
}

/**
 * Send list message
 * Similar to buttons, format as text with numbered options
 */
async function sendListMessage(engine: WhatsAppEngine, to: string, message: WhatsAppListMessage): Promise<void> {
  // Format as text with options
  let text = `${message.text}\n\n*${message.title}*\n\n`
  
  let optionNumber = 1
  for (const section of message.sections) {
    if (section.title && message.sections.length > 1) {
      text += `\n*${section.title}*\n`
    }
    for (const row of section.rows) {
      text += `${optionNumber}. ${row.title}`
      if (row.description) {
        text += ` - ${row.description}`
      }
      text += "\n"
      optionNumber++
    }
  }
  
  text += "\nReply with the number or text of your choice."

  await engine.sendMessage({
    to,
    content: text,
  })
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
