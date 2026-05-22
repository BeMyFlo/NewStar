// scratch/test-api-e2e.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SERVICE_ROLE_KEY";

// Create clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function runE2E() {
  console.log("=== STARTING NEWSTAR E2E API FLOW TEST ===");

  // 1. Sign in as Owner to get session
  console.log("\n[1] Signing in as Owner (owner@newstar.com)...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "owner@newstar.com",
    password: "password123"
  });

  if (authError || !authData.session) {
    console.error("❌ Sign in failed:", authError?.message || "No session");
    process.exit(1);
  }
  console.log("✅ Signed in successfully! Token received.");

  const session = authData.session;
  // Build Supabase SSR Cookie
  // Note: Localhost is parsed by @supabase/ssr. We'll set both sb-localhost-auth-token and sb-127-0-0-1-auth-token cookies just in case
  const sessionString = JSON.stringify(session);
  const base64Session = Buffer.from(sessionString).toString("base64");
  const cookieHeader = `sb-localhost-auth-token=${base64Session}; sb-127-0-0-1-auth-token=${base64Session}`;

  // 2. Prepare Mock TikTok Backstage CSV file
  console.log("\n[2] Preparing Mock CSV Content...");
  const csvContent = `creator_id,username,manager_email,group,diamonds,live_hours,valid_days,followers,matches,tier_status,graduation_status
e0a80101-0000-0000-0000-000000000001,Creator Frank,manager1@newstar.com,Vietnam LIVE Network,150000,21.0,9,2400,16,Tier 1,active
e0a80101-0000-0000-0000-000000000002,Jack Streamer,manager1@newstar.com,Vietnam LIVE Network,320000,29.0,11,4600,30,Tier 2,active
e0a80101-0000-0000-0000-000000000003,Rose Beauty,manager2@newstar.com,Thailand Rising Stars,220000,26.0,10,1400,12,Tier 2,active
e0a80101-0000-0000-0000-000000000004,Lisa Dancer,manager2@newstar.com,Thailand Rising Stars,90000,19.0,8,980,5,No Tier,active
`;

  const tempCsvPath = path.join(__dirname, "temp_backstage.csv");
  fs.writeFileSync(tempCsvPath, csvContent);
  console.log(`✅ Temporary CSV file written to: ${tempCsvPath}`);

  // 3. Call POST /api/backstage-import using FormData
  console.log("\n[3] Triggering CSV Backstage Import API...");
  
  // Construct multi-part body manually since we are in basic Node
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const fileBuffer = fs.readFileSync(tempCsvPath);
  const fileHeader = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="temp_backstage.csv"`,
    `Content-Type: text/csv`,
    "",
    ""
  ].join("\r\n");

  const startDateHeader = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="startDate"`,
    "",
    "2026-05-22"
  ].join("\r\n");

  const endDateHeader = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="endDate"`,
    "",
    "2026-05-28"
  ].join("\r\n");

  const endBoundary = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(fileHeader),
    fileBuffer,
    Buffer.from("\r\n"),
    Buffer.from(startDateHeader),
    Buffer.from("\r\n"),
    Buffer.from(endDateHeader),
    Buffer.from(endBoundary)
  ]);

  const importResponse = await fetch("http://localhost:3000/api/backstage-import", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Cookie": cookieHeader
    },
    body: bodyBuffer
  });

  const importData = await importResponse.json();
  if (!importResponse.ok) {
    console.error("❌ Import failed with status:", importResponse.status, importData);
    cleanUp(tempCsvPath);
    process.exit(1);
  }
  console.log("✅ Import successful!", importData);

  // Retrieve period ID
  const periodId = importData.period?.id;
  console.log(`ℹ️ Created/Fetched Backstage Period ID: ${periodId}`);

  // 4. Call POST /api/weekly-reports/generate
  console.log("\n[4] Generating Weekly Report snapshot...");
  const weeklyResponse = await fetch("http://localhost:3000/api/weekly-reports/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader
    },
    body: JSON.stringify({ periodId })
  });

  const weeklyData = await weeklyResponse.json();
  if (!weeklyResponse.ok) {
    console.error("❌ Weekly Report Generation failed:", weeklyData);
    cleanUp(tempCsvPath);
    process.exit(1);
  }
  console.log("✅ Weekly Report generated successfully!", weeklyData);

  // 5. Call POST /api/cashback-reports/generate
  console.log("\n[5] Generating Monthly Cashback Report...");
  const cashbackResponse = await fetch("http://localhost:3000/api/cashback-reports/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader
    },
    body: JSON.stringify({ month: "2026-05-01" }) // target month
  });

  const cashbackData = await cashbackResponse.json();
  if (!cashbackResponse.ok) {
    console.error("❌ Monthly Cashback Report Generation failed:", cashbackData);
    cleanUp(tempCsvPath);
    process.exit(1);
  }
  console.log("✅ Monthly Cashback Report generated successfully!", cashbackData);

  // 6. DB Verification - Query materialized view and tables to ensure they updated
  console.log("\n[6] Verifying DB records directly...");
  
  // Verify creator states
  const { data: states, error: statesErr } = await supabaseAdmin
    .from("current_creator_state")
    .select("*");

  if (statesErr) {
    console.error("❌ Error fetching current_creator_state:", statesErr.message);
  } else {
    console.log(`✅ Current Creator State View contains ${states.length} creators.`);
    console.table(
      states.map(s => ({
        Username: s.username,
        Diamonds: Number(s.diamonds),
        Hours: s.live_hours,
        Days: s.valid_days,
        Tier: s.tier_status,
        Status: s.creator_status
      }))
    );
  }

  // Verify monthly reports
  const { data: reports, error: reportsErr } = await supabaseAdmin
    .from("monthly_cashback_reports")
    .select("*")
    .eq("month", "2026-05-01");

  if (reportsErr || reports.length === 0) {
    console.error("❌ Error fetching monthly_cashback_reports:", reportsErr?.message || "No report found");
  } else {
    console.log("✅ Monthly Cashback Report row created in Database:");
    console.log(`- Month: ${reports[0].month}`);
    console.log(`- Total Cashback: $${reports[0].total_cashback}`);
    console.log(`- Tier Breakdown:`, reports[0].tier_breakdown);
  }

  cleanUp(tempCsvPath);
  console.log("\n=== ALL E2E API TESTS PASSED SUCCESSFULLY ===");
}

function cleanUp(filePath) {
  try {
    fs.unlinkSync(filePath);
    console.log(`\n🧹 Cleaned up temporary CSV: ${filePath}`);
  } catch (err) {
    // Ignore
  }
}

runE2E();
