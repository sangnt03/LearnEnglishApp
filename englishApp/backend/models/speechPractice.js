const pool = require("../config/db")

// Create speech practice tables if they don't exist
const createSpeechPracticeTables = async () => {
  try {
    // Create table for speech practice sentences
    await pool.query(`
      CREATE TABLE IF NOT EXISTS speech_practice_sentences (
        id SERIAL PRIMARY KEY,
        sentence TEXT NOT NULL,
        translation TEXT,
        difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
        category VARCHAR(50) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Speech practice sentences table created or already exists")

    // Create table for user speech practice attempts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_speech_practice (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        sentence_id INT NOT NULL,
        accuracy FLOAT NOT NULL,
        audio_url TEXT,
        practiced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sentence_id) REFERENCES speech_practice_sentences(id) ON DELETE CASCADE
      )
    `)
    console.log("User speech practice table created or already exists")

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_speech_practice_user_id ON user_speech_practice(user_id);
      CREATE INDEX IF NOT EXISTS idx_speech_practice_sentences_category ON speech_practice_sentences(category);
      CREATE INDEX IF NOT EXISTS idx_speech_practice_sentences_difficulty ON speech_practice_sentences(difficulty);
    `)
    console.log("Speech practice indexes created or already exist")
  } catch (error) {
    console.error("Error creating speech practice tables:", error)
    throw error
  }
}

// Initialize the tables
createSpeechPracticeTables()

module.exports = {
  // Get all speech practice sentences with optional filtering
  getAllSentences: async (difficulty = null, category = null, page = 1, limit = 20) => {
    try {
      const offset = (page - 1) * limit
      let query = "SELECT * FROM speech_practice_sentences"
      const queryParams = []
      let paramIndex = 1

      // Add WHERE clause if needed
      if (difficulty || category) {
        query += " WHERE"

        if (difficulty) {
          query += ` difficulty = $${paramIndex}`
          queryParams.push(difficulty)
          paramIndex++
        }

        if (category) {
          if (difficulty) query += " AND"
          query += ` category = $${paramIndex}`
          queryParams.push(category)
          paramIndex++
        }
      }

      query += " ORDER BY id ASC LIMIT $" + paramIndex + " OFFSET $" + (paramIndex + 1)
      queryParams.push(limit, offset)

      const result = await pool.query(query, queryParams)

      // Get total count for pagination
      let countQuery = "SELECT COUNT(*) FROM speech_practice_sentences"
      const countParams = []

      if (difficulty || category) {
        countQuery += " WHERE"
        let countParamIndex = 1

        if (difficulty) {
          countQuery += ` difficulty = $${countParamIndex}`
          countParams.push(difficulty)
          countParamIndex++
        }

        if (category) {
          if (difficulty) countQuery += " AND"
          countQuery += ` category = $${countParamIndex}`
          countParams.push(category)
        }
      }

      const countResult = await pool.query(countQuery, countParams)
      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        sentences: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting speech practice sentences:", error)
      throw error
    }
  },

  // Get sentence by ID
  getSentenceById: async (id) => {
    try {
      const result = await pool.query("SELECT * FROM speech_practice_sentences WHERE id = $1", [id])
      return result.rows[0]
    } catch (error) {
      console.error("Error getting speech practice sentence by ID:", error)
      throw error
    }
  },

  // Add a new sentence
  addSentence: async (sentence, translation = null, difficulty = "medium", category = "general") => {
    try {
      const result = await pool.query(
        "INSERT INTO speech_practice_sentences (sentence, translation, difficulty, category) VALUES ($1, $2, $3, $4) RETURNING *",
        [sentence, translation, difficulty, category],
      )
      return result.rows[0]
    } catch (error) {
      console.error("Error adding speech practice sentence:", error)
      throw error
    }
  },

  // Add multiple sentences
  addMultipleSentences: async (sentences) => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      let insertedCount = 0
      for (const item of sentences) {
        // Check if sentence already exists
        const existingSentence = await client.query("SELECT id FROM speech_practice_sentences WHERE sentence = $1", [
          item.sentence,
        ])

        if (existingSentence.rows.length === 0) {
          await client.query(
            "INSERT INTO speech_practice_sentences (sentence, translation, difficulty, category) VALUES ($1, $2, $3, $4)",
            [item.sentence, item.translation || null, item.difficulty || "medium", item.category || "general"],
          )
          insertedCount++
        }
      }

      await client.query("COMMIT")
      return { success: true, count: insertedCount }
    } catch (error) {
      await client.query("ROLLBACK")
      console.error("Error adding multiple speech practice sentences:", error)
      throw error
    } finally {
      client.release()
    }
  },

  // Update a sentence
  updateSentence: async (id, sentence, translation = null, difficulty = "medium", category = "general") => {
    try {
      const result = await pool.query(
        "UPDATE speech_practice_sentences SET sentence = $1, translation = $2, difficulty = $3, category = $4 WHERE id = $5 RETURNING *",
        [sentence, translation, difficulty, category, id],
      )
      return result.rows[0]
    } catch (error) {
      console.error("Error updating speech practice sentence:", error)
      throw error
    }
  },

  // Delete a sentence
  deleteSentence: async (id) => {
    try {
      const result = await pool.query("DELETE FROM speech_practice_sentences WHERE id = $1 RETURNING *", [id])
      return result.rows[0]
    } catch (error) {
      console.error("Error deleting speech practice sentence:", error)
      throw error
    }
  },

  // Save user practice attempt
  saveUserPractice: async (userId, sentenceId, accuracy, audioUrl = null) => {
    try {
      const result = await pool.query(
        "INSERT INTO user_speech_practice (user_id, sentence_id, accuracy, audio_url) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, sentenceId, accuracy, audioUrl],
      )
      return result.rows[0]
    } catch (error) {
      console.error("Error saving user speech practice:", error)
      throw error
    }
  },

  // Get user practice history
  getUserPracticeHistory: async (userId, page = 1, limit = 20) => {
    try {
      const offset = (page - 1) * limit

      const result = await pool.query(
        `SELECT usp.*, sps.sentence, sps.translation, sps.difficulty, sps.category
         FROM user_speech_practice usp
         JOIN speech_practice_sentences sps ON usp.sentence_id = sps.id
         WHERE usp.user_id = $1
         ORDER BY usp.practiced_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      )

      const countResult = await pool.query("SELECT COUNT(*) FROM user_speech_practice WHERE user_id = $1", [userId])
      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        history: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting user speech practice history:", error)
      throw error
    }
  },

  // Get user practice statistics
  getUserPracticeStats: async (userId) => {
    try {
      // Get total practice count
      const countResult = await pool.query("SELECT COUNT(*) FROM user_speech_practice WHERE user_id = $1", [userId])
      const totalPractices = Number.parseInt(countResult.rows[0].count)

      // Get average accuracy
      const avgResult = await pool.query("SELECT AVG(accuracy) FROM user_speech_practice WHERE user_id = $1", [userId])
      const avgAccuracy = avgResult.rows[0].avg ? Number.parseFloat(avgResult.rows[0].avg) : 0

      // Get practice count by difficulty
      const difficultyResult = await pool.query(
        `SELECT sps.difficulty, COUNT(*) 
         FROM user_speech_practice usp
         JOIN speech_practice_sentences sps ON usp.sentence_id = sps.id
         WHERE usp.user_id = $1
         GROUP BY sps.difficulty`,
        [userId],
      )

      // Get practice count by category
      const categoryResult = await pool.query(
        `SELECT sps.category, COUNT(*) 
         FROM user_speech_practice usp
         JOIN speech_practice_sentences sps ON usp.sentence_id = sps.id
         WHERE usp.user_id = $1
         GROUP BY sps.category`,
        [userId],
      )

      // Get recent progress (last 7 days)
      const progressResult = await pool.query(
        `SELECT DATE(practiced_at) as practice_date, AVG(accuracy) as avg_accuracy, COUNT(*) as count
         FROM user_speech_practice
         WHERE user_id = $1 AND practiced_at > NOW() - INTERVAL '7 days'
         GROUP BY DATE(practiced_at)
         ORDER BY practice_date`,
        [userId],
      )

      return {
        totalPractices,
        avgAccuracy,
        byDifficulty: difficultyResult.rows,
        byCategory: categoryResult.rows,
        recentProgress: progressResult.rows,
      }
    } catch (error) {
      console.error("Error getting user speech practice stats:", error)
      throw error
    }
  },

  // Get speech practice categories
  getCategories: async () => {
    try {
      const result = await pool.query("SELECT DISTINCT category FROM speech_practice_sentences ORDER BY category")
      return result.rows.map((row) => row.category)
    } catch (error) {
      console.error("Error getting speech practice categories:", error)
      throw error
    }
  },

  // Get speech practice statistics
  getStats: async () => {
    try {
      // Get total sentences count
      const totalResult = await pool.query("SELECT COUNT(*) FROM speech_practice_sentences")
      const total = Number.parseInt(totalResult.rows[0].count)

      // Get count by difficulty
      const difficultyResult = await pool.query(
        "SELECT difficulty, COUNT(*) FROM speech_practice_sentences GROUP BY difficulty",
      )

      // Get count by category
      const categoryResult = await pool.query(
        "SELECT category, COUNT(*) FROM speech_practice_sentences GROUP BY category",
      )

      return {
        total,
        byDifficulty: difficultyResult.rows,
        byCategory: categoryResult.rows,
      }
    } catch (error) {
      console.error("Error getting speech practice stats:", error)
      throw error
    }
  },

  // Delete a specific user practice entry
  deleteUserPractice: async (userId, practiceId) => {
    try {
      const result = await pool.query("DELETE FROM user_speech_practice WHERE id = $1 AND user_id = $2 RETURNING *", [
        practiceId,
        userId,
      ])
      return result.rows[0]
    } catch (error) {
      console.error("Error deleting user speech practice:", error)
      throw error
    }
  },

  // Delete all practice history for a user
  deleteAllUserPractices: async (userId) => {
    try {
      const result = await pool.query("DELETE FROM user_speech_practice WHERE user_id = $1 RETURNING id", [userId])
      return { count: result.rowCount }
    } catch (error) {
      console.error("Error deleting all user speech practices:", error)
      throw error
    }
  },
}
