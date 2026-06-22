import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/staff', '/api/'],
    },
    sitemap: 'https://macbellosalon.com/sitemap.xml',
  };
}
