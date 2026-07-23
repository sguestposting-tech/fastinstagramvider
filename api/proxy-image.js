function toHDUrl(url) {
    if (!url) return url;
    return url
        .replace(/s150x150/g, 's1080x1080')
        .replace(/s320x320/g, 's1080x1080')
        .replace(/s640x640/g, 's1080x1080')
        .replace(/p150x150/g, 'p1080x1080')
        .replace(/p320x320/g, 'p1080x1080')
        .replace(/\/s\d+x\d+\//g, '/s1080x1080/')
        .replace(/\/p\d+x\d+\//g, '/s1080x1080/')
        .replace(/\/c\d+\.\d+\.\d+\.\d+a\//g, '/');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const rawUrl = req.query.url;

    if (!rawUrl || !rawUrl.startsWith('http')) {
        return res.status(400).send('Invalid URL');
    }

    const hdUrl = toHDUrl(rawUrl);

    try {
        // First try fetching 1080x1080 HD version
        let r = await fetch(hdUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://www.instagram.com/' },
            signal: AbortSignal.timeout(10000)
        });

        // Fallback to original if HD transformation failed
        if (!r.ok) {
            r = await fetch(rawUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://www.instagram.com/' },
                signal: AbortSignal.timeout(10000)
            });
        }

        if (!r.ok) return res.status(r.status).send('Failed to fetch image');

        const ct = r.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await r.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (e) {
        return res.status(500).send('Proxy Error');
    }
};
