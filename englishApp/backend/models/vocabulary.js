const pool = require("../config/db")

// Create vocabulary table if it doesn't exist
const createVocabularyTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vocabulary (
        id SERIAL PRIMARY KEY,
        headword TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        vietnamese_meaning TEXT,
        topic TEXT,
        image_url TEXT,
        audio_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Vocabulary table created or already exists")

    // Create vocabulary topics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vocabulary_topics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Vocabulary topics table created or already exists")

    // Create user favorite words table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_favorite_words (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, vocabulary_id)
      )
    `)
    console.log("User favorite words table created or already exists")

    // Create user learned words table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_learned_words (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
        mastery_level INTEGER DEFAULT 0,
        last_reviewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, vocabulary_id)
      )
    `)
    console.log("User learned words table created or already exists")

    // Create quiz attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic TEXT,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Quiz attempts table created or already exists")
  } catch (error) {
    console.error("Error creating vocabulary tables:", error)
    throw error
  }
}

// Initialize the table
createVocabularyTable()

module.exports = {
  // Get all vocabulary words with optional filtering
  getAllVocabulary: async (cefr_level = null, topic = null, page = 1, limit = 50) => {
    try {
      const offset = (page - 1) * limit
      let query = "SELECT * FROM vocabulary"
      const queryParams = []
      let paramIndex = 1

      // Add WHERE clause if needed
      if (cefr_level || topic) {
        query += " WHERE"

        if (cefr_level) {
          query += ` cefr_level = $${paramIndex}`
          queryParams.push(cefr_level)
          paramIndex++
        }

        if (topic) {
          if (cefr_level) query += " AND"
          query += ` topic = $${paramIndex}`
          queryParams.push(topic)
          paramIndex++
        }
      }

      query += " ORDER BY headword ASC LIMIT $" + paramIndex + " OFFSET $" + (paramIndex + 1)
      queryParams.push(limit, offset)

      const result = await pool.query(query, queryParams)

      // Get total count for pagination
      let countQuery = "SELECT COUNT(*) FROM vocabulary"
      const countParams = []

      if (cefr_level || topic) {
        countQuery += " WHERE"
        let countParamIndex = 1

        if (cefr_level) {
          countQuery += ` cefr_level = $${countParamIndex}`
          countParams.push(cefr_level)
          countParamIndex++
        }

        if (topic) {
          if (cefr_level) countQuery += " AND"
          countQuery += ` topic = $${countParamIndex}`
          countParams.push(topic)
        }
      }

      const countResult = await pool.query(countQuery, countParams)
      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        words: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting vocabulary:", error)
      throw error
    }
  },

  // Get vocabulary by ID
  getVocabularyById: async (id) => {
    try {
      const result = await pool.query("SELECT * FROM vocabulary WHERE id = $1", [id])
      return result.rows[0]
    } catch (error) {
      console.error("Error getting vocabulary by ID:", error)
      throw error
    }
  },

  // Add a single vocabulary word
  addVocabulary: async (wordData) => {
    try {
      const { headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url } = wordData

      const result = await pool.query(
        "INSERT INTO vocabulary (headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url],
      )

      return result.rows[0]
    } catch (error) {
      console.error("Error adding vocabulary:", error)
      throw error
    }
  },

  // Add multiple vocabulary words
  addMultipleVocabulary: async (vocabularyList) => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      let insertedCount = 0
      for (const item of vocabularyList) {
        // Check if word already exists
        const existingWord = await client.query("SELECT id FROM vocabulary WHERE headword = $1", [item.headword])

        if (existingWord.rows.length === 0) {
          await client.query(
            "INSERT INTO vocabulary (headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              item.headword,
              item.cefr || "A1",
              item.vietnamese_meaning || null,
              item.topic || null,
              item.image_url || null,
              item.audio_url || null,
            ],
          )
          insertedCount++
        }
      }

      await client.query("COMMIT")
      return { success: true, count: insertedCount }
    } catch (error) {
      await client.query("ROLLBACK")
      console.error("Error adding multiple vocabulary:", error)
      throw error
    } finally {
      client.release()
    }
  },

  // Update vocabulary
  updateVocabulary: async (id, wordData) => {
    try {
      const { headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url } = wordData

      const result = await pool.query(
        "UPDATE vocabulary SET headword = $1, cefr_level = $2, vietnamese_meaning = $3, topic = $4, image_url = $5, audio_url = $6 WHERE id = $7 RETURNING *",
        [headword, cefr_level, vietnamese_meaning, topic, image_url, audio_url, id],
      )

      return result.rows[0]
    } catch (error) {
      console.error("Error updating vocabulary:", error)
      throw error
    }
  },

  // Delete vocabulary by ID
  deleteVocabulary: async (id) => {
    try {
      const result = await pool.query("DELETE FROM vocabulary WHERE id = $1 RETURNING *", [id])
      return result.rows[0]
    } catch (error) {
      console.error("Error deleting vocabulary:", error)
      throw error
    }
  },

  // Delete all vocabulary
  deleteAllVocabulary: async () => {
    try {
      await pool.query("DELETE FROM vocabulary")
      return { success: true }
    } catch (error) {
      console.error("Error deleting all vocabulary:", error)
      throw error
    }
  },

  // Get vocabulary statistics
  getVocabularyStats: async () => {
    try {
      const result = await pool.query(`
        SELECT cefr_level, COUNT(*) as count 
        FROM vocabulary 
        GROUP BY cefr_level 
        ORDER BY 
          CASE 
            WHEN cefr_level = 'A1' THEN 1
            WHEN cefr_level = 'A2' THEN 2
            WHEN cefr_level = 'B1' THEN 3
            WHEN cefr_level = 'B2' THEN 4
            WHEN cefr_level = 'C1' THEN 5
            WHEN cefr_level = 'C2' THEN 6
            ELSE 7
          END
      `)

      // First check if the topic column exists
      const checkTopicColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'vocabulary' AND column_name = 'topic'
      `)

      let topicResult = { rows: [] }
      if (checkTopicColumn.rows.length > 0) {
        // Topic column exists, proceed with the query
        topicResult = await pool.query(`
          SELECT topic, COUNT(*) as count 
          FROM vocabulary 
          WHERE topic IS NOT NULL
          GROUP BY topic 
          ORDER BY count DESC
        `)
      }

      const totalResult = await pool.query("SELECT COUNT(*) as total FROM vocabulary")

      return {
        byLevel: result.rows,
        byTopic: topicResult.rows,
        total: Number.parseInt(totalResult.rows[0].total),
      }
    } catch (error) {
      console.error("Error getting vocabulary stats:", error)
      throw error
    }
  },

  // Get all topics
  getAllTopics: async () => {
    try {
      const result = await pool.query("SELECT * FROM vocabulary_topics ORDER BY name ASC")
      return result.rows
    } catch (error) {
      console.error("Error getting vocabulary topics:", error)
      throw error
    }
  },

  // Add a topic
  addTopic: async (name, description = null, image_url = null) => {
    try {
      const result = await pool.query(
        "INSERT INTO vocabulary_topics (name, description, image_url) VALUES ($1, $2, $3) RETURNING *",
        [name, description, image_url],
      )
      return result.rows[0]
    } catch (error) {
      console.error("Error adding vocabulary topic:", error)
      throw error
    }
  },

  // Delete a topic
  deleteTopic: async (id) => {
    try {
      const result = await pool.query("DELETE FROM vocabulary_topics WHERE id = $1 RETURNING *", [id])
      return result.rows[0]
    } catch (error) {
      console.error("Error deleting vocabulary topic:", error)
      throw error
    }
  },

  // Get vocabulary by topic
  getVocabularyByTopic: async (topic, page = 1, limit = 50) => {
    try {
      const offset = (page - 1) * limit

      const result = await pool.query(
        "SELECT * FROM vocabulary WHERE topic = $1 ORDER BY headword ASC LIMIT $2 OFFSET $3",
        [topic, limit, offset],
      )

      const countResult = await pool.query("SELECT COUNT(*) FROM vocabulary WHERE topic = $1", [topic])
      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        words: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting vocabulary by topic:", error)
      throw error
    }
  },

  // Mark word as favorite
  markWordAsFavorite: async (userId, vocabularyId) => {
    try {
      await pool.query(
        "INSERT INTO user_favorite_words (user_id, vocabulary_id) VALUES ($1, $2) ON CONFLICT (user_id, vocabulary_id) DO NOTHING",
        [userId, vocabularyId],
      )
      return { success: true }
    } catch (error) {
      console.error("Error marking word as favorite:", error)
      throw error
    }
  },

  // Unmark word as favorite
  unmarkWordAsFavorite: async (userId, vocabularyId) => {
    try {
      await pool.query("DELETE FROM user_favorite_words WHERE user_id = $1 AND vocabulary_id = $2", [
        userId,
        vocabularyId,
      ])
      return { success: true }
    } catch (error) {
      console.error("Error unmarking word as favorite:", error)
      throw error
    }
  },

  // Get user's favorite words
  getUserFavoriteWords: async (userId, page = 1, limit = 50) => {
    try {
      const offset = (page - 1) * limit

      const result = await pool.query(
        `SELECT v.*, ufw.created_at as favorited_at 
         FROM vocabulary v
         JOIN user_favorite_words ufw ON v.id = ufw.vocabulary_id
         WHERE ufw.user_id = $1
         ORDER BY ufw.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      )

      const countResult = await pool.query("SELECT COUNT(*) FROM user_favorite_words WHERE user_id = $1", [userId])

      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        words: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting user favorite words:", error)
      throw error
    }
  },

  // Check if word is favorite
  isWordFavorite: async (userId, vocabularyId) => {
    try {
      const result = await pool.query("SELECT * FROM user_favorite_words WHERE user_id = $1 AND vocabulary_id = $2", [
        userId,
        vocabularyId,
      ])
      return result.rows.length > 0
    } catch (error) {
      console.error("Error checking if word is favorite:", error)
      throw error
    }
  },

  // Mark word as learned
  markWordAsLearned: async (userId, vocabularyId, masteryLevel = 0) => {
    try {
      await pool.query(
        `INSERT INTO user_learned_words (user_id, vocabulary_id, mastery_level, last_reviewed) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (user_id, vocabulary_id) 
         DO UPDATE SET mastery_level = $3, last_reviewed = NOW()`,
        [userId, vocabularyId, masteryLevel],
      )
      return { success: true }
    } catch (error) {
      console.error("Error marking word as learned:", error)
      throw error
    }
  },

  // Get user's learned words
  getUserLearnedWords: async (userId, page = 1, limit = 50) => {
    try {
      const offset = (page - 1) * limit

      const result = await pool.query(
        `SELECT v.*, ulw.mastery_level, ulw.last_reviewed 
         FROM vocabulary v
         JOIN user_learned_words ulw ON v.id = ulw.vocabulary_id
         WHERE ulw.user_id = $1
         ORDER BY ulw.last_reviewed DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      )

      const countResult = await pool.query("SELECT COUNT(*) FROM user_learned_words WHERE user_id = $1", [userId])

      const totalCount = Number.parseInt(countResult.rows[0].count)

      return {
        words: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      }
    } catch (error) {
      console.error("Error getting user learned words:", error)
      throw error
    }
  },

  // Check if word is learned
  isWordLearned: async (userId, vocabularyId) => {
    try {
      const result = await pool.query("SELECT * FROM user_learned_words WHERE user_id = $1 AND vocabulary_id = $2", [
        userId,
        vocabularyId,
      ])
      return result.rows.length > 0 ? result.rows[0] : null
    } catch (error) {
      console.error("Error checking if word is learned:", error)
      throw error
    }
  },

  // Save quiz attempt
  saveQuizAttempt: async (userId, topic, score, totalQuestions) => {
    try {
      const result = await pool.query(
        "INSERT INTO quiz_attempts (user_id, topic, score, total_questions) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, topic, score, totalQuestions],
      )
      return result.rows[0]
    } catch (error) {
      console.error("Error saving quiz attempt:", error)
      throw error
    }
  },

  // Get user's quiz attempts
  getUserQuizAttempts: async (userId, limit = 10) => {
    try {
      const result = await pool.query(
        "SELECT * FROM quiz_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [userId, limit],
      )
      return result.rows
    } catch (error) {
      console.error("Error getting user quiz attempts:", error)
      throw error
    }
  },

  // Get user's learning statistics
  getUserLearningStats: async (userId) => {
    try {
      const learnedCount = await pool.query("SELECT COUNT(*) FROM user_learned_words WHERE user_id = $1", [userId])

      const favoriteCount = await pool.query("SELECT COUNT(*) FROM user_favorite_words WHERE user_id = $1", [userId])

      const quizCount = await pool.query(
        "SELECT COUNT(*), SUM(score) as total_score, SUM(total_questions) as total_questions FROM quiz_attempts WHERE user_id = $1",
        [userId],
      )

      const masteryLevels = await pool.query(
        `SELECT mastery_level, COUNT(*) 
         FROM user_learned_words 
         WHERE user_id = $1 
         GROUP BY mastery_level 
         ORDER BY mastery_level`,
        [userId],
      )

      return {
        learnedWords: Number.parseInt(learnedCount.rows[0].count),
        favoriteWords: Number.parseInt(favoriteCount.rows[0].count),
        quizAttempts: Number.parseInt(quizCount.rows[0].count),
        quizAvgScore:
          quizCount.rows[0].total_score && quizCount.rows[0].total_questions
            ? Math.round(
                (Number.parseInt(quizCount.rows[0].total_score) / Number.parseInt(quizCount.rows[0].total_questions)) *
                  100,
              )
            : 0,
        masteryLevels: masteryLevels.rows.map((row) => ({
          level: row.mastery_level,
          count: Number.parseInt(row.count),
        })),
      }
    } catch (error) {
      console.error("Error getting user learning stats:", error)
      throw error
    }
  },
}
