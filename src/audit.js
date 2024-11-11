const fs = require("fs");
const path = require("path");
const semver = require("semver");
const npmCheck = require("npm-check");
const depcheck = require("depcheck");

const AUDIT_REPORT_PATH = path.join(__dirname, "audit-report.json");

async function generateAuditReport(projectPath) {
  const packageJsonPath = path.join(projectPath, "package.json");
  const nodeModulesPath = path.join(projectPath, "node_modules");

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    console.error("package.json not found");
    return;
  }

  const packageJson = require(packageJsonPath);
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  // Initialize report data
  let report = {
    unusedDependencies: [],
    outdatedDependencies: [],
    legacyPeerDepsIssues: [],
    suggestions: [],
  };

  // Check for unused and outdated dependencies
  try {
    // Unused dependencies check
    const unusedDeps = await depcheck(projectPath, {});
    report.unusedDependencies = unusedDeps.dependencies;

    // Outdated dependencies check
    const outdatedDeps = await npmCheck({ cwd: projectPath, ignoreDev: false });
    report.outdatedDependencies = outdatedDeps
      .get("packages")
      .filter((pkg) => pkg.latest !== pkg.installed)
      .map((pkg) => ({
        name: pkg.moduleName,
        current: pkg.installed,
        latest: pkg.latest,
      }));

    // Check peer dependency conflicts
    const peerDepsIssues = [];
    for (const dep in dependencies) {
      const packagePath = path.join(nodeModulesPath, dep, "package.json");
      if (fs.existsSync(packagePath)) {
        const depPackageJson = require(packagePath);
        if (depPackageJson.peerDependencies) {
          Object.keys(depPackageJson.peerDependencies).forEach((peerDep) => {
            const requiredVersion = depPackageJson.peerDependencies[peerDep];
            if (
              dependencies[peerDep] &&
              !semver.satisfies(dependencies[peerDep], requiredVersion)
            ) {
              peerDepsIssues.push({
                package: dep,
                peerDependency: peerDep,
                requiredVersion,
                installedVersion: dependencies[peerDep],
              });
            }
          });
        }
      }
    }
    report.legacyPeerDepsIssues = peerDepsIssues;

    // Suggest solutions for --legacy-peer-deps
    if (peerDepsIssues.length > 0) {
      report.suggestions.push({
        message:
          "Some peer dependencies do not satisfy version requirements. Consider one of the following:",
        solutions: [
          "1. Downgrade or upgrade dependencies to meet peer dependency requirements.",
          "2. Use `--legacy-peer-deps` cautiously if compatibility is certain.",
          "3. Consult official package documentation for compatible versions.",
        ],
      });
    }

    // Write report to file
    fs.writeFileSync(AUDIT_REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Audit report generated at ${AUDIT_REPORT_PATH}`);
  } catch (error) {
    console.error("Error generating audit report:", error);
  }
}

module.exports = { generateAuditReport };
