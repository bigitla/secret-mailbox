export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.MAILBOX;
  const rateKV = env.RATE_LIMIT;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (request.method === 'POST') {
    const rateKey = `rate:${ip}`;
    const count = await rateKV.get(rateKey);

    if (count && parseInt(count) > 100) {
      return new Response("Too many requests. Please slow down.", { status: 429 });
    }

    await rateKV.put(rateKey, (parseInt(count || "0") + 1).toString(), {
      expirationTtl: 60
    });

    const { id, message, timestamp } = await request.json();
    const payload = JSON.stringify({ id, message, timestamp });

    await kv.put(id, payload);

    // Update index list
    const indexRaw = await kv.get("messages:index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.push(id);
    await kv.put("messages:index", JSON.stringify(index));

    return new Response(JSON.stringify({ status: "Saved", id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'GET') {
    const indexRaw = await kv.get("messages:index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];

    const messages = await Promise.all(
      index.map(async id => {
        const raw = await kv.get(id);
        try {
          return JSON.parse(raw);
        } catch {
          return { id, message: raw };
        }
      })
    );

    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (token !== env.ADMIN_TOKEN) {
      return new Response("Unauthorized", { status: 403 });
    }

    const indexRaw = await kv.get("messages:index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];

    await Promise.all(index.map(id => kv.delete(id)));
    await kv.delete("messages:index");

    return new Response("Mailbox cleared", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
}
