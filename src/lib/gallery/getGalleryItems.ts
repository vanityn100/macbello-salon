import galleryData from "@/data/gallery.json";

export interface GalleryItem {
  id: string;
  type: "video" | "image";
  title: string;
  category: string;
  thumbnail: string;
  video?: string;
  featured: boolean;
  sortOrder: number;
  description: string;
}

export function getGalleryItems(): GalleryItem[] {
  // Current implementation reads from gallery.json.
  // In the future, this can be swapped with direct fetch calls to Sanity, Contentful, Strapi, etc.
  const items = galleryData as GalleryItem[];
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}
