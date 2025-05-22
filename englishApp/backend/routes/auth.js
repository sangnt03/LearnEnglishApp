const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const pool = require("../config/db")
const router = express.Router()

// Đăng ký
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body

  // Kiểm tra dữ liệu đầu vào
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin" })
  }

  try {
    console.log("Đang xử lý yêu cầu đăng ký cho:", email)

    // Kiểm tra email đã tồn tại
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (userExists.rows.length > 0) {
      console.log("Email đã tồn tại:", email)
      return res.status(400).json({ message: "Email đã tồn tại" })
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Lưu người dùng vào database
    const newUser = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword],
    )

    console.log("Đăng ký thành công cho:", email)
    res.status(201).json({ message: "Đăng ký thành công", user: newUser.rows[0] })
  } catch (error) {
    console.error("Lỗi khi đăng ký:", error)
    res.status(500).json({ message: "Lỗi server khi xử lý đăng ký", error: error.message })
  }
})

// Đăng nhập
router.post("/login", async (req, res) => {
  const { email, password } = req.body
  try {
    // Kiểm tra email
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Email không tồn tại" })
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.rows[0].password)
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu không đúng" })
    }

    // Tạo JWT token
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    })

    // Trả về thông tin người dùng (không bao gồm mật khẩu)
    const { password: _, ...userWithoutPassword } = user.rows[0]

    res.json({ message: "Đăng nhập thành công", token, user: userWithoutPassword })
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error })
  }
})

// Quên mật khẩu
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body
  try {
    // Kiểm tra email
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Email không tồn tại" })
    }

    // Tạo token đặt lại mật khẩu
    const resetToken = crypto.randomBytes(20).toString("hex")
    const resetTokenExpiry = Date.now() + 3600000 // 1 giờ

    // Lưu token vào database
    await pool.query("UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3", [
      resetToken,
      resetTokenExpiry,
      user.rows[0].id,
    ])

    // Trong thực tế, bạn sẽ gửi email với liên kết đặt lại mật khẩu
    // Ví dụ: sendEmail(email, resetToken)

    // Đối với mục đích demo, chúng ta chỉ trả về thông báo thành công
    res.json({
      message: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn",
      // Trong ứng dụng thực tế, KHÔNG trả về token này
      // Chỉ để demo
      resetToken,
    })
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error })
  }
})

// Đặt lại mật khẩu
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body
  try {
    // Tìm người dùng với token đặt lại mật khẩu
    const user = await pool.query("SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > $2", [
      token,
      Date.now(),
    ])

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn" })
    }

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Cập nhật mật khẩu và xóa token đặt lại
    await pool.query("UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2", [
      hashedPassword,
      user.rows[0].id,
    ])

    res.json({ message: "Mật khẩu đã được đặt lại thành công" })
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error })
  }
})

module.exports = router
