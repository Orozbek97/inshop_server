function normalizeInstagramUrl(instagramUrl) {
  if (!instagramUrl) return null;
  
  let url = instagramUrl.trim().toLowerCase();
  
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/^www\./, '');
  url = url.replace(/^instagram\.com\//, '');
  url = url.replace(/^instagram\.com/, '');
  url = url.replace(/^@/, '');
  url = url.replace(/\/$/, '');
  url = url.replace(/\?.*$/, '');
  
  return url || null;
}

function extractInstagramUsername(instagramUrl) {
  const normalized = normalizeInstagramUrl(instagramUrl);
  if (!normalized) return null;
  
  const parts = normalized.split('/');
  return parts[0] || null;
}

module.exports = {
  normalizeInstagramUrl,
  extractInstagramUsername
};

