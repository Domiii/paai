import path from "path";
import { PEON_ROOT_DIR } from "./paths";

const ASSET_DIR = path.resolve(PEON_ROOT_DIR, "assets");

export function getAssetPath(assetName: string): string {
  return path.join(ASSET_DIR, assetName);
}