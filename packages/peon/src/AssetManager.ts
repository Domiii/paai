import path from "path";
import fs from "fs/promises"; // Add this line to import the 'fs' module
import { PEON_ROOT_DIR } from "./paths";

const ASSET_DIR = path.resolve(PEON_ROOT_DIR, "assets");

/**
 * Manages Peon's own assets.
 */
export class AssetManager {
  private assetDirs: string[] = [];

  addAssetDir(assetDir: string): void {
    this.assetDirs.push(assetDir);
  }

  async getAssetPath(assetName: string): Promise<string> {
    for (const assetDir of this.assetDirs) {
      const assetPath = path.join(assetDir, assetName);
      // check for existence of the asset using access:
      try {
        await fs.access(assetPath)
      } catch (err: any) {
        continue;
      }
      if (path.isAbsolute(assetPath)) {
        return assetPath;
      }
    }
    throw new Error(`Asset not found: ${assetName}`);
  }
}

export function getAssetPath(assetName: string): string {
  return path.join(ASSET_DIR, assetName);
}
