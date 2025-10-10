export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.MAILBOX;
  const rateKV = env.RATE_LIMIT;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // 📨 Save encrypted message with timestamp (Rate Limited)
  if (request.method === 'POST') {
    const rateKey = `rate:${ip}`;
    const count = await rateKV.get(rateKey);

    if (count && parseInt(count) > 10) {
      return new Response("Too many requests. Please slow down.", { status: 429 });
    }

    await rateKV.put(rateKey, (parseInt(count || "0") + 1).toString(), {
      expirationTtl: 60 // resets every 60 seconds
    });

    const { message, timestamp } = await request.json();
    const id = Date.now().toString();
    const payload = JSON.stringify({ message, timestamp });
    await kv.put(id, payload);
    return new Response("Saved", { status: 200 });
  }

  // 📬 Retrieve all messages
  if (request.method === 'GET') {
    const list = await kv.list();
    const messages = await Promise.all(
      list.keys.map(async key => {
        const raw = await kv.get(key.name);
        try {
          return JSON.parse(raw);
        } catch {
          return { message: raw };
        }
      })
    );
    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 🧹 Delete all messages manually (Token Protected)
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (token !== env.ADMIN_TOKEN) {
      return new Response("Unauthorized", { status: 403 });
    }

    const list = await kv.list();
    await Promise.all(list.keys.map(key => kv.delete(key.name)));
    return new Response("Mailbox cleared", { status: 200 });
  }

  // 🚫 Fallback for unsupported methods
  return new Response("Method not allowed", { status: 405 });
}


