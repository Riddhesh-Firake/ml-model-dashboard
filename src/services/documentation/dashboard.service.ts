import { ModelMetadata } from '../../models/model.model';

export interface DashboardModel {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: Date;
  requestCount: number;
  endpointUrl: string;
  testUrl: string;
  docsUrl: string;
}

export class DashboardService {
  /**
   * Generate HTML dashboard for all user models
   */
  generateDashboardHTML(models: DashboardModel[], userEmail?: string): string {
    const modelsHTML = models.map(model => `
      <div class="model-card">
        <div class="model-header">
          <h3>${model.name}</h3>
          <span class="status-badge status-${model.status}">${model.status}</span>
        </div>
        <p class="model-description">${model.description || 'No description provided'}</p>
        <div class="model-stats">
          <div class="stat">
            <span class="stat-label">Requests:</span>
            <span class="stat-value">${model.requestCount}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Created:</span>
            <span class="stat-value">${new Date(model.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="model-actions">
          <a href="${model.testUrl}" class="btn btn-primary">Test Model</a>
          <a href="${model.docsUrl}" class="btn btn-secondary">View Docs</a>
          <a href="${model.endpointUrl}" class="btn btn-outline" target="_blank">API Endpoint</a>
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ML Models Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }

        .header {
            background: white;
            border-bottom: 1px solid #dee2e6;
            padding: 20px 0;
            margin-bottom: 30px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        .header h1 {
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .header p {
            color: #666;
        }

        .user-info {
            float: right;
            color: #666;
            font-size: 14px;
        }

        .models-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .model-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .model-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .model-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .model-header h3 {
            color: #2c3e50;
            font-size: 18px;
        }

        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-active {
            background: #d4edda;
            color: #155724;
        }

        .status-inactive {
            background: #f8d7da;
            color: #721c24;
        }

        .status-archived {
            background: #e2e3e5;
            color: #383d41;
        }

        .model-description {
            color: #666;
            margin-bottom: 15px;
            font-size: 14px;
        }

        .model-stats {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            padding: 10px 0;
            border-top: 1px solid #f1f3f4;
            border-bottom: 1px solid #f1f3f4;
        }

        .stat {
            display: flex;
            flex-direction: column;
        }

        .stat-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 2px;
        }

        .stat-value {
            font-weight: 600;
            color: #2c3e50;
        }

        .model-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-block;
            text-align: center;
        }

        .btn-primary {
            background: #007bff;
            color: white;
        }

        .btn-primary:hover {
            background: #0056b3;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background: #545b62;
        }

        .btn-outline {
            background: transparent;
            color: #007bff;
            border: 1px solid #007bff;
        }

        .btn-outline:hover {
            background: #007bff;
            color: white;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .empty-state h2 {
            color: #666;
            margin-bottom: 10px;
        }

        .empty-state p {
            color: #999;
            margin-bottom: 20px;
        }

        .footer {
            text-align: center;
            padding: 40px 20px;
            color: #666;
            font-size: 14px;
        }

        .nav-links {
            background: white;
            padding: 15px 0;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .nav-links a {
            color: #007bff;
            text-decoration: none;
            margin: 0 15px;
            font-weight: 500;
        }

        .nav-links a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .models-grid {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 0 10px;
            }

            .user-info {
                float: none;
                margin-top: 10px;
            }

            .model-actions {
                flex-direction: column;
            }

            .btn {
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <div class="user-info">
                ${userEmail ? `Logged in as: ${userEmail}` : 'User Dashboard'}
            </div>
            <h1>ML Models Dashboard</h1>
            <p>Manage and test your machine learning models</p>
        </div>
    </div>

    <div class="container">
        <div class="nav-links">
            <a href="/docs/api-docs">API Documentation</a>
            <a href="/api/models">Models API</a>
            <a href="/api/auth/profile">Profile</a>
            <a href="/api/keys">API Keys</a>
        </div>

        ${models.length > 0 ? `
            <div class="models-grid">
                ${modelsHTML}
            </div>
        ` : `
            <div class="empty-state">
                <h2>No Models Yet</h2>
                <p>Upload your first machine learning model to get started.</p>
                <a href="/api/models/upload" class="btn btn-primary">Upload Model</a>
            </div>
        `}
    </div>

    <div class="footer">
        <div class="container">
            <p>ML Model Upload API Dashboard - Manage your models and test predictions</p>
        </div>
    </div>
</body>
</html>`;
  }
}