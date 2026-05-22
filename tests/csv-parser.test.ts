// tests/csv-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseBackstageCsv } from "../src/lib/csv-parser/parser";

describe("CSV Parser - parseBackstageCsv", () => {
  it("should successfully parse a valid CSV with correct headers and types", () => {
    const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days,followers,matches,tier_status,graduation_status,last_month_metrics,growth_metrics,multi_guest_metrics
101,Frank LIVE,manager1@newstar.com,Vietnam LIVE,120000,22.5,9,2300,15,Tier 1,active,"{""tier"":0}","{}","{}"
102,Jack Streamer,manager2@newstar.com,Thailand Rising,300000,28.0,11,4500,28,Tier 2,active,"{}","{}","{}"`;

    const result = parseBackstageCsv(csvContent);
    
    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.totalRows).toBe(2);

    const first = result.records[0];
    expect(first.creator_id).toBe("101");
    expect(first.username).toBe("Frank LIVE");
    expect(first.manager_email).toBe("manager1@newstar.com");
    expect(first.group).toBe("Vietnam LIVE");
    expect(first.diamonds).toBe(120000);
    expect(first.live_hours).toBe(22.5);
    expect(first.valid_days).toBe(9);
    expect(first.followers).toBe(2300);
    expect(first.matches).toBe(15);
    expect(first.tier_status).toBe("Tier 1");
    expect(first.graduation_status).toBe("active");
    expect(first.last_month_metrics).toEqual({ tier: 0 });
  });

  it("should flag validation errors for missing required columns", () => {
    // Missing 'manager_email' and 'diamonds' for the second row
    const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days
101,Frank LIVE,manager1@newstar.com,Vietnam LIVE,120000,22.5,9
102,Jack Streamer,,Thailand Rising,,28.0,11`;

    const result = parseBackstageCsv(csvContent);
    expect(result.records).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // Line 3
    expect(result.errors[0].message).toContain("Missing required fields: manager_email, diamonds");
  });

  it("should flag validation errors for invalid numbers", () => {
    // Invalid live_hours format
    const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days
101,Frank LIVE,manager1@newstar.com,Vietnam LIVE,120k,22.5,9
102,Jack Streamer,manager1@newstar.com,Vietnam LIVE,150000,abc,11`;

    const result = parseBackstageCsv(csvContent);
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain("Invalid 'diamonds' value");
    expect(result.errors[1].message).toContain("Invalid 'live_hours' value");
  });

  it("should flag validation errors for malformed manager email", () => {
    const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days
101,Frank LIVE,invalid-email,Vietnam LIVE,120000,22.5,9`;

    const result = parseBackstageCsv(csvContent);
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Invalid 'manager_email' format");
  });

  it("should collect warnings for malformed optional fields and fallback to defaults", () => {
    const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days,followers,matches
101,Frank LIVE,manager1@newstar.com,Vietnam LIVE,120000,22.5,9,not-a-number,20`;

    const result = parseBackstageCsv(csvContent);
    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("followers");
    expect(result.records[0].followers).toBe(0); // Fallback
  });
});
