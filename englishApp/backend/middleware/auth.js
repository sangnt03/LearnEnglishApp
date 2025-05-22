const jwt = require("jsonwebtoken")

module.exports = (req, res, next) => {
  try {
    // Get token from header
    let token = req.header("x-auth-token")

    // Also check Authorization header (Bearer token)
    if (!token && req.header("Authorization")) {
      const authHeader = req.header("Authorization")
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7)
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Không có token, quyền truy cập bị từ chối" })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Save user info to request
    req.user = decoded

    next()
  } catch (error) {
    res.status(401).json({ message: "Token không hợp lệ" })
  }
}
