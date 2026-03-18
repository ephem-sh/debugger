/**
 * Simple release script.
 *
 * Usage:
 *   bun release node          # bump node package
 *   bun release go             # bump go package
 *   bun release python         # bump python package
 *   bun release rust           # bump rust package
 *   bun release all            # bump all with changes
 *   bun release node --dry     # show what would happen
 *   bun release node patch     # force patch bump (default)
 *   bun release node minor     # force minor bump
 *   bun release node major     # force major bump
 */

type PackageName = "node" | "go" | "python" | "rust";
type BumpType = "major" | "minor" | "patch";

interface PackageConfig {
  dir: string;
  versionFile: string | null;
  displayName: string;
  commitPrefix: string;
}

const PACKAGES: Record<PackageName, PackageConfig> = {
  node: {
    dir: "packages/debugger",
    versionFile: "packages/debugger/package.json",
    displayName: "@ephem-sh/debugger",
    commitPrefix: "release(node)",
  },
  go: {
    dir: "packages/debugger-go",
    versionFile: null,
    displayName: "ephem-debugger-go",
    commitPrefix: "release(go)",
  },
  python: {
    dir: "packages/debugger-py",
    versionFile: "packages/debugger-py/pyproject.toml",
    displayName: "ephem-debugger-py",
    commitPrefix: "release(python)",
  },
  rust: {
    dir: "packages/debugger-rs",
    versionFile: "packages/debugger-rs/Cargo.toml",
    displayName: "ephem-debugger-rs",
    commitPrefix: "release(rust)",
  },
};

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim();
}

function parseVersion(v: string): [number, number, number] {
  const [a, b, c] = v.split(".").map(Number);
  return [a ?? 0, b ?? 0, c ?? 0];
}

function bumpVersion(current: string, bump: BumpType): string {
  const [major, minor, patch] = parseVersion(current);
  switch (bump) {
    case "major": return `${major + 1}.0.0`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "patch": return `${major}.${minor}.${patch + 1}`;
  }
}

async function readVersion(pkg: PackageConfig): Promise<string> {
  if (!pkg.versionFile) return "0.1.0";
  const content = await Bun.file(pkg.versionFile).text();
  const ext = pkg.versionFile.split(".").pop();
  if (ext === "json") {
    return (JSON.parse(content) as { version?: string }).version ?? "0.1.0";
  }
  if (ext === "toml") {
    const match = content.match(/^version\s*=\s*"([^"]+)"/m);
    return match?.[1] ?? "0.1.0";
  }
  return "0.1.0";
}

async function writeVersion(pkg: PackageConfig, version: string): Promise<void> {
  if (!pkg.versionFile) return;
  const content = await Bun.file(pkg.versionFile).text();
  const ext = pkg.versionFile.split(".").pop();
  if (ext === "json") {
    const json = JSON.parse(content) as Record<string, unknown>;
    json.version = version;
    await Bun.write(pkg.versionFile, JSON.stringify(json, null, 2) + "\n");
  } else if (ext === "toml") {
    await Bun.write(
      pkg.versionFile,
      content.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${version}"`)
    );
  }
}

async function getCommitsSince(dir: string): Promise<string[]> {
  // Get commits that touched this package since the last release commit for it
  const lastRelease = await run([
    "git", "log", "--all", "--pretty=format:%H %s", "--", `${dir}/`,
  ]);
  const lines = lastRelease.split("\n").filter(Boolean);

  const commits: string[] = [];
  for (const line of lines) {
    const msg = line.slice(line.indexOf(" ") + 1);
    if (msg.startsWith("release(")) break; // stop at last release
    commits.push(msg);
  }
  return commits;
}

async function appendChangelog(
  pkgName: string,
  displayName: string,
  version: string,
  commits: string[]
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  let entry = `### ${displayName} v${version} (${date})\n`;
  for (const c of commits) {
    entry += `- ${c}\n`;
  }
  entry += "\n";

  const file = Bun.file("CHANGELOG.md");
  const existing = (await file.exists()) ? await file.text() : "";

  if (existing.startsWith("# Changelog")) {
    const rest = existing.slice(existing.indexOf("\n") + 1);
    await Bun.write("CHANGELOG.md", `# Changelog\n\n${entry}${rest}`);
  } else {
    await Bun.write("CHANGELOG.md", `# Changelog\n\n${entry}`);
  }
}

async function confirm(prompt: string): Promise<boolean> {
  process.stdout.write(prompt);
  for await (const line of console) {
    return line.trim().toLowerCase() === "y";
  }
  return false;
}

async function releaseOne(name: PackageName, bump: BumpType, dry: boolean): Promise<boolean> {
  const pkg = PACKAGES[name];
  const currentVersion = await readVersion(pkg);
  const nextVersion = bumpVersion(currentVersion, bump);
  const commits = await getCommitsSince(pkg.dir);
  const commitMsg = `${pkg.commitPrefix}: v${nextVersion}`;

  console.log(`\n${pkg.displayName}  ${currentVersion} → ${nextVersion} (${bump})`);
  if (commits.length > 0) {
    console.log(`  ${commits.length} commit(s):`);
    for (const c of commits.slice(0, 5)) console.log(`    - ${c}`);
    if (commits.length > 5) console.log(`    ... and ${commits.length - 5} more`);
  }
  console.log(`  Commit: ${commitMsg}`);

  if (dry) return false;

  const yes = await confirm("\n  Release? (y/n) ");
  if (!yes) {
    console.log("  Skipped");
    return false;
  }

  await writeVersion(pkg, nextVersion);
  await appendChangelog(name, pkg.displayName, nextVersion, commits);

  const filesToAdd = ["CHANGELOG.md"];
  if (pkg.versionFile) filesToAdd.push(pkg.versionFile);

  await run(["git", "add", ...filesToAdd]);
  await run(["git", "commit", "-m", commitMsg]);

  console.log(`  Done.`);
  return true;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const filtered = args.filter((a) => !a.startsWith("-"));
  const pkgName = filtered[0] as PackageName | "all" | undefined;
  const bumpArg = (filtered[1] as BumpType) || "patch";

  if (!pkgName || (pkgName !== "all" && !PACKAGES[pkgName])) {
    console.error("Usage: bun release <node|go|python|rust|all> [patch|minor|major] [--dry]");
    process.exit(1);
  }

  const status = await run(["git", "status", "--porcelain"]);
  if (status) {
    console.warn("Warning: uncommitted changes\n");
  }

  if (pkgName === "all") {
    const names = Object.keys(PACKAGES) as PackageName[];
    let released = false;
    for (const name of names) {
      const did = await releaseOne(name, bumpArg, dry);
      if (did) released = true;
    }
    if (released) console.log(`\nPush when ready: git push`);
  } else {
    const did = await releaseOne(pkgName, bumpArg, dry);
    if (did) console.log(`\nPush when ready: git push`);
  }
}

main();
