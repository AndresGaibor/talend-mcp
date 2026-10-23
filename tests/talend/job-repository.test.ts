import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TalendJobRepository } from "../../src/modules/jobs/adapters/talend-job.repository";

const projectPath = mkdtempSync(join(tmpdir(), "talend-job-repository-"));
const repository = new TalendJobRepository();
const originalProjectPath = process.env.TALEND_PROJECT;

function writeJob(name: string, version = "0.1"): void {
  const processPath = join(projectPath, "process", "folder");
  mkdirSync(processPath, { recursive: true });
  writeFileSync(join(processPath, `${name}_${version}.properties`), `<?xml version="1.0"?>
<xmi:XMI>
  <TalendProperties:Property label="${name}" version="${version}" description="${name} description"/>
  <TalendProperties:ItemState path="folder"/>
  <TalendProperties:ProcessItem><process href="${name}_${version}.item#/"/></TalendProperties:ProcessItem>
</xmi:XMI>`, "utf8");
  writeFileSync(join(processPath, `${name}_${version}.item`), `<?xml version="1.0"?>
<talendfile:ProcessType defaultContext="Default" jobType="Standard">
  <context name="Default"/>
  <node componentName="tLogRow"><elementParameter name="UNIQUE_NAME" value="tLogRow_1"/></node>
</talendfile:ProcessType>`, "utf8");
}

beforeAll(() => {
  process.env.TALEND_PROJECT = projectPath;
  writeJob("FirstJob");
  writeJob("TargetJob");
});

afterAll(() => {
  if (originalProjectPath === undefined) delete process.env.TALEND_PROJECT;
  else process.env.TALEND_PROJECT = originalProjectPath;
  rmSync(projectPath, { recursive: true, force: true });
});

describe("repositorio de jobs: lecturas concurrentes y busquedas focalizadas", () => {
  test("lista jobs y conserva sus rutas y orden", async () => {
    const jobs = await repository.list({ path: projectPath });

    expect(jobs.map((job) => job.name)).toEqual(["FirstJob", "TargetJob"]);
    expect(jobs.every((job) => job.components.length === 1)).toBe(true);
  });

  test("busca un job por nombre, ruta e id", async () => {
    const byName = await repository.findByName("TargetJob", "folder");
    expect(byName?.name).toBe("TargetJob");

    const byPath = await repository.findByPath(byName!.path);
    expect(byPath?.name).toBe("TargetJob");

    const byId = await repository.findById(byName!.id);
    expect(byId?.name).toBe("TargetJob");
  });
});
