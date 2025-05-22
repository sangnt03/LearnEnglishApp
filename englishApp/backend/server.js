const express = require("express")
const cors = require("cors")
const morgan = require("morgan")
const path = require("path")
const multer = require("multer")
const fs = require("fs")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Import routes
const authRoutes = require("./routes/auth")
const adminRoutes = require("./routes/admin")
const vocabularyRoutes = require("./routes/vocabulary")
const userVocabularyRoutes = require("./routes/user-vocabulary")
const topicsRoutes = require("./routes/topics")
const speechPracticeRoutes = require("./routes/speechPractice")
const chatRoutes = require("./routes/chat")
// Initialize express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(morgan("dev"))

// Set up file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir)
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage })

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/vocabulary", vocabularyRoutes)
app.use("/api/user-vocabulary", userVocabularyRoutes)
app.use("/api/topics", topicsRoutes)
app.use("/api/speech-practice", speechPracticeRoutes)
app.use("/api/chat", chatRoutes)

// Default route
app.get("/", (req, res) => {
  res.send("English Learning App API")
})

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
