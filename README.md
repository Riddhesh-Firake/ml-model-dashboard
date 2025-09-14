# ML Model Upload API

A TypeScript-based API service that allows users to upload machine learning models and automatically generates REST endpoints for model inference.

## Project Structure

```
src/
├── api/                    # API layer
│   ├── middleware/         # Express middleware
│   └── routes/            # API route definitions
├── config/                # Configuration files
│   ├── app.config.ts      # Application configuration
│   ├── database.config.ts # Database configuration
│   ├── storage.config.ts  # File storage configuration
│   └── index.ts          # Configuration exports
├── models/                # TypeScript interfaces and types
│   ├── user.model.ts      # User-related types
│   ├── model.model.ts     # ML model metadata types
│   ├── upload.model.ts    # File upload types
│   ├── prediction.model.ts # Prediction request/response types
│   ├── error.model.ts     # Error handling types
│   └── index.ts          # Model exports
├── services/              # Business logic services
│   ├── contracts/         # Service interface definitions
│   ├── upload/           # File upload service
│   ├── model-management/ # Model metadata management
│   ├── inference/        # Model inference service
│   └── user-management/  # User authentication service
└── index.ts              # Main application exports
```

## Supported Model Formats

- **Scikit-learn**: `.pkl`, `.joblib`
- **TensorFlow/Keras**: `.h5`
- **PyTorch**: `.pt`, `.pth`
- **ONNX**: `.onnx`

## Environment Configuration

Copy `.env.example` to `.env` and configure the following:

- **Application**: Port, host, JWT settings
- **Database**: PostgreSQL connection details
- **Storage**: File storage provider and settings
- **Rate Limiting**: API rate limit configuration

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Architecture

The application follows a layered architecture with:

- **API Layer**: Express routes and middleware
- **Service Layer**: Business logic and data processing
- **Model Layer**: TypeScript interfaces and data types
- **Configuration Layer**: Environment-specific settings

Each service implements a contract interface to ensure consistency and enable easy testing and mocking.