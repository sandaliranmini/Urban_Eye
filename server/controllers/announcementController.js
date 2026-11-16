const Announcement = require('../models/Announcement');
const AuditService = require('../services/auditService');
const { AppError } = require('../middleware/errorMiddleware');

const CATEGORIES = Announcement.CATEGORIES;

/**
 * List all announcements with optional filters & pagination
 * GET /api/announcements
 */
exports.listAnnouncements = async (req, res, next) => {
  try {
    const {
      council_id,
      ward_id,
      category,
      is_pinned,
      active_only,
      search,
      page = 1,
      limit = 20,
      sort = 'pinned',
    } = req.query;

    const result = await Announcement.findAll({
      council_id: council_id ? Number(council_id) : undefined,
      ward_id: ward_id !== undefined && ward_id !== '' ? ward_id : undefined,
      category,
      is_pinned: is_pinned !== undefined && is_pinned !== '' ? is_pinned === '1' || is_pinned === 'true' : undefined,
      active_only: active_only === '1' || active_only === 'true',
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort,
    });

    res.json({
      success: true,
      data: result.announcements,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get announcements for a specific ward
 * GET /api/announcements/ward/:wardId
 */
exports.getAnnouncementsByWard = async (req, res, next) => {
  try {
    const wardId = Number(req.params.wardId);
    if (!Number.isInteger(wardId) || wardId < 1) {
      throw new AppError('Valid ward ID is required', 400);
    }

    const councilId = req.query.council_id ? Number(req.query.council_id) : (req.user?.council_id || null);
    const activeOnly = req.query.active_only !== '0' && req.query.active_only !== 'false';
    const limit = Number(req.query.limit) || 50;

    const announcements = await Announcement.findByWard(wardId, {
      council_id: councilId,
      active_only: activeOnly,
      limit,
    });

    res.json({
      success: true,
      data: announcements,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single announcement
 * GET /api/announcements/:id
 */
exports.getAnnouncement = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Valid announcement ID is required', 400);
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    res.json({
      success: true,
      data: announcement,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create announcement
 * POST /api/announcements
 */
exports.createAnnouncement = async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const content = String(body.body || '').trim();
    const category = body.category;
    const wardId = body.ward_id !== undefined && body.ward_id !== null && body.ward_id !== '' && body.ward_id !== 'null'
      ? Number(body.ward_id)
      : null;
    const isPinned = Boolean(body.is_pinned === true || body.is_pinned === 'true' || body.is_pinned === 1 || body.is_pinned === '1');
    const expiresAt = body.expires_at ? new Date(body.expires_at) : null;

    const errors = [];
    if (!title || title.length < 3 || title.length > 150) {
      errors.push('Title must be between 3 and 150 characters');
    }
    if (!content || content.length < 5) {
      errors.push('Body content must be at least 5 characters');
    }
    if (!CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${CATEGORIES.join(', ')}`);
    }
    if (wardId !== null && (!Number.isInteger(wardId) || wardId < 1)) {
      errors.push('Ward ID must be a valid positive integer or null');
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      errors.push('Expires at must be a valid date');
    }

    if (errors.length) {
      throw new AppError(errors.join('. '), 400);
    }

    const officerId = req.user?.officer_id ?? req.user?.id;
    if (!officerId) {
      throw new AppError('Officer identification required to post announcement', 401);
    }

    const councilId = req.body.council_id
      ? Number(req.body.council_id)
      : (req.user?.council_id || 1);

    const announcementId = await Announcement.create({
      council_id: councilId,
      ward_id: wardId,
      officer_id: officerId,
      title,
      body: content,
      category,
      is_pinned: isPinned,
      expires_at: expiresAt,
    });

    const created = await Announcement.findById(announcementId);

    // Audit Log
    await AuditService.logAnnouncementCreated({
      announcementId,
      title,
      category,
      wardId,
      councilId,
      user: req.user,
      req,
    });

    // Real-time notification via Socket.IO
    try {
      const { emitWardAnnouncement, getIO } = require('../config/socket');
      if (wardId) {
        emitWardAnnouncement(wardId, created);
      } else {
        getIO().emit('announcement:new', created);
      }
    } catch {
      // Non-blocking in test/uninitialized socket environments
    }

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update announcement
 * PUT /api/announcements/:id
 */
exports.updateAnnouncement = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Valid announcement ID is required', 400);
    }

    const existing = await Announcement.findById(id);
    if (!existing) {
      throw new AppError('Announcement not found', 404);
    }

    // Role verification: Admin can edit any; Supervisor/Officer can edit if within council/ward or author
    const userRole = String(req.user?.role || '').toLowerCase();
    const officerId = req.user?.officer_id ?? req.user?.id;
    if (userRole !== 'admin' && existing.OFFICER_ID !== officerId && userRole !== 'supervisor') {
      throw new AppError('Forbidden: You can only edit announcements you authored', 403);
    }

    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (title.length < 3 || title.length > 150) {
        throw new AppError('Title must be between 3 and 150 characters', 400);
      }
      updates.title = title;
    }

    if (body.body !== undefined) {
      const content = String(body.body).trim();
      if (content.length < 5) {
        throw new AppError('Body must be at least 5 characters', 400);
      }
      updates.body = content;
    }

    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) {
        throw new AppError(`Category must be one of: ${CATEGORIES.join(', ')}`, 400);
      }
      updates.category = body.category;
    }

    if (body.ward_id !== undefined) {
      updates.ward_id = body.ward_id !== null && body.ward_id !== '' && body.ward_id !== 'null'
        ? Number(body.ward_id)
        : null;
    }

    if (body.is_pinned !== undefined) {
      updates.is_pinned = Boolean(body.is_pinned === true || body.is_pinned === 'true' || body.is_pinned === 1 || body.is_pinned === '1');
    }

    if (body.expires_at !== undefined) {
      if (body.expires_at === null || body.expires_at === '') {
        updates.expires_at = null;
      } else {
        const d = new Date(body.expires_at);
        if (Number.isNaN(d.getTime())) {
          throw new AppError('Expires at must be a valid date', 400);
        }
        updates.expires_at = d;
      }
    }

    await Announcement.update(id, updates);
    const updated = await Announcement.findById(id);

    // Audit log
    await AuditService.logAnnouncementUpdated({
      announcementId: id,
      oldState: existing,
      newState: updated,
      user: req.user,
      req,
    });

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete announcement
 * DELETE /api/announcements/:id
 */
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Valid announcement ID is required', 400);
    }

    const existing = await Announcement.findById(id);
    if (!existing) {
      throw new AppError('Announcement not found', 404);
    }

    const userRole = String(req.user?.role || '').toLowerCase();
    const officerId = req.user?.officer_id ?? req.user?.id;
    if (userRole !== 'admin' && existing.OFFICER_ID !== officerId && userRole !== 'supervisor') {
      throw new AppError('Forbidden: You can only delete announcements you authored', 403);
    }

    await Announcement.delete(id);

    // Audit log
    await AuditService.logAnnouncementDeleted({
      announcementId: id,
      oldState: existing,
      user: req.user,
      req,
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
