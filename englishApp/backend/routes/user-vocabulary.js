const express = require("express")
const router = express.Router()
const vocabularyModel = require("../models/vocabulary")
const auth = require("../middleware/auth")

// Mark word as favorite
router.post("/favorites/:vocabularyId", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const vocabularyId = req.params.vocabularyId

    // Check if vocabulary exists
    const vocabulary = await vocabularyModel.getVocabularyById(vocabularyId)
    if (!vocabulary) {
      return res.status(404).json({ message: "Không tìm thấy từ vựng" })
    }

    await vocabularyModel.markWordAsFavorite(userId, vocabularyId)
    res.json({ message: "Đã đánh dấu từ vựng là yêu thích" })
  } catch (error) {
    console.error("Error marking word as favorite:", error)
    res.status(500).json({ message: "Lỗi khi đánh dấu từ vựng yêu thích", error: error.message })
  }
})

// Unmark word as favorite
router.delete("/favorites/:vocabularyId", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const vocabularyId = req.params.vocabularyId

    await vocabularyModel.unmarkWordAsFavorite(userId, vocabularyId)
    res.json({ message: "Đã bỏ đánh dấu từ vựng yêu thích" })
  } catch (error) {
    console.error("Error unmarking word as favorite:", error)
    res.status(500).json({ message: "Lỗi khi bỏ đánh dấu từ vựng yêu thích", error: error.message })
  }
})

// Get user's favorite words
router.get("/favorites", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 50 } = req.query

    const result = await vocabularyModel.getUserFavoriteWords(userId, Number.parseInt(page), Number.parseInt(limit))

    res.json(result)
  } catch (error) {
    console.error("Error getting user favorite words:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách từ vựng yêu thích", error: error.message })
  }
})

// Check if word is favorite
router.get("/favorites/:vocabularyId", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const vocabularyId = req.params.vocabularyId

    const isFavorite = await vocabularyModel.isWordFavorite(userId, vocabularyId)
    res.json({ isFavorite })
  } catch (error) {
    console.error("Error checking if word is favorite:", error)
    res.status(500).json({ message: "Lỗi khi kiểm tra từ vựng yêu thích", error: error.message })
  }
})

// Mark word as learned
router.post("/learned/:vocabularyId", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const vocabularyId = req.params.vocabularyId
    const { masteryLevel = 0 } = req.body

    // Check if vocabulary exists
    const vocabulary = await vocabularyModel.getVocabularyById(vocabularyId)
    if (!vocabulary) {
      return res.status(404).json({ message: "Không tìm thấy từ vựng" })
    }

    await vocabularyModel.markWordAsLearned(userId, vocabularyId, masteryLevel)
    res.json({ message: "Đã đánh dấu từ vựng là đã học" })
  } catch (error) {
    console.error("Error marking word as learned:", error)
    res.status(500).json({ message: "Lỗi khi đánh dấu từ vựng đã học", error: error.message })
  }
})

// Get user's learned words
router.get("/learned", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { page = 1, limit = 50 } = req.query

    const result = await vocabularyModel.getUserLearnedWords(userId, Number.parseInt(page), Number.parseInt(limit))

    res.json(result)
  } catch (error) {
    console.error("Error getting user learned words:", error)
    res.status(500).json({ message: "Lỗi khi lấy danh sách từ vựng đã học", error: error.message })
  }
})

// Check if word is learned
router.get("/learned/:vocabularyId", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const vocabularyId = req.params.vocabularyId

    const learnedInfo = await vocabularyModel.isWordLearned(userId, vocabularyId)
    res.json({
      isLearned: !!learnedInfo,
      masteryLevel: learnedInfo ? learnedInfo.mastery_level : 0,
      lastReviewed: learnedInfo ? learnedInfo.last_reviewed : null,
    })
  } catch (error) {
    console.error("Error checking if word is learned:", error)
    res.status(500).json({ message: "Lỗi khi kiểm tra từ vựng đã học", error: error.message })
  }
})

// Save quiz attempt
router.post("/quiz-attempts", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { topic, score, totalQuestions } = req.body

    if (score === undefined || totalQuestions === undefined) {
      return res.status(400).json({ message: "Thiếu thông tin điểm số hoặc tổng số câu hỏi" })
    }

    const attempt = await vocabularyModel.saveQuizAttempt(userId, topic, score, totalQuestions)
    res.status(201).json(attempt)
  } catch (error) {
    console.error("Error saving quiz attempt:", error)
    res.status(500).json({ message: "Lỗi khi lưu kết quả bài kiểm tra", error: error.message })
  }
})

// Get user's quiz attempts
router.get("/quiz-attempts", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 10 } = req.query

    const attempts = await vocabularyModel.getUserQuizAttempts(userId, Number.parseInt(limit))
    res.json(attempts)
  } catch (error) {
    console.error("Error getting user quiz attempts:", error)
    res.status(500).json({ message: "Lỗi khi lấy lịch sử bài kiểm tra", error: error.message })
  }
})

// Get user's learning statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.id

    const stats = await vocabularyModel.getUserLearningStats(userId)
    res.json(stats)
  } catch (error) {
    console.error("Error getting user learning stats:", error)
    res.status(500).json({ message: "Lỗi khi lấy thống kê học tập", error: error.message })
  }
})

module.exports = router
