const express = require("express")
const router = express.Router()
const vocabularyModel = require("../models/vocabulary")
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/topics")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, "topic-" + uniqueSuffix + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (extname && mimetype) {
      return cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"))
    }
  },
})

// Get all topics
router.get("/", auth, async (req, res) => {
  try {
    const topics = await vocabularyModel.getAllTopics()
    res.json(topics)
  } catch (error) {
    console.error("Error fetching topics:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách chủ đề", error: error.message })
  }
})

// Add a new topic (admin only)
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body

    if (!name) {
      return res.status(400).json({ message: "Tên chủ đề là bắt buộc" })
    }

    let imageUrl = null
    if (req.file) {
      // Create a relative URL for the image
      imageUrl = `/uploads/topics/${req.file.filename}`
    }

    const topic = await vocabularyModel.addTopic(name, description, imageUrl)
    res.status(201).json(topic)
  } catch (error) {
    console.error("Error adding topic:", error)
    res.status(500).json({ message: "Lỗi khi thêm chủ đề", error: error.message })
  }
})

// Delete a topic (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const topic = await vocabularyModel.deleteTopic(req.params.id)

    if (!topic) {
      return res.status(404).json({ message: "Không tìm thấy chủ đề" })
    }

    // Delete the topic image if it exists
    if (topic.image_url) {
      const imagePath = path.join(__dirname, "..", topic.image_url)
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath)
      }
    }

    res.json({ message: "Đã xóa chủ đề thành công", topic })
  } catch (error) {
    console.error("Error deleting topic:", error)
    res.status(500).json({ message: "Lỗi khi xóa chủ đề", error: error.message })
  }
})

// Get vocabulary by topic
router.get("/:topic/words", auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const result = await vocabularyModel.getVocabularyByTopic(
      req.params.topic,
      Number.parseInt(page),
      Number.parseInt(limit),
    )
    res.json(result)
  } catch (error) {
    console.error("Error fetching vocabulary by topic:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách từ vựng theo chủ đề", error: error.message })
  }
})

module.exports = router
