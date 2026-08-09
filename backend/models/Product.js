const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) =>
        tags
          .map((t) => t.toLowerCase().trim())
          .filter((t) => t.length > 0),
    },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for full-text search on name and tags
productSchema.index({ name: 'text', tags: 'text' });
// Index for tag filtering
productSchema.index({ tags: 1 });
// Index for sorting by creation date
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
