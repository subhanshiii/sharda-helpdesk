import API from '../utils/api';

export const DEFAULT_AVATAR_FILENAME = 'default.png';

let avatarCatalogCache = null;
let fallbackAvatarFilename = DEFAULT_AVATAR_FILENAME;

export const getDefaultAvatarFilename = () => fallbackAvatarFilename || DEFAULT_AVATAR_FILENAME;

export const getAvatarUrl = (filename = getDefaultAvatarFilename()) => filename ? `/avatars/${encodeURIComponent(filename)}` : '';

export const fetchAvatarOptions = async ({ force = false } = {}) => {
  if (!force && avatarCatalogCache) {
    return avatarCatalogCache;
  }

  const response = await API.get('/auth/avatar-options');
  avatarCatalogCache = Array.isArray(response.data?.data?.avatars) ? response.data.data.avatars : [];
  fallbackAvatarFilename = response.data?.data?.fallback || avatarCatalogCache[0] || DEFAULT_AVATAR_FILENAME;
  return avatarCatalogCache;
};

export const primeAvatarOptions = (avatars = []) => {
  avatarCatalogCache = Array.isArray(avatars) ? avatars : [];
  fallbackAvatarFilename = avatarCatalogCache[0] || DEFAULT_AVATAR_FILENAME;
};
