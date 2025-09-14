export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name?: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CreateApiKeyRequest {
  userId: string;
  name?: string;
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  name?: string;
  key: string; // Only returned on creation
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
}

export interface ApiKeyListItem {
  id: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  // Note: key hash is never exposed in responses
}

export interface UpdateApiKeyRequest {
  name?: string;
  isActive?: boolean;
  expiresAt?: Date;
}