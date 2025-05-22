-- Bảng chủ đề chat
CREATE TABLE IF NOT EXISTS chat_topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10) DEFAULT '💬',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng cấp độ chat
CREATE TABLE IF NOT EXISTS chat_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  difficulty_order INT NOT NULL DEFAULT 1,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng model AI
CREATE TABLE IF NOT EXISTS chat_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng lịch sử chat
CREATE TABLE IF NOT EXISTS chat_histories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  topic_id INT NOT NULL,
  level_id INT NOT NULL,
  model_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES chat_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES chat_levels(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES chat_models(id) ON DELETE CASCADE
);

-- Bảng tin nhắn chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id INT NOT NULL,
  role ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chat_histories(id) ON DELETE CASCADE
);

-- Thêm dữ liệu mẫu cho chủ đề
INSERT INTO chat_topics (name, description, icon) VALUES
('Giới thiệu bản thân', 'Học cách giới thiệu bản thân và hỏi thông tin cá nhân', '👋'),
('Du lịch', 'Đặt phòng khách sạn, hỏi đường, và trò chuyện về du lịch', '✈️'),
('Nhà hàng', 'Đặt bàn, gọi món, và trò chuyện trong nhà hàng', '🍽️'),
('Mua sắm', 'Mua sắm quần áo, thực phẩm, và mặc cả', '🛍️'),
('Công việc', 'Phỏng vấn việc làm và trò chuyện trong môi trường công sở', '💼'),
('Sở thích', 'Nói về sở thích, thể thao, và các hoạt động giải trí', '🎮'),
('Y tế', 'Đi khám bác sĩ và nói về vấn đề sức khỏe', '🏥'),
('Thời tiết', 'Trò chuyện về thời tiết và các hiện tượng tự nhiên', '☀️');

-- Thêm dữ liệu mẫu cho cấp độ
INSERT INTO chat_levels (name, description, difficulty_order, system_prompt) VALUES
('Sơ cấp', 'Dành cho người mới bắt đầu học tiếng Anh', 1, 'Bạn là một người bạn đang giúp người dùng học tiếng Anh ở cấp độ sơ cấp. Hãy sử dụng từ vựng và ngữ pháp đơn giản, nói chậm và rõ ràng. Giải thích các từ khó bằng tiếng Việt nếu cần. Sửa lỗi ngữ pháp và phát âm một cách nhẹ nhàng. Khuyến khích người dùng nói nhiều hơn và đặt câu hỏi đơn giản để họ trả lời.'),
('Trung cấp', 'Dành cho người đã có kiến thức cơ bản về tiếng Anh', 2, 'Bạn là một người bạn đang giúp người dùng học tiếng Anh ở cấp độ trung cấp. Sử dụng từ vựng và cấu trúc câu đa dạng hơn, nhưng vẫn dễ hiểu. Chỉ giải thích bằng tiếng Việt khi thực sự cần thiết. Sửa lỗi ngữ pháp và từ vựng khi người dùng mắc lỗi. Khuyến khích người dùng sử dụng các cấu trúc câu phức tạp hơn và mở rộng vốn từ vựng.'),
('Cao cấp', 'Dành cho người đã thành thạo tiếng Anh và muốn nâng cao kỹ năng', 3, 'Bạn là một người bạn đang giúp người dùng học tiếng Anh ở cấp độ cao cấp. Sử dụng tiếng Anh tự nhiên với từ vựng phong phú và cấu trúc câu đa dạng. Không sử dụng tiếng Việt trừ khi người dùng yêu cầu. Thảo luận các chủ đề phức tạp và trừu tượng. Sửa lỗi tinh tế và đưa ra gợi ý để cải thiện cách diễn đạt. Khuyến khích người dùng sử dụng thành ngữ, tục ngữ và các cách diễn đạt tự nhiên.'),
('Người bản xứ', 'Trò chuyện như với người bản xứ', 4, 'Bạn là một người bản xứ nói tiếng Anh đang trò chuyện với người dùng. Sử dụng tiếng Anh tự nhiên, bao gồm thành ngữ, từ lóng, và cách diễn đạt thông dụng. Nói với tốc độ bình thường như khi nói với người bản xứ khác. Chỉ sửa lỗi khi được yêu cầu. Thảo luận mọi chủ đề một cách tự nhiên và sâu sắc. Mục tiêu là tạo ra trải nghiệm giao tiếp thực tế nhất có thể.');

-- Thêm dữ liệu mẫu cho model
INSERT INTO chat_models (name, model_id, description, is_active) VALUES
('Claude 3.5 Sonnet', 'anthropic/claude-3-5-sonnet', 'Model mạnh nhất của Anthropic, cân bằng giữa hiệu suất và chi phí', TRUE),
('Claude 3 Opus', 'anthropic/claude-3-opus', 'Model cao cấp nhất của Anthropic, hiệu suất tốt nhất', TRUE),
('GPT-4o', 'openai/gpt-4o', 'Model mới nhất của OpenAI, hiệu suất cao và đa năng', TRUE),
('Llama 3 70B', 'meta-llama/llama-3-70b-instruct', 'Model mạnh mẽ từ Meta với khả năng đa ngôn ngữ tốt', TRUE);
