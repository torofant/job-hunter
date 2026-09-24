import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";

const environment = loadEnvironment();
const app = createApp(environment);

try {
  await app.listen({ port: environment.PORT, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
