import { DurableObject } from 'cloudflare:workers';

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject<Env> {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async fetch(request: Request): Promise<Response> {
		var newUrl = new URL(request.url);
		if (newUrl.pathname === '/no-op') {
			// This is a no-op endpoint that does nothing, but can be used to test
			// the Durable Object's fetch handler without WebSocket connections.
			return new Response('No-op endpoint', { status: 200 });
		}

		// Creates two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		// Upon receiving a message from the client, the server replies with the same message, the session ID of the connection,
		// and the total number of connections with the "[Durable Object]: " prefix
		//await new Promise(resolve => setTimeout(resolve, 5_000));
		var perfBefore = performance.now();
		await Promise.all([await fetch('https://httpbin.org/delay/5')]); // slow website example, this just simulates a delay of 5s
		var perfAfter = performance.now();
		var perfDiff = perfAfter - perfBefore;
		ws.send(`[Durable Object] message: ${message} (perf: ${perfDiff}ms)`);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		// If the client closes the connection, the runtime will invoke the webSocketClose() handler.
		ws.close(code, 'Durable Object is closing WebSocket');
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		var newUrl = new URL(request.url);
		if (newUrl.pathname === '/') {
			return new Response(
				`<!DOCTYPE html>
<html>
<head><title>WS Test</title></head>
<body>
<button onclick="send()" id="btn">Connect</button>
<script>
let ws;
function send() {
  if (!ws || ws.readyState > 1) {
    ws = new WebSocket(\`ws://\${location.host}/websocket\`);
    ws.onopen = () => btn.innerText = "Send";
    ws.onmessage = e => console.log(e.data);
    ws.onclose = () => btn.innerText = 'Connect';
  } else if (ws.readyState === 1) {
    ws.send(Math.random().toString(36));
  }
}
</script>
</body>
</html>`,
				{ headers: { 'Content-type': 'text/html' } }
			);
		} else if (newUrl.pathname === '/websocket') {
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('Worker expected Upgrade: websocket', {
					status: 426,
				});
			}

			if (request.method !== 'GET') {
				return new Response('Worker expected GET method', {
					status: 400,
				});
			}

			// Since we are hard coding the Durable Object ID by providing the constant name 'foo',
			// all requests to this Worker will be sent to the same Durable Object instance.
			let id = env.MY_DURABLE_OBJECT.idFromName('foo');
			let stub = env.MY_DURABLE_OBJECT.get(id);

			return stub.fetch(request);
		} else if (newUrl.pathname === '/no-op') {
			let id = env.MY_DURABLE_OBJECT.idFromName('foo');
			let stub = env.MY_DURABLE_OBJECT.get(id);

			return stub.fetch(request);
		}
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
