import { $ } from "bun";

type PackageName = "node" | "go" | "python" | "rust";

interface PackageConfig {
  dir: string;
  versionFile: string | null;
  tagPrefix: string;
  changelog: string;
  displayName: string;
}

const PACKAGES: Record<PackageName, PackageConfig> = {
  node: {
    dir: "packages/debugger",
    versionFile: "packages/debugger/package.json",
    tagPrefix: "debugger",
    changelog: "packages/debugger/CHANGELOG.md",
    displayName: "@ephem-sh/debugger",
  },
  go: {
    dir: "packages/debugger-go",
    versionFile: null,
    tagPrefix: "debugger-go",
    changelog: "packages/debugger-go/CHANGELOG.md",
    displayName: "debugger-go",
  },
  python: {
    dir: "packages/debugger-py",
    versionFile: "packages/debugger-py/pyproject.toml",
    tagPrefix: "debugger-py",
    changelog: "packages/debugger-py/CHANGELOG.md",
    displayName: "ephem-debugger",
  },
  rust: {
    dir: "packages/debugger-rs",
    versionFile: "packages/debugger-rs/Cargo.toml",
    tagPrefix: "debugger-rs",
    changelog: "packages/debugger-rs/CHANGELOG.md",
    displayName: "ephem-debugger",
  },
};

type BumpType = "major" | "minor" | "patch";

interface ParsedCommit {
  hash: string;
  shortHash: string;
  type: string;
  message: string;
}

const CHANGELOG_TYPES: Record<string, string> = {
  feat: "Added",
  fix: "Fixed",
  refactor: "Changed",
  perf: "Changed",
};

const BUMP_TYPES: Record<string, BumpType> = {
  feat: "minor",
  fix: "patch",
  refactor: "patch",
  perf: "patch",
  docs: "patch",
  chore: "patch",
  test: "patch",
};

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim();
}

function parseVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map(Number);
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

function bumpVersion(current: string, bump: BumpType): string {
  const [major, minor, patch] = parseVersion(current);
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function getLastTag(tagPrefix: string): Promise<string | null> {
  const tags = await run([
    "git",
    "tag",
    "--list",
    `${tagPrefix}@*`,
    "--sort=-v:refname",
  ]);
  if (!tags) return null;
  return tags.split("\n")[0] ?? null;
}

async function getCommitsSince(
  lastTag: string | null,
  dir: string
): Promise<ParsedCommit[]> {
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const args = [
    "git",
    "log",
    range,
    "--pretty=format:%H %s",
    "--",
    `${dir}/`,
  ];
  const output = await run(args);
  if (!output) return [];

  return output.split("\n").flatMap((line) => {
    const spaceIdx = line.indexOf(" ");
    if (spaceIdx === -1) return [];
    const hash = line.slice(0, spaceIdx);
    const subject = line.slice(spaceIdx + 1);
    const colonIdx = subject.indexOf(":");
    if (colonIdx === -1) return [];
    const type = subject.slice(0, colonIdx).trim().toLowerCase();
    const message = subject.slice(colonIdx + 1).trim();
    return [{ hash, shortHash: hash.slice(0, 7), type, message }];
  });
}

async function readCurrentVersion(
  pkg: PackageConfig,
  lastTag: string | null
): Promise<string> {
  if (!pkg.versionFile) {
    if (lastTag) {
      const v = lastTag.split("@")[1];
      return v ?? "0.0.0";
    }
    return "0.0.0";
  }

  const content = await Bun.file(pkg.versionFile).text();
  const ext = pkg.versionFile.split(".").pop();

  if (ext === "json") {
    const json = JSON.parse(content) as { version?: string };
    return json.version ?? "0.0.0";
  }

  if (ext === "toml") {
    const match = content.match(/^version\s*=\s*"([^"]+)"/m);
    return match?.[1] ?? "0.0.0";
  }

  return "0.0.0";
}

function determineBump(commits: ParsedCommit[]): BumpType {
  let bump: BumpType = "patch";
  for (const c of commits) {
    if (c.type === "breaking") return "major";
    if (c.type === "feat" && bump !== "major") bump = "minor";
  }
  return bump;
}

function generateChangelog(
  version: string,
  commits: ParsedCommit[]
): string {
  const date = new Date().toISOString().slice(0, 10);
  const sections: Record<string, string[]> = {};

  for (const c of commits) {
    const category = CHANGELOG_TYPES[c.type];
    if (!category) continue;
    if (!sections[category]) sections[category] = [];
    sections[category].push(`- ${c.message} (${c.shortHash})`);
  }

  let entry = `## ${version} (${date})\n`;
  for (const [heading, items] of Object.entries(sections)) {
    entry += `\n### ${heading}\n`;
    for (const item of items) {
      entry += `${item}\n`;
    }
  }

  return entry;
}

async function updateVersionFile(
  pkg: PackageConfig,
  newVersion: string
): Promise<void> {
  if (!pkg.versionFile) return;

  const content = await Bun.file(pkg.versionFile).text();
  const ext = pkg.versionFile.split(".").pop();
  let updated: string;

  if (ext === "json") {
    const json = JSON.parse(content) as Record<string, unknown>;
    json.version = newVersion;
    updated = JSON.stringify(json, null, 2) + "\n";
  } else if (ext === "toml") {
    updated = content.replace(
      /^(version\s*=\s*)"[^"]+"/m,
      `$1"${newVersion}"`
    );
  } else {
    return;
  }

  await Bun.write(pkg.versionFile, updated);
}

async function prependChangelog(
  changelogPath: string,
  entry: string
): Promise<void> {
  const file = Bun.file(changelogPath);
  const existing = (await file.exists()) ? await file.text() : "";

  if (existing.startsWith("# Changelog")) {
    const rest = existing.slice(existing.indexOf("\n") + 1);
    await Bun.write(changelogPath, `# Changelog\n\n${entry}\n${rest}`);
  } else if (existing) {
    await Bun.write(changelogPath, `${entry}\n${existing}`);
  } else {
    await Bun.write(changelogPath, `# Changelog\n\n${entry}\n`);
  }
}

async function confirm(prompt: string): Promise<boolean> {
  process.stdout.write(prompt);
  for await (const line of console) {
    return line.trim().toLowerCase() === "y";
  }
  return false;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pkgName = args.find((a) => !a.startsWith("-")) as
    | PackageName
    | undefined;
  const dry = args.includes("--dry");

  if (!pkgName || (!PACKAGES[pkgName as PackageName] && pkgName !== "all")) {
    console.error(
      "Usage: bun run release <node|go|python|rust|all> [--dry]"
    );
    process.exit(1);
  }

  const status = await run(["git", "status", "--porcelain"]);
  if (status) {
    console.warn("Warning: working tree has uncommitted changes\n");
  }

  if (pkgName === "all") {
    await releaseAll(dry);
  } else {
    await releaseOne(pkgName as PackageName, dry);
  }
}

async function releaseAll(dry: boolean): Promise<void> {
  const pending: { name: PackageName; pkg: PackageConfig; commits: ParsedCommit[]; currentVersion: string; bump: BumpType; nextVersion: string }[] = [];

  for (const [name, pkg] of Object.entries(PACKAGES) as [PackageName, PackageConfig][]) {
    const lastTag = await getLastTag(pkg.tagPrefix);
    const commits = await getCommitsSince(lastTag, pkg.dir);
    if (commits.length === 0) continue;
    const currentVersion = await readCurrentVersion(pkg, lastTag);
    const bump = determineBump(commits);
    const nextVersion = bumpVersion(currentVersion, bump);
    pending.push({ name, pkg, commits, currentVersion, bump, nextVersion });
  }

  if (pending.length === 0) {
    console.log("No packages have changes to release");
    return;
  }

  console.log(`${pending.length} package(s) ready to release:\n`);
  for (const p of pending) {
    console.log(`  ${p.pkg.displayName}  ${p.currentVersion} → ${p.nextVersion} (${p.bump})`);
  }
  console.log();

  if (dry) {
    for (const p of pending) {
      const changelogEntry = generateChangelog(p.nextVersion, p.commits);
      console.log(`--- ${p.name} ---`);
      console.log(changelogEntry);
    }
    return;
  }

  const yes = await confirm("Release all? (y/n) ");
  if (!yes) {
    console.log("Aborted");
    process.exit(0);
  }

  for (const p of pending) {
    console.log(`\nReleasing ${p.pkg.displayName} ${p.nextVersion}...`);
    const changelogEntry = generateChangelog(p.nextVersion, p.commits);
    const tagName = `${p.pkg.tagPrefix}@${p.nextVersion}`;
    const commitMsg = `release(${p.name}): v${p.nextVersion}`;

    await updateVersionFile(p.pkg, p.nextVersion);
    await prependChangelog(p.pkg.changelog, changelogEntry);

    const filesToAdd = [p.pkg.changelog];
    if (p.pkg.versionFile) filesToAdd.push(p.pkg.versionFile);

    await run(["git", "add", ...filesToAdd]);
    await run(["git", "commit", "-m", commitMsg]);
    await run(["git", "tag", tagName]);
  }

  console.log(`\nDone. Push when ready: git push --follow-tags`);
}

async function releaseOne(pkgName: PackageName, dry: boolean): Promise<void> {
  const pkg = PACKAGES[pkgName];
  const lastTag = await getLastTag(pkg.tagPrefix);
  const commits = await getCommitsSince(lastTag, pkg.dir);

  if (commits.length === 0) {
    console.log("No changes to release");
    process.exit(0);
  }

  const currentVersion = await readCurrentVersion(pkg, lastTag);
  const bump = determineBump(commits);
  const nextVersion = bumpVersion(currentVersion, bump);
  const changelogEntry = generateChangelog(nextVersion, commits);
  const tagName = `${pkg.tagPrefix}@${nextVersion}`;
  const commitMsg = `release(${pkgName}): v${nextVersion}`;

  console.log(
    `${pkg.displayName}  ${currentVersion} → ${nextVersion} (${bump})\n`
  );
  console.log(changelogEntry);
  console.log(`Commit: ${commitMsg}`);
  console.log(`Tag:    ${tagName}`);

  if (dry) return;

  const yes = await confirm("\nRelease? (y/n) ");
  if (!yes) {
    console.log("Aborted");
    process.exit(0);
  }

  await updateVersionFile(pkg, nextVersion);
  await prependChangelog(pkg.changelog, changelogEntry);

  const filesToAdd = [pkg.changelog];
  if (pkg.versionFile) filesToAdd.push(pkg.versionFile);

  await run(["git", "add", ...filesToAdd]);
  await run(["git", "commit", "-m", commitMsg]);
  await run(["git", "tag", tagName]);

  console.log(`\nDone. Push when ready: git push --follow-tags`);
}

main();
