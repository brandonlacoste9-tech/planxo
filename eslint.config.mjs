import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

const eslintConfig = defineConfig([
  ...next,
]);

export default eslintConfig;
