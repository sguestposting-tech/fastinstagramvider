const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const sessionid_raw = "76299648550%3AIN3O9EYlytwqAl%3A20%3AAYh40IugF8VoMagK3vrJk0z7MGVNysLR9U9NeA0gHg";
const ds_user_id = "76299648550";
const cookie_header = `sessionid=${sessionid_raw}; ds_user_id=${ds_user_id}`;

function cleanUrl(url) {
    if (!url) return url;
    return url.replace(/\\u0026/g, '&').replace(/\\/g, '');
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

    let hdUrl = null;
    let userData = {};

    // -------------------------------------------------------------
    // METHOD 1: Real Headless Chrome via @sparticuz/chromium on Vercel
    // -------------------------------------------------------------
    try {
        const executablePath = await chromium.executablePath();
        const browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');

        await page.setCookie(
            { name: 'sessionid', value: sessionid_raw, domain: '.instagram.com', path: '/' },
            { name: 'ds_user_id', value: ds_user_id, domain: '.instagram.com', path: '/' }
        );

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/v1/users/web_profile_info/') || url.includes('/graphql/query/')) {
                try {
                    const json = await response.json();
                    const u = json.data?.user || json.user;
                    if (u) {
                        userData = u;
                        if (u.hd_profile_pic_url_info?.url) {
                            hdUrl = cleanUrl(u.hd_profile_pic_url_info.url);
                        } else if (u.profile_pic_url_hd) {
                            hdUrl = cleanUrl(u.profile_pic_url_hd);
                        }
                    }
                } catch (e) {}
            }
        });

        await page.goto(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        await new Promise(r => setTimeout(r, 2500));

        if (!hdUrl) {
            hdUrl = await page.evaluate(() => {
                try {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const s of scripts) {
                        const txt = s.textContent || '';
                        if (txt.includes('hd_profile_pic_url_info')) {
                            const m = txt.match(/"hd_profile_pic_url_info"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/);
                            if (m) return m[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
                        }
                    }
                } catch (e) {}
                return null;
            });
        }

        await browser.close();
    } catch (e) {
        console.log('Chromium Vercel attempt failed, falling back to HTTP:', e.message);
    }

    // -------------------------------------------------------------
    // METHOD 2: HTTP Fallback if Chromium is starting cold
    // -------------------------------------------------------------
    if (!hdUrl) {
        try {
            const searchUrl = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}`;
            const sRes = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Cookie': cookie_header,
                    'X-IG-App-ID': '936619743392459',
                    'Referer': 'https://www.instagram.com/'
                }
            });
            if (sRes.ok) {
                const sData = await sRes.json();
                if (sData.users && Array.isArray(sData.users)) {
                    for (const item of sData.users) {
                        const u = item.user;
                        if (u && u.username && u.username.toLowerCase() === username.toLowerCase()) {
                            if (u.hd_profile_pic_url_info?.url) {
                                hdUrl = cleanUrl(u.hd_profile_pic_url_info.url);
                            } else if (u.profile_pic_url) {
                                hdUrl = cleanUrl(u.profile_pic_url);
                            }
                            userData = u;
                            break;
                        }
                    }
                }
            }
        } catch (e) {}
    }

    if (!hdUrl) {
        return res.status(404).json({ success: false, error: `Could not retrieve 1080p HD profile picture for @${username}` });
    }

    return res.status(200).json({
        success: true,
        username,
        imageUrl: hdUrl,
        fullName: userData.full_name || userData.fullName || null,
        isPrivate: userData.is_private || false,
        isVerified: userData.is_verified || false,
        source: 'vercel_chrome_1080p'
    });
};
