async function getAccessToken() {
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
  return data.access_token;
}

function countSentences(text) {
  return text.replace(/([.!?])\s+/g, '$1|').split('|').filter(s => s.trim().length > 10).length;
}

export default async function handler(req, res) {
  try {
    const sub = req.query.sub || 'AskReddit';
    const token = await getAccessToken();
    const sorts = ['top', 'hot', 'new', 'controversial'];
    const sort = sorts[Math.floor(Math.random() * sorts.length)];

    const listRes = await fetch(`https://oauth.reddit.com/r/${sub}/${sort}.json?limit=50&raw_json=1`, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'RedditCommentApp/1.0' }
    });
    const listData = await listRes.json();
    const posts = listData.data.children.sort(() => Math.random() - 0.5);

    let found = null;
    for (const post of posts.slice(0, 15)) {
      const cRes = await fetch(`https://oauth.reddit.com${post.data.permalink}.json?limit=100&raw_json=1`, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'RedditCommentApp/1.0' }
      });
      const cData = await cRes.json();
      const comments = (cData[1]?.data?.children || [])
        .filter(c => c.kind === 't1' && c.data?.body && c.data.body !== '[deleted]' &&
          c.data.body !== '[removed]' && countSentences(c.data.body) >= 4);
      if (comments.length > 0) {
        const picked = comments[Math.floor(Math.random() * comments.length)];
        found = {
          body: picked.data.body,
          author: picked.data.author,
          score: picked.data.score,
          url: `https://www.reddit.com${post.data.permalink}`,
          title: post.data.title,
          sub
        };
        break;
      }
    }

    if (!found) return res.status(200).json({ sent: false, reason: 'no comment found' });

    const msg = `🎲 r/${found.sub}\n\n"${found.body}"\n\n— u/${found.author} (↑${found.score})\n\n${found.url}`;

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: 'whatsapp:+14155238886',
        To: `whatsapp:+${process.env.WHATSAPP_PHONE}`,
        Body: msg
      })
    });

    const twilioData = await twilioRes.json();
    res.status(200).json({ sent: true, twilioStatus: twilioData.status, comment: found.body.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
