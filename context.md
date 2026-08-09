# ShopEase — Project Context

## Overview
A full-stack retail store web application with:
- **Public frontend**: Product listing, tag-based search, product detail modal
- **Admin panel** (`/admin.html`): Add/edit/delete products, dashboard stats, toggle stock/featured
- **Backend**: Node.js + Express REST API connected to MongoDB Atlas + Cloudinary image uploads

---

## Project Structure

```
retail/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── package.json           # Dependencies (express, mongoose, cloudinary, multer v2, cors, dotenv, streamifier)
│   ├── .env                   # Environment variables (not committed to git)
│   ├── .gitignore
│   ├── models/
│   │   └── Product.js         # Mongoose product schema
│   ├── routes/
│   │   ├── products.js        # Public product routes
│   │   └── admin.js           # Admin CRUD routes
│   └── middleware/
│       └── upload.js          # Multer (memory storage) + Cloudinary upload helpers
│
└── frontend/
    ├── index.html             # Public product listing page
    ├── admin.html             # Admin panel page
    ├── style.css              # Global CSS (design system, dark mode, animations)
    ├── admin.css              # Admin-specific CSS (sidebar, stats, table, form)
    ├── app.js                 # Public frontend JS
    └── admin.js               # Admin panel JS
```

---

## Environment Variables (backend/.env)
```
PORT=5000
MONGODB_URI=mongodb+srv://prabhakartenn:peter0lily07@mk27.hbsc3.mongodb.net/mydb?...
CLOUDINARY_CLOUD_NAME=dvsukstvb
CLOUDINARY_API_KEY=488346396724369
CLOUDINARY_API_SECRET=ccuzehWLCBvJAivBj93Xtz0TcNk
NODE_ENV=production
```

---

## API Endpoints

### Public (`/api/products`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (query: search, tag, page, limit, sort, featured) |
| GET | `/api/products/tags` | All unique tags (for autocomplete) |
| GET | `/api/products/:id` | Single product |
| GET | `/api/health` | Health check |

### Admin (`/api/admin`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/products` | Create product (multipart/form-data) |
| GET | `/api/admin/products` | List all products |
| PUT | `/api/admin/products/:id` | Update product |
| DELETE | `/api/admin/products/:id` | Delete product (also deletes Cloudinary image) |
| PATCH | `/api/admin/products/:id/toggle-featured` | Toggle featured flag |
| PATCH | `/api/admin/products/:id/toggle-stock` | Toggle inStock flag |
| GET | `/api/admin/stats` | Dashboard statistics |

---

## Product Schema (MongoDB)
```js
{
  name: String (required, max 200),
  price: Number (required, min 0),
  tags: [String] (auto-lowercased, auto-trimmed),
  image: { url: String, publicId: String },  // Cloudinary
  description: String (max 1000),
  inStock: Boolean (default: true),
  featured: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```
Indexes: text index on `name+tags`, index on `tags`, index on `createdAt`.

---

## Frontend Config
Both `app.js` and `admin.js` have a constant at the top:
```js
const API_BASE = 'https://YOUR_BACKEND_URL/api';
```
**After deploying the backend, replace `YOUR_BACKEND_URL` with the actual deployed URL in both files.**

---

## Key Design Decisions

### Backend
- **Multer memory storage** + stream upload to Cloudinary (avoids disk writes, works on serverless)
- **Tags are always lowercased** and trimmed at the model level via a setter
- Admin routes have no auth (as per requirements) — access via `/admin.html`
- Flexible tag parsing: accepts comma-separated string, JSON array string, or plain array
- Old Cloudinary images are deleted when a product is updated with a new image or deleted entirely
- `multer@2` used instead of v1 (security fix)

### Frontend
- Pure HTML/CSS/JS (no framework) for maximum simplicity and deploy flexibility
- Dark mode design with CSS custom properties (design tokens)
- Debounced search (350ms) for performance
- Skeleton loading cards while products load
- Tag pill cloud shows top 10 tags; clicking filters products
- Grid/list view toggle
- Product detail modal on card click
- Admin sidebar with mobile drawer (hamburger)
- Tag input with keyboard support (Enter/comma to add, Backspace to remove last)
- Tag autocomplete from existing DB tags
- Image upload with drag-and-drop preview
- Toast notifications for all CRUD operations
- Character counter on description textarea

---

## Deployment Notes

### Backend Deployment (e.g., Render, Railway, Fly.io)
1. Deploy the `backend/` folder
2. Set environment variables from `.env` in the hosting provider
3. Start command: `node server.js`
4. Node version: >=18

### Frontend Deployment (e.g., Netlify, Vercel, GitHub Pages)
1. Deploy the `frontend/` folder as a static site
2. **Before deploying:** Update `API_BASE` in both `app.js` and `admin.js` with the backend URL
3. No build step required — pure static files

### CORS
The backend allows all origins (`*`). Restrict this to your frontend domain in production if needed (in `server.js`).

---

## Last Updated
2026-08-09 — Initial implementation by Antigravity AI
