#!/bin/bash

# ML Model Dashboard Deployment Script
# Usage: ./scripts/deploy.sh [vercel|render|docker]

set -e

PLATFORM=${1:-"vercel"}
PROJECT_NAME="ml-model-dashboard"

echo "🚀 Deploying ML Model Dashboard to $PLATFORM..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

case $PLATFORM in
    "vercel")
        echo "🌐 Deploying to Vercel..."
        
        # Check if Vercel CLI is installed
        if ! command -v vercel &> /dev/null; then
            echo "📥 Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        # Deploy to Vercel
        vercel --prod
        
        echo "✅ Deployed to Vercel successfully!"
        echo "🔗 Your app should be available at the URL shown above."
        ;;
        
    "render")
        echo "🖥️ Preparing for Render deployment..."
        
        # Check if git is initialized and has remote
        if ! git remote get-url origin &> /dev/null; then
            echo "❌ Error: No git remote found. Please push your code to GitHub/GitLab first."
            echo "💡 Run: git remote add origin <your-repo-url>"
            exit 1
        fi
        
        # Push to git
        echo "📤 Pushing to git repository..."
        git add .
        git commit -m "Deploy to Render - $(date)" || echo "No changes to commit"
        git push origin main || git push origin master
        
        echo "✅ Code pushed to repository!"
        echo "🔗 Now go to render.com and create a new Blueprint with your repository."
        echo "📋 Render will automatically detect the render.yaml configuration."
        ;;
        
    "docker")
        echo "🐳 Building Docker image..."
        
        # Build Docker image
        docker build -t $PROJECT_NAME .
        
        echo "✅ Docker image built successfully!"
        echo "🚀 To run locally: docker run -p 3000:3000 $PROJECT_NAME"
        echo "📤 To deploy to a container platform, push the image to a registry:"
        echo "   docker tag $PROJECT_NAME your-registry/$PROJECT_NAME"
        echo "   docker push your-registry/$PROJECT_NAME"
        ;;
        
    *)
        echo "❌ Unknown platform: $PLATFORM"
        echo "💡 Usage: ./scripts/deploy.sh [vercel|render|docker]"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process completed!"
echo "📚 For more details, check DEPLOYMENT_GUIDE.md"