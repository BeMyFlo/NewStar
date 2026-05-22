// src/app/api/backstage-import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/auth/server-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBackstageCsv } from "@/lib/csv-parser/parser";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Auth & Roles Server-Side
    const { user, role, error: authError } = await getServerAuth();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Owner or Admin role required" }, 
        { status: 403 }
      );
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const startDate = formData.get("startDate") as string; // 'YYYY-MM-DD'
    const endDate = formData.get("endDate") as string;     // 'YYYY-MM-DD'

    if (!file || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields (file, startDate, endDate)" }, 
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const filename = file.name;

    const supabaseAdmin = createAdminClient();

    // 3. Ensure bucket exists and upload raw CSV to Storage
    // Ignore error if bucket already exists
    await supabaseAdmin.storage.createBucket("backstage-csvs", {
      public: false,
    });

    const storagePath = `backstage-csvs/${Date.now()}_${filename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("backstage-csvs")
      .upload(storagePath, file, {
        contentType: file.type,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload CSV to storage: ${uploadError.message}` }, 
        { status: 500 }
      );
    }

    // 4. Create import file record in database
    const { data: importFile, error: importFileError } = await supabaseAdmin
      .from("csv_import_files")
      .insert({
        filename,
        storage_path: storagePath,
        status: "processing",
        uploaded_by: user.id
      })
      .select()
      .single();

    if (importFileError || !importFile) {
      return NextResponse.json(
        { error: `Failed to create import log: ${importFileError?.message || "Unknown database error"}` }, 
        { status: 500 }
      );
    }

    // 5. Parse CSV
    const parseResult = parseBackstageCsv(csvText);

    if (parseResult.errors.length > 0 && parseResult.records.length === 0) {
      // Critical validation errors, abort import
      await supabaseAdmin
        .from("csv_import_files")
        .update({
          status: "failed",
          errors: { errors: parseResult.errors }
        })
        .eq("id", importFile.id);

      return NextResponse.json({
        error: "Failed to parse CSV due to schema validation errors",
        details: parseResult.errors
      }, { status: 400 });
    }

    // 6. Execute bulk transaction import using PostgreSQL RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("import_backstage_records", {
      p_period_start: startDate,
      p_period_end: endDate,
      p_import_file_id: importFile.id,
      p_uploaded_by: user.id,
      p_records: parseResult.records
    });

    if (rpcError) {
      // The transaction will have rolled back inside PostgreSQL automatically.
      await supabaseAdmin
        .from("csv_import_files")
        .update({
          status: "failed",
          errors: { rpc_error: rpcError }
        })
        .eq("id", importFile.id);

      return NextResponse.json({
        error: `Database import transaction failed: ${rpcError.message}`,
        details: rpcError
      }, { status: 500 });
    }

    // 7. Log additional details if we had warnings or minor errors
    if (parseResult.errors.length > 0) {
      await supabaseAdmin
        .from("csv_import_files")
        .update({
          errors: { 
            parsing_warnings: parseResult.warnings,
            ignored_rows: parseResult.errors
          },
          failed_rows: parseResult.errors.length
        })
        .eq("id", importFile.id);
    }

    // 8. Return summary response
    return NextResponse.json({
      success: true,
      message: "Data imported successfully",
      summary: {
        totalRows: parseResult.totalRows,
        successRows: parseResult.records.length,
        failedRows: parseResult.errors.length,
        warningsCount: parseResult.warnings.length,
      },
      errors: parseResult.errors,
      warnings: parseResult.warnings
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
