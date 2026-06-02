import { describe, expect, test } from "bun:test";
import { parseDQAnalysis } from "../../src/talend/dq-analysis";

describe("DQ analysis parser", () => {
  test("lee campos principales del XML real", () => {
    const analysis = parseDQAnalysis(
      "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/TDQ_Data Profiling/Analyses/Basic_Column_Analysis_olist_geolocation_0.1.ana",
    );

    expect(analysis).not.toBeNull();
    expect(analysis?.name).toBe("Basic_Column_Analysis_olist_geolocation");
    expect(analysis?.status).toBe("Draft");
    expect(analysis?.author).toContain("jose.bonillao");
    expect(analysis?.defaultContext).toBe("Default");
    expect(analysis?.connectionName).toBe("geolocation_0.1");
    expect(analysis?.lastRunOk).toBe(true);
    expect(analysis?.indicators[0]?.type).toBe("RowCountIndicator");
    expect(analysis?.indicators[0]?.count).toBe(1000163);
  });

  test("mapea RangeIndicator como Range", () => {
    const analysis = parseDQAnalysis(
      "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/TDQ_Data Profiling/Analyses/Basic_Column_Analysis_sellers_0.1.ana",
    );

    expect(analysis).not.toBeNull();
    expect(analysis?.indicators.some((ind) => ind.type === "RangeIndicator" && ind.name === "Range")).toBe(true);
  });
});
