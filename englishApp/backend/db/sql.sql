-- Create vocabulary table
CREATE TABLE IF NOT EXISTS vocabulary (
  id SERIAL PRIMARY KEY,
  headword TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_vocabulary_headword ON vocabulary(headword);
CREATE INDEX IF NOT EXISTS idx_vocabulary_cefr_level ON vocabulary(cefr_level);

-- Create user_vocabulary table for tracking user progress
CREATE TABLE IF NOT EXISTS user_vocabulary (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new', -- new, learning, mastered
  last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  times_practiced INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vocabulary_id)
);

-- Create index for faster user vocabulary lookups
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user_id ON user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_vocabulary_id ON user_vocabulary(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_status ON user_vocabulary(status);

-- Create vocabulary_examples table for storing example sentences
CREATE TABLE IF NOT EXISTS vocabulary_examples (
  id SERIAL PRIMARY KEY,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  example_text TEXT NOT NULL,
  translation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster example lookups
CREATE INDEX IF NOT EXISTS idx_vocabulary_examples_vocabulary_id ON vocabulary_examples(vocabulary_id);


-- Create table for speech practice sentences
CREATE TABLE IF NOT EXISTS speech_practice_sentences (
  id SERIAL PRIMARY KEY,
  sentence TEXT NOT NULL,
  translation TEXT,
  difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for user speech practice attempts
CREATE TABLE IF NOT EXISTS user_speech_practice (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  sentence_id INT NOT NULL,
  accuracy FLOAT NOT NULL,
  audio_url TEXT,
  practiced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sentence_id) REFERENCES speech_practice_sentences(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_speech_practice_user_id ON user_speech_practice(user_id);
CREATE INDEX IF NOT EXISTS idx_speech_practice_sentences_category ON speech_practice_sentences(category);
CREATE INDEX IF NOT EXISTS idx_speech_practice_sentences_difficulty ON speech_practice_sentences(difficulty);

