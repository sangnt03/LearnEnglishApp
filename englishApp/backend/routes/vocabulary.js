const express = require("express")
const router = express.Router()
const multer = require("multer")
const csv = require("csv-parser")
const fs = require("fs")
const axios = require("axios")
const path = require("path")
const vocabularyModel = require("../models/vocabulary")
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true)
    } else {
      cb(new Error("Only CSV files are allowed"))
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
        const headword = data.headword || data.word || data.Headword || data.Word
        const cefr = data.CEFR || data.cefr || data.cefr_level || data.level || data.Level

        if (headword && cefr) {
          results.push({
            headword: headword.trim(),
            cefr: cefr.trim().toUpperCase(),
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

// Get all vocabulary words (with optional filtering)
router.get("/", auth, async (req, res) => {
  try {
    const { cefr_level, topic, page = 1, limit = 50 } = req.query
    const result = await vocabularyModel.getAllVocabulary(
      cefr_level,
      topic,
      Number.parseInt(page),
      Number.parseInt(limit),
    )
    res.json(result)
  } catch (error) {
    console.error("Error fetching vocabulary:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách từ vựng", error: error.message })
  }
})

// Get vocabulary statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await vocabularyModel.getVocabularyStats()
    res.json(stats)
  } catch (error) {
    console.error("Error fetching vocabulary stats:", error)
    res.status(500).json({ message: "Lỗi khi lấy thống kê từ vựng", error: error.message })
  }
})

// Get vocabulary by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const word = await vocabularyModel.getVocabularyById(req.params.id)
    if (!word) {
      return res.status(404).json({ message: "Không tìm thấy từ vựng" })
    }
    res.json(word)
  } catch (error) {
    console.error("Error fetching vocabulary by ID:", error)
    res.status(500).json({ message: "Lỗi khi lấy thông tin từ vựng", error: error.message })
  }
})

// Add a single vocabulary word (admin only)
router.post("/", adminAuth, async (req, res) => {
  try {
    const { headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url } = req.body

    if (!headword || !cefr_level) {
      return res.status(400).json({ message: "Thiếu thông tin từ vựng hoặc cấp độ CEFR" })
    }

    const word = await vocabularyModel.addVocabulary({
      headword,
      cefr_level,
      vietnamese_meaning,
      topic,
      image_url,
      audio_url,
    })

    res.status(201).json(word)
  } catch (error) {
    console.error("Error adding vocabulary:", error)
    res.status(500).json({ message: "Lỗi khi thêm từ vựng", error: error.message })
  }
})

// Upload vocabulary from local file (admin only)
router.post("/upload", adminAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file được tải lên" })
    }

    const filePath = req.file.path
    const vocabularyData = await processCSVData(filePath)

    // Delete the temporary file
    fs.unlinkSync(filePath)

    if (vocabularyData.length === 0) {
      return res.status(400).json({ message: "Không tìm thấy dữ liệu từ vựng hợp lệ trong file" })
    }

    const result = await vocabularyModel.addMultipleVocabulary(vocabularyData)

    res.status(201).json({
      message: `Đã thêm ${result.count} từ vựng mới`,
      totalProcessed: vocabularyData.length,
      newWordsAdded: result.count,
    })
  } catch (error) {
    console.error("Error uploading vocabulary file:", error)
    res.status(500).json({ message: "Lỗi khi tải lên file từ vựng", error: error.message })
  }
})

// Upload vocabulary from URL (admin only)
router.post("/upload-from-url", adminAuth, async (req, res) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ message: "URL không được cung cấp" })
    }

    // Download the file
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    })

    const tempFilePath = path.join("uploads", `temp_${Date.now()}.csv`)
    const writer = fs.createWriteStream(tempFilePath)

    response.data.pipe(writer)

    writer.on("finish", async () => {
      try {
        const vocabularyData = await processCSVData(tempFilePath)

        // Delete the temporary file
        fs.unlinkSync(tempFilePath)

        if (vocabularyData.length === 0) {
          return res.status(400).json({ message: "Không tìm thấy dữ liệu từ vựng hợp lệ trong file" })
        }

        const result = await vocabularyModel.addMultipleVocabulary(vocabularyData)

        res.status(201).json({
          message: `Đã thêm ${result.count} từ vựng mới`,
          totalProcessed: vocabularyData.length,
          newWordsAdded: result.count,
        })
      } catch (error) {
        console.error("Error processing downloaded file:", error)
        res.status(500).json({ message: "Lỗi khi xử lý file đã tải", error: error.message })
      }
    })

    writer.on("error", (error) => {
      console.error("Error writing file:", error)
      res.status(500).json({ message: "Lỗi khi tải file từ URL", error: error.message })
    })
  } catch (error) {
    console.error("Error uploading vocabulary from URL:", error)
    res.status(500).json({ message: "Lỗi khi tải từ vựng từ URL", error: error.message })
  }
})

// Delete vocabulary by ID (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const word = await vocabularyModel.deleteVocabulary(req.params.id)
    if (!word) {
      return res.status(404).json({ message: "Không tìm thấy từ vựng" })
    }
    res.json({ message: "Đã xóa từ vựng thành công", word })
  } catch (error) {
    console.error("Error deleting vocabulary:", error)
    res.status(500).json({ message: "Lỗi khi xóa từ vựng", error: error.message })
  }
})

// Delete all vocabulary (admin only)
router.delete("/", adminAuth, async (req, res) => {
  try {
    await vocabularyModel.deleteAllVocabulary()
    res.json({ message: "Đã xóa tất cả từ vựng thành công" })
  } catch (error) {
    console.error("Error deleting all vocabulary:", error)
    res.status(500).json({ message: "Lỗi khi xóa tất cả từ vựng", error: error.message })
  }
})

// Thêm route cập nhật từ vựng
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url } = req.body

    if (!headword || !cefr_level) {
      return res.status(400).json({ message: "Thiếu thông tin từ vựng hoặc cấp độ CEFR" })
    }

    const word = await vocabularyModel.updateVocabulary(req.params.id, {
      headword,
      cefr_level,
      vietnamese_meaning,
      topic,
      image_url,
      audio_url,
    })

    if (!word) {
      return res.status(404).json({ message: "Không tìm thấy từ vựng" })
    }

    res.json(word)
  } catch (error) {
    console.error("Error updating vocabulary:", error)
    res.status(500).json({ message: "Lỗi khi cập nhật từ vựng", error: error.message })
  }
})

module.exports = router
