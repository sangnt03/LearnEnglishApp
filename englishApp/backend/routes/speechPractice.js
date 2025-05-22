const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const csv = require("csv-parser")
const speechPracticeModel = require("../models/speechPractice")
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/speech")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, "speech-" + uniqueSuffix + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // CSV file types
    const csvTypes = ["text/csv", "application/csv", "application/vnd.ms-excel", "text/x-csv", "application/x-csv"]
    // Audio file types
    const audioTypes = [
      "audio/wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/webm",
      "audio/m4a",
      "audio/x-m4a",
    ]

    if (csvTypes.includes(file.mimetype) || audioTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Chỉ chấp nhận file CSV hoặc audio (MP3, WAV, OGG, etc.). File của bạn: ${file.mimetype}`))
    }
  },
})

// Helper function to process CSV data
const processCSVData = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Normalize column names (they might vary)
        const sentence = data.sentence || data.text || data.content || Object.values(data)[0]
        const translation = data.translation || data.vietnamese || data.meaning || Object.values(data)[1] || null
        const difficulty = data.difficulty || data.level || "medium"
        const category = data.category || data.topic || "general"

        if (sentence) {
          results.push({
            sentence: sentence.trim(),
            translation: translation ? translation.trim() : null,
            difficulty: difficulty.trim().toLowerCase(),
            category: category.trim().toLowerCase(),
          })
        }
      })
      .on("end", () => {
        resolve(results)
      })
      .on("error", (error) => {
        reject(error)
      })
  })
}

// Get all sentences (with optional filtering)
router.get("/sentences", auth, async (req, res) => {
  try {
    const { difficulty, category, page = 1, limit = 20 } = req.query
    const result = await speechPracticeModel.getAllSentences(
      difficulty,
      category,
      Number.parseInt(page),
      Number.parseInt(limit),
    )
    res.json(result)
  } catch (error) {
    console.error("Error fetching speech practice sentences:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách câu luyện nói", error: error.message })
  }
})

// Get sentence by ID
router.get("/sentences/:id", auth, async (req, res) => {
  try {
    const sentence = await speechPracticeModel.getSentenceById(req.params.id)
    if (!sentence) {
      return res.status(404).json({ message: "Không tìm thấy câu luyện nói" })
    }
    res.json(sentence)
  } catch (error) {
    console.error("Error fetching speech practice sentence:", error)
    res.status(500).json({ message: "Lỗi khi lấy thông tin câu luyện nói", error: error.message })
  }
})

// Add a new sentence (admin only)
router.post("/sentences", adminAuth, async (req, res) => {
  try {
    const { sentence, translation, difficulty, category } = req.body

    if (!sentence) {
      return res.status(400).json({ message: "Câu luyện nói là bắt buộc" })
    }

    const result = await speechPracticeModel.addSentence(sentence, translation, difficulty, category)
    res.status(201).json(result)
  } catch (error) {
    console.error("Error adding speech practice sentence:", error)
    res.status(500).json({ message: "Lỗi khi thêm câu luyện nói", error: error.message })
  }
})

// Upload sentences from CSV file (admin only)
router.post("/upload", adminAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được tải lên" })
    }

    const filePath = req.file.path
    const sentencesData = await processCSVData(filePath)

    // Delete the temporary file
    fs.unlinkSync(filePath)

    if (sentencesData.length === 0) {
      return res.status(400).json({ message: "Không tìm thấy dữ liệu câu luyện nói hợp lệ trong file" })
    }

    const result = await speechPracticeModel.addMultipleSentences(sentencesData)

    res.status(201).json({
      message: `Đã thêm ${result.count} câu luyện nói mới`,
      totalProcessed: sentencesData.length,
      newSentencesAdded: result.count,
    })
  } catch (error) {
    console.error("Error uploading speech practice sentences:", error)
    res.status(500).json({ message: "Lỗi khi tải lên file câu luyện nói", error: error.message })
  }
})

// Update a sentence (admin only)
router.put("/sentences/:id", adminAuth, async (req, res) => {
  try {
    const { sentence, translation, difficulty, category } = req.body

    if (!sentence) {
      return res.status(400).json({ message: "Câu luyện nói là bắt buộc" })
    }

    const result = await speechPracticeModel.updateSentence(req.params.id, sentence, translation, difficulty, category)

    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy câu luyện nói" })
    }

    res.json(result)
  } catch (error) {
    console.error("Error updating speech practice sentence:", error)
    res.status(500).json({ message: "Lỗi khi cập nhật câu luyện nói", error: error.message })
  }
})

// Delete a sentence (admin only)
router.delete("/sentences/:id", adminAuth, async (req, res) => {
  try {
    const result = await speechPracticeModel.deleteSentence(req.params.id)

    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy câu luyện nói" })
    }

    res.json({ message: "Đã xóa câu luyện nói thành công", sentence: result })
  } catch (error) {
    console.error("Error deleting speech practice sentence:", error)
    res.status(500).json({ message: "Lỗi khi xóa câu luyện nói", error: error.message })
  }
})

// Save user practice attempt
router.post("/practice", auth, upload.single("audio"), async (req, res) => {
  try {
    const { sentenceId, accuracy } = req.body
    const userId = req.user.id

    if (!sentenceId || accuracy === undefined) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" })
    }

    let audioUrl = null
    if (req.file) {
      // Create a relative URL for the audio file
      audioUrl = `/uploads/speech/${req.file.filename}`
    }

    const result = await speechPracticeModel.saveUserPractice(userId, sentenceId, accuracy, audioUrl)
    res.status(201).json(result)
  } catch (error) {
    console.error("Error saving user speech practice:", error)
    res.status(500).json({ message: "Lỗi khi lưu kết quả luyện nói", error: error.message })
  }
})

// Get user practice history
router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 20 } = req.query

    const result = await speechPracticeModel.getUserPracticeHistory(
      userId,
      Number.parseInt(page),
      Number.parseInt(limit),
    )
    res.json(result)
  } catch (error) {
    console.error("Error fetching user speech practice history:", error)
    res.status(500).json({ message: "Lỗi khi lấy lịch sử luyện nói", error: error.message })
  }
})

// Get user practice statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const stats = await speechPracticeModel.getUserPracticeStats(userId)
    res.json(stats)
  } catch (error) {
    console.error("Error fetching user speech practice stats:", error)
    res.status(500).json({ message: "Lỗi khi lấy thống kê luyện nói", error: error.message })
  }
})

// Get speech practice categories
router.get("/categories", auth, async (req, res) => {
  try {
    const categories = await speechPracticeModel.getCategories()
    res.json(categories)
  } catch (error) {
    console.error("Error fetching speech practice categories:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách chủ đề luyện nói", error: error.message })
  }
})

// Get speech practice statistics (admin only)
router.get("/admin/stats", adminAuth, async (req, res) => {
  try {
    const stats = await speechPracticeModel.getStats()
    res.json(stats)
  } catch (error) {
    console.error("Error fetching speech practice stats:", error)
    res.status(500).json({ message: "Lỗi khi lấy thống kê luyện nói", error: error.message })
  }
})

// Delete a specific practice history entry
router.delete("/history/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const practiceId = req.params.id

    const result = await speechPracticeModel.deleteUserPractice(userId, practiceId)

    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi luyện nói" })
    }

    res.json({ message: "Đã xóa bản ghi luyện nói thành công", practice: result })
  } catch (error) {
    console.error("Error deleting speech practice history:", error)
    res.status(500).json({ message: "Lỗi khi xóa bản ghi luyện nói", error: error.message })
  }
})

// Delete all practice history for a user
router.delete("/history", auth, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await speechPracticeModel.deleteAllUserPractices(userId)

    res.json({
      message: `Đã xóa ${result.count} bản ghi luyện nói`,
      count: result.count,
    })
  } catch (error) {
    console.error("Error deleting all speech practice history:", error)
    res.status(500).json({ message: "Lỗi khi xóa lịch sử luyện nói", error: error.message })
  }
})

module.exports = router
