export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.MAILBOX;

  if (request.method === 'POST') {
    const { message } = await request.json();
    const id = Date.now().toString();
    await kv.put(id, message);
    return new Response("Saved", { status: 200 });
  }

  if (request.method === 'GET') {
    const list = await kv.list();
    const messages = await Promise.all(
      list.keys.map(async key => await kv.get(key.name))
    );
    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

