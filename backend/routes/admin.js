const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');

// ─── Helper: parse tags from request body ────────────────────────────────────
const parseTags = (rawTags) => {
  if (!rawTags) return [];
  // Support: JSON array string, comma-separated string, or plain array
  if (Array.isArray(rawTags)) {
    return rawTags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(rawTags);
    if (Array.isArray(parsed)) {
      return parsed.map((t) => t.toLowerCase().trim()).filter(Boolean);
    }
  } catch (_) {
    // fall through to comma split
  }
  return rawTags
    .split(',')
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean);
};

// ─── POST /api/admin/products ─────────────────────────────────────────────────
/**
 * Create a new product
 * Body (multipart/form-data):
 *   name        (string, required)
 *   price       (number, required)
 *   tags        (string | JSON array string | comma-separated)
 *   description (string, optional)
 *   featured    (boolean, optional)
 *   inStock     (boolean, optional)
 *   image       (file, optional)
 */
router.post('/products', upload.single('image'), async (req, res) => {
  try {
    const { name, price, tags, description, featured, inStock } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    if (price === undefined || price === null || price === '') {
      return res.status(400).json({ success: false, message: 'Price is required' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
    }

    // Upload image if provided
    let imageData = { url: '', publicId: '' };
    if (req.file) {
      imageData = await uploadToCloudinary(req.file.buffer);
    }

    const product = await Product.create({
      name: name.trim(),
      price: parsedPrice,
      tags: parseTags(tags),
      description: description ? description.trim() : '',
      featured: featured === 'true' || featured === true,
      inStock: inStock !== 'false' && inStock !== false,
      image: imageData,
    });

    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (err) {
    console.error('POST /api/admin/products error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

// ─── GET /api/admin/products ──────────────────────────────────────────────────
/**
 * List all products for admin (no filtering, full details)
 */
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, sort = 'newest' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.newest;

    const [products, total] = await Promise.all([
      Product.find().sort(sortObj).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('GET /api/admin/products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// ─── PUT /api/admin/products/:id ──────────────────────────────────────────────
/**
 * Update a product (full or partial update)
 * Body (multipart/form-data) — all fields optional
 */
router.put('/products/:id', upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { name, price, tags, description, featured, inStock } = req.body;

    // Update fields if provided
    if (name !== undefined) product.name = name.trim();
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: 'Price must be a non-negative number' });
      }
      product.price = parsedPrice;
    }
    if (tags !== undefined) product.tags = parseTags(tags);
    if (description !== undefined) product.description = description.trim();
    if (featured !== undefined) product.featured = featured === 'true' || featured === true;
    if (inStock !== undefined) product.inStock = inStock !== 'false' && inStock !== false;

    // Handle image replacement
    if (req.file) {
      // Delete old image from Cloudinary
      if (product.image && product.image.publicId) {
        await deleteFromCloudinary(product.image.publicId);
      }
      product.image = await uploadToCloudinary(req.file.buffer);
    }

    await product.save();
    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (err) {
    console.error('PUT /api/admin/products/:id error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

// ─── PATCH /api/admin/products/:id/toggle-featured ───────────────────────────
router.patch('/products/:id/toggle-featured', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.featured = !product.featured;
    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle featured' });
  }
});

// ─── PATCH /api/admin/products/:id/toggle-stock ──────────────────────────────
router.patch('/products/:id/toggle-stock', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    product.inStock = !product.inStock;
    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to toggle stock status' });
  }
});

// ─── DELETE /api/admin/products/:id ──────────────────────────────────────────
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // Delete image from Cloudinary
    if (product.image && product.image.publicId) {
      await deleteFromCloudinary(product.image.publicId);
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/admin/products/:id error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, inStock, featured, tags] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ inStock: true }),
      Product.countDocuments({ featured: true }),
      Product.distinct('tags'),
    ]);

    // Price stats
    const priceAgg = await Product.aggregate([
      { $group: { _id: null, avg: { $avg: '$price' }, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: total,
        inStock,
        outOfStock: total - inStock,
        featured,
        totalTags: tags.length,
        priceStats: priceAgg[0] || { avg: 0, min: 0, max: 0 },
      },
    });
  } catch (err) {
    console.error('GET /api/admin/stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

module.exports = router;
