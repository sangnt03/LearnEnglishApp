const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const pool = require("../config/db")
const router = express.Router()
const auth = require("../middleware/auth")
const adminAuth = require("../middleware/adminAuth")

// Đăng nhập dành cho Admin
router.post("/login", async (req, res) => {
  const { email, password } = req.body

  try {
    // Kiểm tra email
    const admin = await pool.query("SELECT * FROM users WHERE email = $1 AND is_admin = true", [email])

    if (admin.rows.length === 0) {
      return res.status(401).json({ message: "Email không tồn tại hoặc không phải tài khoản quản trị viên" })
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, admin.rows[0].password)
    if (!isMatch) {
      return res.status(401).json({ message: "Mật khẩu không đúng" })
    }

    // Tạo JWT token với role admin
    const token = jwt.sign(
      {
        id: admin.rows[0].id,
        isAdmin: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    )

    // Trả về thông tin admin (không bao gồm mật khẩu)
    const { password: _, ...adminWithoutPassword } = admin.rows[0]

    res.json({
      message: "Đăng nhập thành công",
      token,
      admin: adminWithoutPassword,
    })
  } catch (error) {
    console.error("Lỗi đăng nhập admin:", error)
    res.status(500).json({ message: "Lỗi server", error: error.message })
  }
})

// Lấy danh sách người dùng (yêu cầu xác thực admin)
router.get("/users", adminAuth, async (req, res) => {
  try {
    const users = await pool.query(
      "SELECT id, username, email, created_at, is_admin FROM users ORDER BY created_at DESC",
    )

    res.json({ users: users.rows })
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error)
    res.status(500).json({ message: "Lỗi server", error: error.message })
  }
})

// Xóa người dùng (yêu cầu xác thực admin)
router.delete("/users/:id", adminAuth, async (req, res) => {
  const userId = req.params.id

  try {
    // Kiểm tra người dùng tồn tại
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId])

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "Người dùng không tồn tại" })
    }

    // Xóa người dùng
    await pool.query("DELETE FROM users WHERE id = $1", [userId])

    res.json({ message: "Xóa người dùng thành công" })
  } catch (error) {
    console.error("Lỗi xóa người dùng:", error)
    res.status(500).json({ message: "Lỗi server", error: error.message })
  }
})

// Thêm quản trị viên mới (yêu cầu xác thực admin)
router.post("/create", adminAuth, async (req, res) => {
  const { username, email, password } = req.body

  // Kiểm tra dữ liệu đầu vào
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin" })
  }

  try {
    // Kiểm tra email đã tồn tại
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" })
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Lưu quản trị viên mới vào database
    const newAdmin = await pool.query(
      "INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, true) RETURNING id, username, email, is_admin",
      [username, email, hashedPassword],
    )

    res.status(201).json({
      message: "Tạo quản trị viên mới thành công",
      admin: newAdmin.rows[0],
    })
  } catch (error) {
    console.error("Lỗi tạo quản trị viên:", error)
    res.status(500).json({ message: "Lỗi server", error: error.message })
  }
})

// Lấy thông tin tổng quan (dashboard)
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    // Đếm tổng số người dùng
    const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE is_admin = false")

    // Đếm số người dùng mới trong 7 ngày qua
    const newUsers = await pool.query(
      "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days' AND is_admin = false",
    )

    // Thêm các thống kê khác tùy theo nhu cầu

    res.json({
      totalUsers: Number.parseInt(userCount.rows[0].count),
      newUsers: Number.parseInt(newUsers.rows[0].count),
      // Thêm các thống kê khác
    })
  } catch (error) {
    console.error("Lỗi lấy thông tin dashboard:", error)
    res.status(500).json({ message: "Lỗi server", error: error.message })
  }
})

module.exports = router
