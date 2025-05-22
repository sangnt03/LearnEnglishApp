const express = require("express")
const router = express.Router()
const auth = require("../middleware/auth")
const ChatHistory = require("../models/chatHistory")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Check if OpenRouter API key is configured
if (!process.env.OPENROUTER_API_KEY) {
  console.warn("OPENROUTER_API_KEY is not set in environment variables")
}

// Route to get user's chat history
router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id
    console.log(`Fetching chat history for user ${userId}`)
    const chatHistory = await ChatHistory.getUserChatHistory(userId)
    res.json(chatHistory)
  } catch (error) {
    console.error("Error fetching chat history:", error)
    res.status(500).json({
      message: "Lỗi khi lấy lịch sử chat",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

// Route to get details of a specific chat
router.get("/history/:id", auth, async (req, res) => {
  try {
    const chatId = req.params.id
    const chat = await ChatHistory.getChatById(chatId)

    if (!chat) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" })
    }

    // Check if user has access to this chat
    if (chat.user_id !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền truy cập cuộc trò chuyện này" })
    }

    res.json(chat)
  } catch (error) {
    console.error("Error fetching chat details:", error)
    res.status(500).json({
      message: "Lỗi khi lấy chi tiết cuộc trò chuyện",
      error: error.message,
    })
  }
})

// Route to send message to AI and get response
router.post("/send", auth, async (req, res) => {
  try {
    const { message, modelId } = req.body
    const userId = req.user.id

    if (!message) {
      return res.status(400).json({ message: "Tin nhắn không được để trống" })
    }

    console.log(`User ${userId} sending message with model ${modelId || "default"}`)

    // For testing/development, use a mock response if OpenRouter API key is missing
    if (!process.env.OPENROUTER_API_KEY) {
      console.log("Using mock response (no API key)")
      const mockResponse =
        "This is a mock response since the OpenRouter API key is not configured. Please contact the administrator to set up the API key for real AI responses."

      // Save conversation to database
      const chatId = await ChatHistory.addChat(userId, message, mockResponse, modelId || "mock")

      return res.json({
        id: chatId,
        message,
        response: mockResponse,
        created_at: new Date(),
        model_id: modelId || "mock",
      })
    }

    // Call OpenRouter API to get response
    try {
      console.log("Calling OpenRouter API...")
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5000", // Change according to your domain
          "X-Title": "English Learning App",
        },
        body: JSON.stringify({
          model: modelId || "nousresearch/deephermes-3-mistral-24b-preview:free", // Use a more affordable model as default
          messages: [
            {
              role: "system",
              content:
                "You are an English language tutor specializing in business English. Help the user learn professional English vocabulary and expressions. Provide explanations in Vietnamese when necessary. Keep responses concise and focused on business contexts.",
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("OpenRouter API error:", errorData)

        // Handle 402 Payment Required error specifically
        if (response.status === 402) {
          return res.status(402).json({
            message:
              "Tài khoản OpenRouter không đủ credits hoặc model yêu cầu thanh toán. Vui lòng thử model khác hoặc liên hệ quản trị viên.",
            error: "PAYMENT_REQUIRED",
          })
        }

        return res.status(response.status).json({
          message: "Lỗi khi gọi API OpenRouter",
          error: errorData,
        })
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content

      // Save conversation to database
      const chatId = await ChatHistory.addChat(userId, message, aiResponse, modelId)

      res.json({
        id: chatId,
        message,
        response: aiResponse,
        created_at: new Date(),
        model_id: modelId,
      })
    } catch (error) {
      console.error("Error calling OpenRouter API:", error)
      res.status(500).json({
        message: "Lỗi khi gọi API OpenRouter",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      })
    }
  } catch (error) {
    console.error("Error sending message:", error)
    res.status(500).json({
      message: "Lỗi khi gửi tin nhắn",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

// Route to get available models from OpenRouter
router.get("/models", auth, async (req, res) => {
  try {
    // Return a list of free and affordable models without calling the API
    // This avoids potential API rate limits or costs
    const affordableModels = [
      {
        id: "nousresearch/deephermes-3-mistral-24b-preview:free",
        name: "GPT-3.5 Turbo",
        description: "Affordable and fast model for general English tutoring",
        context_length: 16385,
      },
      {
        id: "microsoft/phi-4-reasoning:free",
        name: "Claude Instant",
        description: "Fast and affordable model for English learning assistance",
        context_length: 100000,
      },
      {
        id: "meta-llama/llama-3.3-8b-instruct:free",
        name: "Mistral Small",
        description: "Efficient model for English tutoring and explanations",
        context_length: 32000,
      },
      {
        id: "qwen/qwen3-1.7b:free",
        name: "Llama 2 (13B)",
        description: "Open source model for English learning assistance",
        context_length: 4096,
      },
    ]

    res.json(affordableModels)
  } catch (error) {
    console.error("Error fetching models:", error)
    res.status(500).json({
      message: "Lỗi khi lấy danh sách model",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

// Other routes remain the same...
router.delete("/history/:id", auth, async (req, res) => {
  try {
    const chatId = req.params.id
    const chat = await ChatHistory.getChatById(chatId)

    if (!chat) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" })
    }

    // Check if user has permission to delete this chat
    if (chat.user_id !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền xóa cuộc trò chuyện này" })
    }

    const deleted = await ChatHistory.deleteChat(chatId)

    if (deleted) {
      res.json({ message: "Đã xóa cuộc trò chuyện thành công" })
    } else {
      res.status(500).json({ message: "Không thể xóa cuộc trò chuyện" })
    }
  } catch (error) {
    console.error("Error deleting chat:", error)
    res.status(500).json({ message: "Lỗi khi xóa cuộc trò chuyện" })
  }
})

router.delete("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const cleared = await ChatHistory.clearUserChatHistory(userId)

    if (cleared) {
      res.json({ message: "Đã xóa toàn bộ lịch sử chat thành công" })
    } else {
      res.json({ message: "Không có lịch sử chat để xóa" })
    }
  } catch (error) {
    console.error("Error clearing chat history:", error)
    res.status(500).json({ message: "Lỗi khi xóa lịch sử chat" })
  }
})

module.exports = router
