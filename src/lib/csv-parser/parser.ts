// src/lib/csv-parser/parser.ts
import Papa from "papaparse";

export interface RawCsvRow {
  creator_id?: string;
  username?: string;
  manager_email?: string;
  group?: string;
  diamonds?: string | number;
  live_hours?: string | number;
  valid_days?: string | number;
  followers?: string | number;
  matches?: string | number;
  tier_status?: string;
  graduation_status?: string;
  last_month_metrics?: string;
  growth_metrics?: string;
  multi_guest_metrics?: string;
  [key: string]: any;
}

export interface ParsedRecord {
  creator_id: string;
  username: string;
  manager_email: string;
  group: string;
  diamonds: number;
  live_hours: number;
  valid_days: number;
  followers: number;
  matches: number;
  tier_status: string;
  graduation_status: string;
  last_month_metrics: Record<string, any>;
  growth_metrics: Record<string, any>;
  multi_guest_metrics: Record<string, any>;
}

export interface ValidationError {
  row: number;
  message: string;
  raw: any;
}

export interface ValidationWarning {
  row: number;
  message: string;
}

export interface ParseResult {
  records: ParsedRecord[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  totalRows: number;
}

/**
 * Safely parses JSON strings from CSV columns, falling back to empty object
 */
function safeParseJson(value?: string): Record<string, any> {
  if (!value) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // If not a JSON, wrap it as a key-value or return raw
    return { raw: trimmed };
  }
}

/**
 * Parses and validates raw Backstage CSV text.
 */
export function parseBackstageCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const records: ParsedRecord[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (parsed.errors.length > 0) {
    parsed.errors.forEach(err => {
      errors.push({
        row: err.row !== undefined ? err.row + 1 : 0,
        message: `CSV parsing error: ${err.message}`,
        raw: null,
      });
    });
  }

  const requiredFields = ["creator_id", "username", "manager_email", "group", "diamonds", "live_hours", "valid_days"];

  parsed.data.forEach((row, index) => {
    const rowNum = index + 2; // 1-indexed plus header row

    // Check for required fields
    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (row[field] === undefined || row[field] === null || String(row[field]).trim() === "") {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      errors.push({
        row: rowNum,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        raw: row,
      });
      return;
    }

    // Validate and parse numbers strictly
    const diamondsStr = String(row.diamonds).replace(/,/g, "").trim();
    const liveHoursStr = String(row.live_hours).replace(/,/g, "").trim();
    const validDaysStr = String(row.valid_days).replace(/,/g, "").trim();

    const diamonds = parseInt(diamondsStr, 10);
    const live_hours = parseFloat(liveHoursStr);
    const valid_days = parseInt(validDaysStr, 10);

    if (isNaN(diamonds) || isNaN(Number(diamondsStr)) || diamonds < 0) {
      errors.push({
        row: rowNum,
        message: `Invalid 'diamonds' value: must be a non-negative integer. Got: "${row.diamonds}"`,
        raw: row,
      });
      return;
    }

    if (isNaN(live_hours) || isNaN(Number(liveHoursStr)) || live_hours < 0) {
      errors.push({
        row: rowNum,
        message: `Invalid 'live_hours' value: must be a non-negative number. Got: "${row.live_hours}"`,
        raw: row,
      });
      return;
    }

    if (isNaN(valid_days) || isNaN(Number(validDaysStr)) || valid_days < 0) {
      errors.push({
        row: rowNum,
        message: `Invalid 'valid_days' value: must be a non-negative integer. Got: "${row.valid_days}"`,
        raw: row,
      });
      return;
    }

    // Validate email format simply
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const managerEmail = String(row.manager_email).trim();
    if (!emailRegex.test(managerEmail)) {
      errors.push({
        row: rowNum,
        message: `Invalid 'manager_email' format: "${row.manager_email}"`,
        raw: row,
      });
      return;
    }

    // Parse optional fields with defaults/warnings
    const followers = row.followers ? parseInt(String(row.followers).replace(/,/g, ""), 10) : 0;
    if (row.followers && isNaN(followers)) {
      warnings.push({
        row: rowNum,
        message: `Optional field 'followers' is malformed: "${row.followers}". Defaulting to 0.`,
      });
    }

    const matches = row.matches ? parseInt(String(row.matches).replace(/,/g, ""), 10) : 0;
    if (row.matches && isNaN(matches)) {
      warnings.push({
        row: rowNum,
        message: `Optional field 'matches' is malformed: "${row.matches}". Defaulting to 0.`,
      });
    }

    // Success record mapping
    records.push({
      creator_id: String(row.creator_id).trim(),
      username: String(row.username).trim(),
      manager_email: managerEmail,
      group: String(row.group).trim(),
      diamonds,
      live_hours,
      valid_days,
      followers: isNaN(followers) ? 0 : followers,
      matches: isNaN(matches) ? 0 : matches,
      tier_status: row.tier_status ? String(row.tier_status).trim() : "No Tier",
      graduation_status: row.graduation_status ? String(row.graduation_status).trim() : "active",
      last_month_metrics: safeParseJson(row.last_month_metrics),
      growth_metrics: safeParseJson(row.growth_metrics),
      multi_guest_metrics: safeParseJson(row.multi_guest_metrics),
    });
  });

  return {
    records,
    errors,
    warnings,
    totalRows: parsed.data.length,
  };
}
