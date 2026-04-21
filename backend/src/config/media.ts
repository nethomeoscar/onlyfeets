// config/media.ts
export const generateBlurUrl = async (imageUrl: string): Promise<string | null> => {
  // In production: use sharp to generate blurred thumbnail, store in S3
  // return `${process.env.CDN_URL}/blurred/${hash}.jpg`
  return imageUrl ? `${imageUrl}?blur=30&w=20` : null;
};

export const generateThumbnail = async (videoUrl: string): Promise<string | null> => {
  // In production: use FFmpeg Lambda or MediaConvert to extract thumbnail
  return null;
};
