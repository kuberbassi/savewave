const fs = require('fs');
const path = require('path');

describe('Production SEO & Discovery Configuration', () => {
  it('has landing-page metadata and software schema', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf-8');
    expect(html).toContain('<title>Savewave — Media Downloader</title>');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="author" content="Kuber Bassi"');
    expect(html).toContain('property="og:image" content="https://savewave.kuberbassi.com/Savewave-embed.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:image" content="https://savewave.kuberbassi.com/Savewave-embed.png"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type": "SoftwareApplication"');
    expect(html).toContain('Kuber Bassi');
    expect(html).toContain('landing.js');
    expect(html).toContain('href="/favicon-dark.png"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).not.toContain('savewave-light.png');
    expect(html).not.toContain('core.js');
    const landing = fs.readFileSync(path.join(__dirname, '../../public/landing.jsx'), 'utf-8');
    expect(landing).toContain('href="https://kuberbassi.com"');
  });

  it('has production sitemap.xml with canonical domain', () => {
    const sitemap = fs.readFileSync(path.join(__dirname, '../../public/sitemap.xml'), 'utf-8');
    expect(sitemap).toContain('https://savewave.kuberbassi.com/');
    expect(sitemap).not.toContain('localhost');
    expect(sitemap).not.toContain('/history');
  });

  it('has production robots.txt with API disallow and sitemap', () => {
    const robots = fs.readFileSync(path.join(__dirname, '../../public/robots.txt'), 'utf-8');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Sitemap: https://savewave.kuberbassi.com/sitemap.xml');
  });

  it('has llms discovery files', () => {
    expect(fs.readFileSync(path.join(__dirname, '../../public/llms.txt'), 'utf-8')).toContain('Kuber Bassi');
    expect(fs.readFileSync(path.join(__dirname, '../../public/llms-full.txt'), 'utf-8')).toContain('Savewave');
  });

  it('does not advertise the website as an installable app', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf-8');
    expect(html).not.toContain('rel="manifest"');
    expect(fs.existsSync(path.join(__dirname, '../../public/manifest.json'))).toBe(false);
  });

  it('has a valid centralized client release manifest with HTTPS links', () => {
    const release = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/client-version.json'), 'utf-8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
    const tauri = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src-tauri/tauri.conf.json'), 'utf-8'));
    expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(release.version).toBe(pkg.version);
    expect(release.version).toBe(tauri.version);
    for (const key of ['downloadUrl', 'androidDownloadUrl', 'releaseUrl', 'changelogUrl']) expect(new URL(release[key]).protocol).toBe('https:');
    expect(release.androidDownloadUrl).toContain(`/download/v${release.version}/Savewave-android-arm64.apk`);
  });

  it('has a custom 404 page', () => {
    expect(fs.readFileSync(path.join(__dirname, '../../public/404.html'), 'utf-8')).toContain('RESOURCE UNRESOLVED');
  });
});
