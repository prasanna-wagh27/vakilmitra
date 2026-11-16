import { env } from "./env.js";
import { createApp } from "./app.js";

createApp().listen(env.port, () => {
  console.log(`VakilMitra API listening on http://localhost:${env.port}`);
});
