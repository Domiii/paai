import { Workspace } from ".";
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import os from "os";
import { pathJoin } from "@paai/shared/util/pathUtil";

// jest.mock("glob");
// describe("Workspace.enumerateFiles", () => {
//   let workspace: Workspace;
//   let tempDir: string;
//   const workspaceName = "test-workspace";

//   beforeAll(async () => {
//     // Create a temporary directory for our tests
//     tempDir = await fs.mkdtemp(pathJoin(os.tmpdir(), "workspace-test-"));
//     const workspacePath = pathJoin(tempDir, workspaceName);
//     await fs.mkdir(workspacePath);

//     // Create test files and directories
//     await fs.writeFile(pathJoin(workspacePath, "file1.txt"), "content");
//     await fs.mkdir(pathJoin(workspacePath, "dir"));
//     await fs.writeFile(pathJoin(workspacePath, "dir", "file2.txt"), "content");
//     await fs.writeFile(pathJoin(workspacePath, "ignored.txt"), "content");
//   });

//   afterEach(async () => {
//     // Clean up the temporary directory
//     await fs.rm(tempDir, { recursive: true, force: true });
//     jest.clearAllMocks();
//   });

//   beforeEach(() => {
//     const workspacePath = pathJoin(tempDir, workspaceName);
//     workspace = new Workspace(workspacePath, "Test Workspace");
//     jest.clearAllMocks();
//   });

//   it("should return files matching the glob pattern", async () => {
//     const mockFiles = [
//       pathJoin(tempDir, workspaceName, "file1.txt"),
//       pathJoin(tempDir, workspaceName, "dir", "file2.txt"),
//     ];
//     (glob as jest.MockedFunction<typeof glob>).mockResolvedValue(mockFiles);

//     const result = await workspace.enumerateFiles("**/*.txt");

//     expect(result).toEqual(["file1.txt", pathJoin("dir", "file2.txt")]);
//     expect(glob).toHaveBeenCalledWith(
//       "**/*.txt",
//       expect.objectContaining({
//         cwd: workspace.absolutePath,
//       })
//     );
//   });

//   it("should ignore files based on .gitignore rules", async () => {
//     const mockFiles = [
//       pathJoin(tempDir, workspaceName, "file1.txt"),
//       pathJoin(tempDir, workspaceName, "ignored.txt"),
//     ];
//     (glob as jest.MockedFunction<typeof glob>).mockResolvedValue(mockFiles);

//     const mockIgnore = {
//       ignores: jest.fn().mockImplementation((file) => file === "ignored.txt"),
//     };
//     jest
//       .spyOn(workspace as any, "getGitignoreRules")
//       .mockResolvedValue(mockIgnore);

//     const result = await workspace.enumerateFiles("*.txt");

//     expect(result).toEqual(["file1.txt"]);
//     expect(mockIgnore.ignores).toHaveBeenCalledWith("file1.txt");
//     expect(mockIgnore.ignores).toHaveBeenCalledWith("ignored.txt");
//   });

//   it("should handle empty result from glob", async () => {
//     (glob as jest.MockedFunction<typeof glob>).mockResolvedValue([]);

//     const mockIgnore = {
//       ignores: jest.fn(),
//     };
//     jest
//       .spyOn(workspace as any, "getGitignoreRules")
//       .mockResolvedValue(mockIgnore);

//     const result = await workspace.enumerateFiles("*.nonexistent");

//     expect(result).toEqual([]);
//     expect(mockIgnore.ignores).not.toHaveBeenCalled();
//   });

//   // it("should throw an error if glob fails", async () => {
//   //   const mockError = new Error("Glob error");
//   //   (glob as jest.MockedFunction<typeof glob>).mockRejectedValue(mockError);

//   //   await expect(workspace.enumerateFiles("**/*.txt")).rejects.toThrow(
//   //     "Glob error"
//   //   );
//   // });
// });

describe("Workspace src folder", () => {
  let workspace: Workspace;
  const peonPath = path.resolve(__dirname, "..");

  beforeAll(() => {
    // Set up the workspace as specified
    workspace = new Workspace(peonPath, "Peon Workspace");
    jest.clearAllMocks();
  });

  it("should have src/index.ts file in the workspace", async () => {
    const files = await workspace.enumerateFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toIncludeAllMembers(["src/index.ts"]);
    expect(files).toContain("src/index.ts");
  });
});
