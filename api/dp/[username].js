const sessionid_raw = "76299648550%3AIN3O9EYlytwqAl%3A20%3AAYh40IugF8VoMagK3vrJk0z7MGVNysLR9U9NeA0gHg";
const ds_user_id = "76299648550";
const cookie_header = `sessionid=${sessionid_raw}; ds_user_id=${ds_user_id}`;

function expandHDVariants(url) {
    if (!url) return [];
    const variants = [url];

    const v1 = url.replace(/s\d+x\d+/, 's1080x1080').replace(/p\d+x\d+/, 'p1080x1080');
    if (v1 !== url) variants.push(v1);

    const v2 = url.replace(/([?&])stp=[^&]*(&?)/, '$1').replace(/[?&]$/, '');
    if (v2 !== url) variants.push(v2);

    const v3 = url.replace(/150x150|320x320|640x640/g, '1080x1080');
    if (v3 !== url) variants.push(v3);

    return [...new Set(variants)];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const usernameParam = req.query.username || req.url.split('/api/dp/')[1] || req.url.split('/api/dp?username=')[1] || '';
    const username = String(usernameParam).split('?')[0].split('&')[0].trim().replace(/^@/, '');

    if (!username || !/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
        return res.status(400).json({ success: false, error: 'Invalid username' });
    }

    const results = [];
    const meta = {};

    // METHOD 1: Instagram TopSearch API
    try {
        const searchUrl = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}`;
        const sRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Cookie': cookie_header,
                'X-IG-App-ID': '936619743392459',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.instagram.com/'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.users && Array.isArray(sData.users)) {
                for (const item of sData.users) {
                    const u = item.user;
                    if (u && u.username && u.username.toLowerCase() === username.toLowerCase()) {
                        meta.resolvedUserId = u.pk || u.id;
                        meta.fullName = u.full_name;
                        meta.isPrivate = u.is_private;
                        meta.isVerified = u.is_verified;

                        if (u.hd_profile_pic_url_info?.url) {
                            for (const vUrl of expandHDVariants(u.hd_profile_pic_url_info.url)) {
                                results.push({ url: vUrl, priority: 100, label: 'TopSearch 1080p HD' });
                            }
                        }
                        if (u.profile_pic_url) {
                            for (const vUrl of expandHDVariants(u.profile_pic_url)) {
                                results.push({ url: vUrl, priority: 80, label: 'TopSearch Expanded HD' });
                            }
                        }
                        break;
                    }
                }
            }
        }
    } catch (e) {
        console.log('TopSearch error:', e.message);
    }

    // METHOD 2: Instagram Mobile API
    if (meta.resolvedUserId) {
        try {
            const mUrl = `https://i.instagram.com/api/v1/users/${meta.resolvedUserId}/info/`;
            const mRes = await fetch(mUrl, {
                headers: {
                    'User-Agent': 'Instagram 275.0.0.27.98 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; OnePlus3T; oneplus3; qcom; en_US; 454157778)',
                    'Cookie': cookie_header,
                    'X-IG-App-ID': '936619743392459'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (mRes.ok) {
                const mData = await mRes.json();
                const mu = mData.user;
                if (mu) {
                    if (mu.hd_profile_pic_url_info?.url) {
                        for (const vUrl of expandHDVariants(mu.hd_profile_pic_url_info.url)) {
                            results.push({ url: vUrl, priority: 110, label: 'Mobile API 1080p HD' });
                        }
                    }
                    if (mu.hd_profile_pic_versions) {
                        for (const ver of mu.hd_profile_pic_versions) {
                            if (ver.url) {
                                for (const vUrl of expandHDVariants(ver.url)) {
                                    results.push({ url: vUrl, priority: 95, label: 'Mobile Version HD' });
                                }
                            }
                        }
                    }
                    if (mu.follower_count) meta.followers = mu.follower_count;
                    if (mu.full_name && !meta.fullName) meta.fullName = mu.full_name;
                    if (mu.is_private !== undefined) meta.isPrivate = mu.is_private;
                }
            }
        } catch (e) {
            console.log('Mobile API error:', e.message);
        }
    }

    // METHOD 3: Web Profile Info API
    if (results.length === 0) {
        try {
            const wUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
            const wRes = await fetch(wUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Cookie': cookie_header,
                    'X-IG-App-ID': '936619743392459',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.instagram.com/'
                },
                signal: AbortSignal.timeout(10000)
            });

            if (wRes.ok) {
                const wData = await wRes.json();
                const wu = wData.data?.user;
                if (wu) {
                    if (wu.hd_profile_pic_url_info?.url) {
                        for (const vUrl of expandHDVariants(wu.hd_profile_pic_url_info.url)) {
                            results.push({ url: vUrl, priority: 90, label: 'Web API HD' });
                        }
                    }
                    if (wu.profile_pic_url_hd) {
                        for (const vUrl of expandHDVariants(wu.profile_pic_url_hd)) {
                            results.push({ url: vUrl, priority: 70, label: 'Web API 320 HD' });
                        }
                    }
                    if (wu.full_name) meta.fullName = wu.full_name;
                    if (wu.is_private !== undefined) meta.isPrivate = wu.is_private;
                    if (wu.edge_followed_by?.count) meta.followers = wu.edge_followed_by.count;
                }
            }
        } catch (e) {
            console.log('Web API error:', e.message);
        }
    }

    // METHOD 4: Googlebot Fallback
    if (results.length === 0) {
        try {
            const gbRes = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
                signal: AbortSignal.timeout(8000)
            });
            if (gbRes.ok) {
                const html = await gbRes.text();
                const m = html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/);
                if (m) {
                    const u = m[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
                    for (const vUrl of expandHDVariants(u)) {
                        results.push({ url: vUrl, priority: 40, label: 'Googlebot HD' });
                    }
                }
            }
        } catch (e) {}
    }

    results.sort((a, b) => b.priority - a.priority);

    let bestUrl = null;
    let bestSize = 0;
    const seen = new Set();

    for (const candidate of results) {
        if (!candidate.url || !candidate.url.startsWith('http') || seen.has(candidate.url)) continue;
        seen.add(candidate.url);

        try {
            const headRes = await fetch(candidate.url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' },
                signal: AbortSignal.timeout(5000)
            });

            if (headRes.ok) {
                const buf = await headRes.arrayBuffer();
                const len = buf.byteLength;
                if (len > bestSize) {
                    bestSize = len;
                    bestUrl = candidate.url;
                }
                if (len > 25000) break;
            }
        } catch (e) {}
    }

    if (!bestUrl) {
        return res.status(404).json({ success: false, error: `Could not retrieve profile picture for @${username}` });
    }

    return res.status(200).json({
        success: true,
        username,
        imageUrl: bestUrl,
        imageSize: bestSize,
        fullName: meta.fullName || null,
        isPrivate: meta.isPrivate || false,
        isVerified: meta.isVerified || false,
        followers: meta.followers || null,
        source: 'mobile_api_hd'
    });
};
