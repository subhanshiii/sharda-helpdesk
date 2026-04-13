export const loadImageDimensions = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
  image.onerror = reject;
  image.src = src;
});

export const createCroppedImageFile = async ({
  src,
  fileName = 'avatar.jpg',
  width,
  height,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  cropSize = 280,
  outputSize = 512,
  mimeType = 'image/jpeg',
}) => {
  const { image } = await loadImageDimensions(src);
  const coverScale = Math.max(cropSize / width, cropSize / height);
  const finalScale = coverScale * zoom;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare image crop');
  }

  const scaleFactor = outputSize / cropSize;
  const drawWidth = width * finalScale * scaleFactor;
  const drawHeight = height * finalScale * scaleFactor;
  const drawX = (outputSize - drawWidth) / 2 + offsetX * scaleFactor;
  const drawY = (outputSize - drawHeight) / 2 + offsetY * scaleFactor;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob);
      else reject(new Error('Failed to export cropped image'));
    }, mimeType, 0.92);
  });

  const normalizedName = fileName.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${normalizedName}.jpg`, { type: mimeType });
};
