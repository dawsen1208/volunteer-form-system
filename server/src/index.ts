import { connectToDatabase } from "./config/db";
import { env } from "./config/env";
import { app } from "./app";

async function bootstrap(): Promise<void> {
  await connectToDatabase();

  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

