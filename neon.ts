import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "123": { access: "public_read" },
    },
  },
});
