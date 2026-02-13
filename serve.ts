Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    if (path === "/") path = "/index.html";

    const file = Bun.file("." + path);
    if (await file.exists()) {
      // Set correct content types for TS files served to browser
      if (path.endsWith(".ts")) {
        const built = await Bun.build({
          entrypoints: ["." + path],
          target: "browser",
          minify: false,
        });
        const output = built.outputs[0];
        if (output) {
          return new Response(await output.text(), {
            headers: { "Content-Type": "application/javascript" },
          });
        }
      }
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Ruler running at http://localhost:3000");
