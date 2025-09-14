import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Simple auth middleware function
const authMiddleware = (req: Request, res: Response, next: any) => {
  // For now, assume user is authenticated
  (req as any).user = { id: 'user-123' };
  next();
};

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.pkl', '.joblib', '.h5', '.onnx', '.pt', '.pth'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: .pkl, .joblib, .h5, .onnx, .pt, .pth'));
        }
    }
});

// Simple in-memory storage for demo
let models: any[] = [];

/**
 * POST /api/models/upload
 * Upload a new model
 */
router.post('/upload', upload.single('modelFile'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No model file provided' });
            return;
        }
        
        const { modelName, description } = req.body;
        
        if (!modelName) {
            res.status(400).json({ error: 'Model name is required' });
            return;
        }
        
        const modelId = uuidv4();
        const model = {
            id: modelId,
            name: modelName.trim(),
            description: description?.trim() || '',
            status: 'active',
            format: path.extname(req.file.originalname).toLowerCase().substring(1),
            createdAt: new Date().toISOString(),
            lastUsed: null,
            fileSize: req.file.size,
            filePath: req.file.path,
            originalName: req.file.originalname,
            userId: (req as any).user.id,
            requestCount: 0,
            avgResponseTime: 0,
            successRate: 100
        };
        
        models.push(model);
        
        res.status(201).json({
            message: 'Model uploaded successfully',
            modelId: model.id,
            endpointUrl: `${req.protocol}://${req.get('host')}/api/predict/${model.id}`,
            model: {
                id: model.id,
                name: model.name,
                description: model.description,
                status: model.status,
                format: model.format,
                createdAt: model.createdAt,
                endpoint: `/api/predict/${model.id}`,
                fileSize: model.fileSize
            }
        });
    } catch (error) {
        console.error('Error uploading model:', error);
        res.status(500).json({ error: 'Failed to upload model' });
    }
});

/**
 * GET /api/models
 * List all models for the authenticated user
 */
router.get('/', (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        
        const userModels = models.filter(m => m.userId === userId).map(model => ({
            id: model.id,
            name: model.name,
            description: model.description,
            status: model.status,
            format: model.format,
            createdAt: model.createdAt,
            lastUsed: model.lastUsed,
            fileSize: model.fileSize,
            endpoint: `/api/predict/${model.id}`,
            requestCount: model.requestCount || 0,
            avgResponseTime: model.avgResponseTime || 0,
            successRate: model.successRate || 100
        }));
        
        res.json(userModels);
    } catch (error) {
        console.error('Error listing models:', error);
        res.status(500).json({ error: 'Failed to list models' });
    }
});

/**
 * GET /api/models/:id
 * Get details for a specific model
 */
router.get('/:id', (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        const model = models.find(m => m.id === id && m.userId === userId);
        
        if (!model) {
            res.status(404).json({
                error: {
                    code: 'MODEL_NOT_FOUND',
                    message: `Model with ID ${id} not found`,
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }

        res.json({
            id: model.id,
            name: model.name,
            description: model.description,
            status: model.status,
            format: model.format,
            createdAt: model.createdAt,
            lastUsed: model.lastUsed,
            fileSize: model.fileSize,
            endpoint: `/api/predict/${model.id}`,
            requestCount: model.requestCount || 0,
            avgResponseTime: model.avgResponseTime || 0,
            successRate: model.successRate || 100
        });
    } catch (error) {
        console.error('Error getting model:', error);
        res.status(500).json({ error: 'Failed to get model details' });
    }
});

/**
 * PUT /api/models/:id
 * Update model details
 */
router.put('/:id', (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const { name, description } = req.body;

        const modelIndex = models.findIndex(m => m.id === id && m.userId === userId);
        
        if (modelIndex === -1) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        
        const model = models[modelIndex];
        
        if (name) model.name = name.trim();
        if (description !== undefined) model.description = description.trim();
        
        res.json({
            message: 'Model updated successfully',
            model: {
                id: model.id,
                name: model.name,
                description: model.description,
                status: model.status,
                format: model.format,
                createdAt: model.createdAt,
                lastUsed: model.lastUsed,
                fileSize: model.fileSize
            }
        });
    } catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ error: 'Failed to update model' });
    }
});

/**
 * DELETE /api/models/:id
 * Delete a model
 */
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        const modelIndex = models.findIndex(m => m.id === id && m.userId === userId);
        
        if (modelIndex === -1) {
            res.status(404).json({ error: 'Model not found' });
            return;
        }
        
        const model = models[modelIndex];
        
        // Delete the file
        if (fs.existsSync(model.filePath)) {
            fs.unlinkSync(model.filePath);
        }
        
        // Remove from array
        models.splice(modelIndex, 1);
        
        res.json({ message: 'Model deleted successfully' });
    } catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ error: 'Failed to delete model' });
    }
});

export default router;
export { router as modelsRouter };