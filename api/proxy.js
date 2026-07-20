let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditCommentApp/1.0'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'Missing url param' });

  try {
    const token = await getAccessToken();
    const oauthUrl = target.replace('https://www.reddit.com', 'https://oauth.reddit.com');

    const r = await fetch(oauthUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'RedditCommentApp/1.0'
      }
    });

    const text = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
