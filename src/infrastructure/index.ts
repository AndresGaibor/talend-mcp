export { parseXml, buildXml, asArray } from "./xml/xml-utils";
export { readTextFile, writeTextFile, listFilesRecursive, isPathInside, normalizePath } from "./filesystem/file-reader";
export { cloneRepo, pullRepo, getRepoInfo, discoverTalendProject, getCachedRepos, parseSource, loadState, saveState, getCacheDir } from "./git/git-repo";
export { type RepoState, type CachedRepo, type RepoInfo, type DiscoveredProject, type PullResult } from "./git/git-repo";
export { JobXmlRepository } from "./repositories/job-xml.repository";
export { listProjectContexts } from "./repositories/context-xml.repository";
export { listDqAnalyses, updateDqAnalysis, duplicateDqAnalysis } from "./repositories/dq-xml.repository";