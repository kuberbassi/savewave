const fs = require('fs');
const path = require('path');

describe('Production SEO & Discovery Configuration', () => {
  it('should have valid index.html meta tags and JSON-LD schema', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf-8');
    expect(html).toContain('<title>Savewave — Universal Media Downloader</title>');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="author" content="Kuber Bassi"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('Kuber Bassi');
  });

  it('should have production sitemap.xml with canonical domain', () => {
    const sitemap = fs.readFileSync(path.join(__dirname, '../../public/sitemap.xml'), 'utf-8');
    expect(sitemap).toContain('https://savewave.kuberbassi.com/');
    expect(sitemap).not.toContain('localhost');
    expect(sitemap).not.toContain('/history');
  });

  it('should have production robots.txt with disallows and sitemap reference', () => {
    const robots = fs.readFileSync(path.join(__dirname, '../../public/robots.txt'), 'utf-8');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /history');
    expect(robots).toContain('Sitemap: https://savewave.kuberbassi.com/sitemap.xml');
  });

  it('should have llms.txt and llms-full.txt files', () => {
    const llms = fs.readFileSync(path.join(__dirname, '../../public/llms.txt'), 'utf-8');
    const llmsFull = fs.readFileSync(path.join(__dirname, '../../public/llms-full.txt'), 'utf-8');
    expect(llms).toContain('Kuber Bassi');
    expect(llmsFull).toContain('Savewave');
  });

  it('should have valid manifest.json file', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/manifest.json'), 'utf-8'));
    expect(manifest.name).toBe('Savewave');
    expect(manifest.short_name).toBe('Savewave');
  });

  it('should have custom brutalist 404 page', () => {
    const html404 = fs.readFileSync(path.join(__dirname, '../../public/404.html'), 'utf-8');
    expect(html404).toContain('404');
    expect(html404).toContain('RESOURCE UNRESOLVED');
  });
});
