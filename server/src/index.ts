import { connectToDatabase } from "./config/db";
import { env } from "./config/env";
import { app } from "./app";
import { FormModel } from "./models/Form";

async function bootstrap(): Promise<void> {
  await connectToDatabase();

  if (String(process.env.CLEAN_RECOMMENDATION_FIELDS ?? "").trim().toLowerCase() === "true") {
    const filter = {
      $or: [
        { "content.__recommendation": { $exists: true } },
        { "content.__recommendationError": { $exists: true } },
        { "content.__recommendationJob": { $exists: true } }
      ]
    };
    const update = {
      $unset: {
        "content.__recommendation": "",
        "content.__recommendationError": "",
        "content.__recommendationJob": ""
      }
    };
    const res = await FormModel.updateMany(filter as any, update as any).exec();
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "cleanup_recommendation_fields",
          matched: (res as any).matchedCount ?? (res as any).n ?? null,
          modified: (res as any).modifiedCount ?? (res as any).nModified ?? null
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
