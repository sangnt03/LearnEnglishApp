const jwt = require("jsonwebtoken")
const pool = require("../config/db")

module.exports = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.header("x-auth-token")

    if (!token) {
      return res.status(401).json({ message: "Không có token, quyền truy cập bị từ chối" })
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Kiểm tra xem người dùng có phải là admin không
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Không có quyền truy cập" })
    }

    // Kiểm tra xem admin có tồn tại trong database không
    const admin = await pool.query("SELECT * FROM users WHERE id = $1 AND is_admin = true", [decoded.id])

    if (admin.rows.length === 0) {
      return res.status(403).json({ message: "Không có quyền truy cập" })
    }

    // Lưu thông tin admin vào request
    req.admin = {
      id: decoded.id,
      isAdmin: true,
    }

    next()
  } catch (error) {
    console.error("Lỗi xác thực admin:", error)
    res.status(401).json({ message: "Token không hợp lệ" })
  }
}
