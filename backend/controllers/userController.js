const User   = require('../models/User');
const Ticket = require('../models/Ticket');
const { withCache, del, TTL, KEYS } = require('../config/cache');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (admin)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    let query = {};
    if (role)   query.role = role;
    if (search) {
      query.$or = [
        { name:         { $regex: search, $options: 'i' } },
        { email:        { $regex: search, $options: 'i' } },
        { enrollmentId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true, count: users.length, total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page), data: users,
    });
  } catch (error) { next(error); }
};

// @desc    Get single user
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Create user (admin creates agents/admins)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;
    const user = await User.create({ name, email, password, role, department });

    // Invalidate agents cache if creating an agent
    if (['agent', 'admin'].includes(role)) await del(KEYS.agents());

    res.status(201).json({
      success: true,
      data: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) { next(error); }
};

// @desc    Update user
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, department, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, department, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Invalidate caches
    await del(KEYS.agents());
    await del(KEYS.userProfile(req.params.id));

    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// @desc    Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Invalidate caches
    await del(KEYS.agents());
    await del(KEYS.userProfile(req.params.id));

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) { next(error); }
};

// @desc    Get all agents (CACHED — used in ticket assignment dropdown)
// @route   GET /api/users/agents
// @access  Private (admin/agent)
exports.getAgents = async (req, res, next) => {
  try {
    // Agent list changes rarely — cache for 10 minutes
    const { data, fromCache } = await withCache(
      KEYS.agents(),
      TTL.AGENTS,
      async () => {
        return await User.find({ role: { $in: ['agent', 'admin'] }, isActive: true })
          .select('name email role department')
          .sort({ name: 1 });
      }
    );

    const meta = process.env.NODE_ENV === 'development' ? { fromCache } : {};
    res.status(200).json({ success: true, data, ...meta });
  } catch (error) { next(error); }
};
