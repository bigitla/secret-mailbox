export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.MAILBOX;

  if (request.method === 'POST') {
  const { message } = await request.json();
  const id = Date.now().toString();
  const payload = {
    message,
    timestamp: new Date().toISOString()
  };
  await kv.put(id, JSON.stringify(payload));
  return new Response("Saved", { status: 200 });
}


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


  return new Response("Method not allowed", { status: 405 });
}

