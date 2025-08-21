This is a repro of the issue of concurrent connections max (6) leaking across Websocket Events and even seperate Websocket Clients.

You can repro it by doing the following:
Deploy this worker to CF/prod runtime (local dev does not enforce these limits)
Bring up two tabs with your worker. Open up Dev Tools, hit Connect and start looking at the WS Msgs for both
Send a ton of requests from one of the windows. Each request sends a request to a really slow endpoint which takes ~5s to complete.
Send a request from the other client. Observe how it takes silly long to complete, because it appears to be sharing the connection queue with the other client.
Success.
