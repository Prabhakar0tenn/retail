const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

/**
 * GET /api/products
 * Query params:
 *   - search (string)  : search by name or tags (comma-separated or single)
 *   - tag   (string)  : filter by exact tag
 *   - page  (number)  : pagination page (default 1)
 *   - limit (number)  : items per page (default 20, max 100)
 *   - sort  (string)  : 'newest' | 'oldest' | 'price_asc' | 'price_desc'
 *   - featured (bool) : filter featured products
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      tag = '',
      page = 1,
      limit = 20,
      sort = 'newest',
      featured,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter = {};

    if (search.trim()) {
      // Split search into words and build a flexible regex
      const searchWords = search.trim().toLowerCase().split(/\s+/);
      const regexPatterns = searchWords.map((w) => new RegExp(w, 'i'));

      filter.$or = [
        { name: { $in: regexPatterns } },
        { tags: { $in: regexPatterns } },
        { description: { $in: regexPatterns } },
        // Also match any word in the name
        { name: new RegExp(search.trim(), 'i') },
      ];
    }

    if (tag.trim()) {
      filter.tags = tag.trim().toLowerCase();
    }

    if (featured === 'true') {
      filter.featured = true;
    }

    // Build sort object
    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.newest;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/tags
 * Returns all unique tags in the database (for autocomplete / tag cloud)
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await Product.distinct('tags');
    const sortedTags = tags.filter(Boolean).sort();
    res.json({ success: true, data: sortedTags });
  } catch (err) {
    console.error('GET /api/products/tags error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tags' });
  }
});

/**
 * GET /api/products/:id
 * Fetch single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    console.error('GET /api/products/:id error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

module.exports = router;
