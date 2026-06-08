import nextConfig from "eslint-config-next";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
