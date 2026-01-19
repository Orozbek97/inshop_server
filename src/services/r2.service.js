const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET) {
  logger.warn('R2 environment variables are not fully configured. File uploads may fail.');
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;

async function uploadFile(buffer, filename, folder = '') {
  try {
    if (!buffer) {
      throw new Error('Buffer is required for file upload');
    }
    
    if (!BUCKET_NAME) {
      throw new Error('R2_BUCKET is not configured');
    }
    
    const key = folder ? `${folder}/${filename}` : filename;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: getContentType(filename),
    });

    await s3Client.send(command);
    
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    logger.info(`File uploaded to R2: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    logger.error('Error uploading file to R2', { 
      error: error.message, 
      code: error.code,
      name: error.name,
      bucket: BUCKET_NAME,
      filename 
    });
    throw error;
  }
}

async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    logger.info(`File deleted from R2: ${key}`);
  } catch (error) {
    logger.error('Error deleting file from R2', { error });
  }
}

function getKeyFromUrl(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch (error) {
    if (url.startsWith('/')) {
      return url.substring(1);
    }
    const parts = url.split(R2_PUBLIC_URL);
    return parts[1] ? parts[1].substring(1) : null;
  }
}

function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = {
  uploadFile,
  deleteFile,
  getKeyFromUrl,
};

