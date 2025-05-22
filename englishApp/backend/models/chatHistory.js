const db = require("../config/db")

class ChatHistory {
  // Get chat history for a user
  static async getUserChatHistory(userId) {
    try {
      // Check if the chat_history table exists - using PostgreSQL syntax
      const result = await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_history'",
      )

      // PostgreSQL returns an object with a rows property
      const tables = result.rows || []

      if (tables.length === 0) {
        // Table doesn't exist, create it
        console.log("Creating chat_history table...")
        await db.query(`
          CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            model_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `)

        // Create index
        await db.query("CREATE INDEX idx_chat_history_user_id ON chat_history(user_id)")

        // Return empty array since table was just created
        return []
      }

      // Table exists, fetch data
      const chatResult = await db.query("SELECT * FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC", [
        userId,
      ])
      return chatResult.rows || []
    } catch (error) {
      console.error("Database error in getUserChatHistory:", error)
      throw error
    }
  }

  // Get a specific chat by ID
  static async getChatById(chatId) {
    try {
      const result = await db.query("SELECT * FROM chat_history WHERE id = $1", [chatId])
      const rows = result.rows || []
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      console.error("Database error in getChatById:", error)
      throw error
    }
  }

  // Add a new chat
  static async addChat(userId, message, response, modelId) {
    try {
      // Check if the chat_history table exists - using PostgreSQL syntax
      const result = await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_history'",
      )

      const tables = result.rows || []

      if (tables.length === 0) {
        // Table doesn't exist, create it
        console.log("Creating chat_history table...")
        await db.query(`
          CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            model_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `)

        // Create index
        await db.query("CREATE INDEX idx_chat_history_user_id ON chat_history(user_id)")
      }

      // PostgreSQL uses $1, $2, etc. for parameterized queries instead of ?
      const insertResult = await db.query(
        "INSERT INTO chat_history (user_id, message, response, model_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, message, response, modelId],
      )

      // PostgreSQL returns the inserted ID in the rows array
      return insertResult.rows[0].id
    } catch (error) {
      console.error("Database error in addChat:", error)
      throw error
    }
  }

  // Delete a chat
  static async deleteChat(chatId) {
    try {
      const result = await db.query("DELETE FROM chat_history WHERE id = $1", [chatId])
      return result.rowCount > 0
    } catch (error) {
      console.error("Database error in deleteChat:", error)
      throw error
    }
  }

  // Clear all chat history for a user
  static async clearUserChatHistory(userId) {
    try {
      const result = await db.query("DELETE FROM chat_history WHERE user_id = $1", [userId])
      return result.rowCount > 0
    } catch (error) {
      console.error("Database error in clearUserChatHistory:", error)
      throw error
    }
  }
}

module.exports = ChatHistory
