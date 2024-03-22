self.addEventListener("message", (event) => {
    const { action, data } = event.data;
    if (action === "connect") {
        const ws = new WebSocket(data.url);
        ws.onopen = () => {
            self.postMessage({ event: "open" });
        };
        ws.onmessage = (message) => {
            self.postMessage({ event: "message", data: message.data });
        };
        ws.onclose = () => {
            self.postMessage({ event: "close" });
        };
        ws.onerror = (error) => {
            self.postMessage({ event: "error", error: error.message });
        };
        self.ws = ws;
    } else if (action === "send") {
        self.ws.send(data);
    } else if (action === "disconnect") {
        self.ws.close();
    }
});
