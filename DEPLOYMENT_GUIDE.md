# 🚀 Deployment Guide: ML Model Dashboard

This guide covers deploying your ML Model Dashboard to **Vercel** (frontend + serverless functions) and **Render** (full-stack application).

## 📋 Prerequisites

- Git repository with your code
- GitHub/GitLab account
- Vercel account (for Vercel deployment)
- Render account (for Render deployment)

## 🌐 Option 1: Deploy to Vercel

Vercel is perfect for frontend applications with serverless API functions.

### Step 1: Prepare for Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Environment Variables**:
   Create these environment variables in Vercel dashboard:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here
   API_KEY_SECRET=your-api-key-secret-here
   DATABASE_URL=your-database-connection-string
   PORT=3000
   ```

### Step 2: Deploy to Vercel

#### Method A: Using Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your Git repository
4. Vercel will auto-detect the configuration from `vercel.json`
5. Add environment variables in the "Environment Variables" section
6. Click "Deploy"

#### Method B: Using Vercel CLI

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add NODE_ENV
   vercel env add JWT_SECRET
   vercel env add API_KEY_SECRET
   vercel env add DATABASE_URL
   ```

### Step 3: Configure Database (if needed)

For Vercel, you'll need an external database:

- **Recommended**: [Neon](https://neon.tech) (PostgreSQL)
- **Alternative**: [PlanetScale](https://planetscale.com) (MySQL)
- **Alternative**: [Supabase](https://supabase.com) (PostgreSQL)

## 🖥️ Option 2: Deploy to Render

Render is great for full-stack applications with persistent storage.

### Step 1: Prepare for Render

1. **Push to Git**: Ensure your code is in a Git repository
2. **Database**: Render will create a PostgreSQL database automatically

### Step 2: Deploy to Render

#### Method A: Using Render Dashboard (Recommended)

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Blueprint"
3. Connect your Git repository
4. Render will detect the `render.yaml` configuration
5. Review the services (web service + database)
6. Click "Apply"

#### Method B: Manual Setup

1. **Create Web Service**:
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your repository
   - Configure:
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Environment**: `Node`

2. **Create Database**:
   - Click "New +" → "PostgreSQL"
   - Choose a name: `ml-dashboard-db`
   - Select free tier

3. **Environment Variables**:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here
   API_KEY_SECRET=your-api-key-secret-here
   DATABASE_URL=[Auto-filled by Render]
   PORT=10000
   ```

### Step 3: Database Setup

Render will automatically provide the `DATABASE_URL`. The app will create tables on first run.

## 🐳 Option 3: Deploy with Docker

You can also deploy using the provided Dockerfile to any container platform.

### Build and Run Locally

```bash
# Build the image
docker build -t ml-dashboard .

# Run the container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret \
  -e API_KEY_SECRET=your-api-secret \
  -e DATABASE_URL=your-db-url \
  ml-dashboard
```

### Deploy to Container Platforms

- **Railway**: Connect Git repo, auto-deploys from Dockerfile
- **Fly.io**: Use `flyctl deploy`
- **Google Cloud Run**: Deploy container image
- **AWS ECS**: Deploy to Elastic Container Service

## 🔧 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Server port | No | `3000` (Vercel), `10000` (Render) |
| `JWT_SECRET` | JWT signing secret | Yes | `your-super-secret-key-min-32-chars` |
| `API_KEY_SECRET` | API key encryption secret | Yes | `another-secret-key-for-api-keys` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |

## 🎯 Platform Comparison

| Feature | Vercel | Render | Docker |
|---------|--------|--------|--------|
| **Best For** | Frontend + API | Full-stack apps | Any platform |
| **Database** | External required | Included | External |
| **Scaling** | Serverless | Container-based | Manual |
| **Free Tier** | Generous | Good | Varies |
| **Setup** | Easiest | Easy | Most flexible |

## 🚀 Quick Start Commands

### For Vercel:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### For Render:
```bash
# Just push to Git and connect in Render dashboard
git add .
git commit -m "Deploy to Render"
git push origin main
```

### For Docker:
```bash
# Build and run
docker build -t ml-dashboard .
docker run -p 3000:3000 ml-dashboard
```

## 🔍 Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check Node.js version (use Node 18+)
   - Verify all dependencies in package.json
   - Check TypeScript compilation errors

2. **Database Connection**:
   - Verify DATABASE_URL format
   - Check database permissions
   - Ensure database exists

3. **Environment Variables**:
   - All required variables are set
   - No spaces in variable names
   - Secrets are properly encoded

4. **Static Files**:
   - Ensure `public/` folder is included
   - Check file paths are correct
   - Verify CSS/JS files load

### Getting Help:

- **Vercel**: [Vercel Documentation](https://vercel.com/docs)
- **Render**: [Render Documentation](https://render.com/docs)
- **Docker**: [Docker Documentation](https://docs.docker.com)

## 🎉 Post-Deployment

After successful deployment:

1. **Test the application**: Visit your deployed URL
2. **Check analytics**: Verify the dashboard loads correctly
3. **Test API endpoints**: Use the built-in API documentation
4. **Monitor logs**: Check platform logs for any issues
5. **Set up monitoring**: Configure uptime monitoring

Your ML Model Dashboard is now live! 🚀