import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const nodeModulesPath = path.join(__dirname, "node_modules");
const isSymlink = fs.existsSync(nodeModulesPath) && fs.lstatSync(nodeModulesPath).isSymbolicLink();

const nextConfig: NextConfig = {
  ...(isSymlink && {
    turbopack: {
      root: path.join(__dirname, ".."),
    },
  }),
};

export default nextConfig;
