const supabase = require("../config/supabase");
const { createAuditLogFromRequest } = require("./auditLogController");

const ALLOWED_STATUSES = [
  "Queued",
  "In Production",
  "Printed",
  "In Transit",
  "Completed",
];

const normalizeControlNo = (value, applicationId) => {
  const controlNo = String(value || "").trim();
  if (!controlNo) return "";

  if (/^CTRL-\d{2}-\d{4}$/i.test(controlNo)) return controlNo.toUpperCase();
  if (/^CTL-\d{2}-\d{4}$/i.test(controlNo)) {
    return controlNo.replace(/^CTL-/i, "CTRL-").toUpperCase();
  }

  if (/OSCA/i.test(controlNo)) {
    const digits = String(applicationId || controlNo).replace(/\D/g, "");
    if (digits.length >= 6) {
      return `CTRL-${digits.slice(0, 2)}-${digits.slice(-4)}`;
    }
  }

  return controlNo;
};

const normalizePrintStatus = (value) => {
  const status = String(value || "Queued")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const canonical = ALLOWED_STATUSES.find((item) => item.toLowerCase() === status);
  if (canonical) return canonical;

  const legacyStatusMap = {
    pending: "Queued",
    "in process": "In Production",
    inproduction: "In Production",
    processing: "In Production",
    exported: "Printed",
    ready: "In Transit",
    intransit: "In Transit",
    released: "Completed",
  };
  return legacyStatusMap[status] || "Queued";
};

const isMissingCompletedAtColumn = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return Boolean(error) && (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("completed_at") && (message.includes("column") || message.includes("schema cache")))
  );
};

const createSignedFileUrlMap = async (filePaths) => {
  const paths = Array.from(new Set(filePaths.filter(Boolean)));
  if (!paths.length) return new Map();

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrls(paths, 60 * 30);

  if (error) {
    console.error("Unable to create ID Maker media URLs:", error);
    return new Map();
  }

  return new Map((data || []).map((item) => [
    item.path,
    item.signedUrl || "",
  ]));
};

// Keep request URLs small: .in() with hundreds of ids can exceed URL limits.
const chunk = (arr, size = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchByApplicationIds = async (table, columns, ids) => {
  const results = await Promise.all(
    chunk(ids).map((part) =>
      supabase.from(table).select(columns).in("application_id", part)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  return results.flatMap((r) => r.data || []);
};

// ============================================
// CREATE / ADD APPLICANT TO ID MAKER QUEUE
// ============================================
const addToIdMakerQueue = async (req, res) => {
  try {
    const {
      application_id,
      control_no,
      date_issued,
      print_status,
    } = req.body;

    if (!application_id) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("application_id")
      .eq("application_id", application_id)
      .maybeSingle();

    if (applicationError) throw applicationError;

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    let { data: existingQueueItem, error: existingQueueError } = await supabase
      .from("id_maker_queue")
      .select("completed_at")
      .eq("application_id", application_id)
      .limit(1)
      .maybeSingle();

    let completionTimestampAvailable = true;
    if (isMissingCompletedAtColumn(existingQueueError)) {
      completionTimestampAvailable = false;
      existingQueueItem = null;
      existingQueueError = null;
    }
    if (existingQueueError) throw existingQueueError;

    const queueStatus = print_status || "Queued";

    if (!ALLOWED_STATUSES.includes(queueStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID Maker queue status.",
      });
    }

    const queuePayload = {
      application_id: application_id,
      control_no: normalizeControlNo(control_no, application_id) || null,
      date_issued: date_issued || null,
      print_status: queueStatus,
      // This is the queue position timestamp; status updates must not decide
      // which applicant appears first in the ID Maker table.
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (completionTimestampAvailable) {
      queuePayload.completed_at = queueStatus === "Completed"
        ? (existingQueueItem?.completed_at || new Date().toISOString())
        : (existingQueueItem?.completed_at ?? null);
    }

    const { data, error } = await supabase
      .from("id_maker_queue")
      .upsert(queuePayload, { onConflict: "application_id" })
      .select()
      .single();

    if (error) throw error;

    await createAuditLogFromRequest(req, {
      action: "ISSUANCE_FORM_SENT_TO_ID_MAKER",
      entityType: "APPLICATION",
      entityId: application_id,
      details: "Issuance form was successfully sent to the ID Maker queue.",
    });

    return res.status(200).json({
      success: true,
      message: "Applicant added to ID Maker queue successfully.",
      queue: data,
    });
  } catch (error) {
    console.error("Error adding applicant to ID Maker queue:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add applicant to ID Maker queue.",
      error: error.message,
    });
  }
};

// Return identifiers only for Staff issuance duplicate checks.
const getIdMakerQueueApplicationIds = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const { data, error } = await supabase
      .from("id_maker_queue")
      .select("application_id")
      .not("application_id", "is", null);
    if (error) throw error;
    const applicationIds = Array.from(new Set((data || [])
      .map((item) => String(item.application_id || "").trim())
      .filter(Boolean)));
    return res.status(200).json({ success: true, application_ids: applicationIds });
  } catch (error) {
    console.error("Error fetching ID Maker queue application IDs:", error);
    return res.status(500).json({ success: false, message: "Failed to verify existing ID Maker queue entries." });
  }
};
// ============================================
// GET ID MAKER QUEUE
// ============================================
const getIdMakerQueue = async (req, res) => {
  try {
    // Queue contents change as staff update print statuses. Do not let a
    // browser or intermediary return an older snapshot on refresh.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    // 1. Queue records
    let queueResult = await supabase
      .from("id_maker_queue")
      .select(`
        id,
        application_id,
        control_no,
        date_issued,
        print_status,
        sent_at,
        updated_at,
        completed_at
      `)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("sent_at", { ascending: false, nullsFirst: false });

    let completionTimestampAvailable = true;
    if (isMissingCompletedAtColumn(queueResult.error)) {
      completionTimestampAvailable = false;
      queueResult = await supabase
        .from("id_maker_queue")
        .select(`
          id,
          application_id,
          control_no,
          date_issued,
          print_status,
          sent_at,
          updated_at
        `)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("sent_at", { ascending: false, nullsFirst: false });
    }

    if (queueResult.error) throw queueResult.error;
    const queueRecords = queueResult.data;

    const applicationIds = Array.from(
      new Set(
        (queueRecords || [])
          .map((item) => String(item.application_id || "").trim())
          .filter(Boolean)
      )
    );

    if (!queueRecords || queueRecords.length === 0) {
      return res.status(200).json({
        success: true,
        queue: [],
        completion_timestamp_available: completionTimestampAvailable,
      });
    }

    // Reconcile queue records against the latest Staff application status.
    // This also repairs records that became Ready for Release before this
    // synchronization code was deployed (without re-triggering SMS).
    const statusHistoryRows = await fetchByApplicationIds(
      "application_status_history",
      "application_id, status, updated_at",
      applicationIds
    );
    statusHistoryRows.sort((left, right) =>
      new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    );

    const latestStatusByApplication = new Map();
    for (const row of statusHistoryRows) {
      const key = String(row.application_id || "").trim();
      if (key && !latestStatusByApplication.has(key)) {
        latestStatusByApplication.set(key, row.status);
      }
    }

    const readyQueueIds = applicationIds.filter(
      (id) => latestStatusByApplication.get(id) === "Ready for Release"
    );

    if (readyQueueIds.length) {
      const completedAt = new Date().toISOString();
      const updates = await Promise.all(readyQueueIds.map(async (id) => {
        let result = await supabase
          .from("id_maker_queue")
          .update({
            print_status: "Completed",
            completed_at: completedAt,
            updated_at: completedAt,
          })
          .eq("application_id", id);

        if (result.error && isMissingCompletedAtColumn(result.error)) {
          result = await supabase
            .from("id_maker_queue")
            .update({
              print_status: "Completed",
              updated_at: completedAt,
            })
            .eq("application_id", id);
        }

        if (result.error) {
          console.error(
            "[ID Maker] Queue reconciliation failed for application:",
            id,
            result.error.message
          );
        }

        return { id, error: result.error || null };
      }));

      const failedUpdates = updates.filter((item) => item.error);
      if (failedUpdates.length) {
        console.error(
          "[ID Maker] Queue reconciliation completed with errors:",
          failedUpdates.map((item) => ({ applicationId: item.id, error: item.error.message }))
        );
      }

      // Reflect the synchronized values in this same response, so the portal
      // immediately displays Completed without requiring another refresh.
      for (const item of queueRecords) {
        const id = String(item.application_id || "").trim();
        if (readyQueueIds.includes(id) && !failedUpdates.some((failed) => failed.id === id)) {
          item.print_status = "Completed";
          item.completed_at = item.completed_at || completedAt;
          item.updated_at = completedAt;
        }
      }
    }

    // 2. Application + file records (chunked)
    const applications = await fetchByApplicationIds(
      "applications",
      "*",
      applicationIds
    );

    const idRequests = await fetchByApplicationIds(
      "id_requests",
      "id, application_id, requested_at",
      applicationIds
    );
    const replacementApplicationIds = new Set(
      idRequests.map((request) => String(request.application_id || "").trim()).filter(Boolean)
    );

    const applicationFiles = await fetchByApplicationIds(
      "application_files",
      "application_id, latest_photo_url, signature_url",
      applicationIds
    );

    const fileMap = new Map(
      applicationFiles.map((file) => [
        String(file.application_id || "").trim(),
        file,
      ])
    );

    // Sign every photo and signature in one Storage request.
    const signedUrls = await createSignedFileUrlMap(
      applicationFiles.flatMap((file) => [
        file.latest_photo_url,
        file.signature_url,
      ])
    );

    // 3. Lookup maps
    const applicationMap = new Map(
      applications.map((application) => [
        String(application.application_id || "").trim(),
        application,
      ])
    );

    // Preserve one output row for every id_maker_queue record. Some older
    // records may have duplicate or missing application IDs; do not collapse
    // them while building the table response.
    const queueEntries = (queueRecords || []).map((queueItem) => {
      const applicationId = String(queueItem.application_id || "").trim();
      return {
        applicationId,
        queueItem,
        application: applicationMap.get(applicationId),
      };
    });

    // 4. Build response
    const completeQueue = queueEntries.map(
      ({ applicationId, queueItem, application }) => {
        const files = fileMap.get(applicationId) || {};
        const photo = signedUrls.get(files.latest_photo_url) || "";
        const signature = signedUrls.get(files.signature_url) || "";

        const firstName = String(application?.first_name || application?.firstName || "").trim().replace(/\s+/g, " ");
        const middleName = String(application?.middle_name || application?.middleName || "").trim().replace(/\s+/g, " ");
        const surname = String(application?.surname || application?.last_name || application?.lastName || "").trim().replace(/\s+/g, " ");
        const rawFullName = application?.name || application?.full_name || application?.fullName || application?.applicant_name || application?.applicantName || [
          firstName,
          middleName,
          surname,
        ]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ");
        const fullName = String(rawFullName || "").trim().replace(/\s+/g, " ");
        const explicitRequestType = [
          application?.request_category,
          application?.request_kind,
          application?.request_type,
          application?.application_type,
          application?.applicationType,
          application?.type,
          application?.request_for,
          application?.id_request_type,
        ].find((value) => value !== null && value !== undefined && String(value).trim());
        const requestType = /replace/i.test(String(explicitRequestType || "")) || replacementApplicationIds.has(applicationId)
          ? "Replacement"
          : "New";

        return {
          id: applicationId || `queue-${queueItem.id}`,
          application_id: applicationId,
          inPrintQueue: Boolean(queueItem),

          name: fullName,
          requestType,
          firstName,
          middleName,
          surname,
          address: application?.house_street || application?.houseStreet || application?.address || "",
          barangay: String(application?.barangay_district || application?.barangayDistrict || application?.barangay || "").trim(),
          dob: application?.date_of_birth || application?.dateOfBirth || application?.dob || "",
          gender: application?.sex || application?.gender || "",
          age: application?.age || "",

          controlNo: normalizeControlNo(queueItem?.control_no, applicationId),
          dateIssued: queueItem?.date_issued || "",

          photo,
          signature,

          printStatus: normalizePrintStatus(queueItem?.print_status),
          linkedToApplication: Boolean(application),

          sentAt: queueItem?.sent_at || null,
          updatedAt: queueItem?.updated_at || null,
          completedAt: queueItem?.completed_at || null,
          regDate: application?.created_at || "",
        };
      }
    );

    return res.status(200).json({
      success: true,
      queue: completeQueue,
      completion_timestamp_available: completionTimestampAvailable,
    });
  } catch (error) {
    console.error("Error fetching ID Maker queue:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ID Maker queue.",
      error: error.message,
    });
  }
};

// ============================================
// BULK UPDATE ID MAKER QUEUE + APPLICATION STATUS
// ============================================
const bulkUpdateIdMakerQueue = async (req, res) => {
  try {
    const ids = [...new Set(
      (Array.isArray(req.body?.application_ids) ? req.body.application_ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )];
    const printStatus = req.body?.print_status;

    if (!ids.length) {
      return res.status(400).json({ success: false, message: "Select at least one applicant." });
    }
    if (ids.length > 250) {
      return res.status(400).json({ success: false, message: "A maximum of 250 applicants can be updated at once." });
    }
    if (!ALLOWED_STATUSES.includes(printStatus)) {
      return res.status(400).json({ success: false, message: "Invalid ID Maker queue status." });
    }

    const now = new Date().toISOString();
    const applicationStatus = printStatus === "Completed" ? "Ready for Release" : "In Process";

    const { data: applications, error: applicationsError } = await supabase
      .from("applications")
      .select("application_id")
      .in("application_id", ids);
    if (applicationsError) throw applicationsError;

    const validIds = (applications || []).map((item) => String(item.application_id));
    const missingIds = ids.filter((id) => !validIds.includes(id));
    if (missingIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some selected applicants no longer exist. Refresh the queue and try again.",
        failed_ids: missingIds,
      });
    }

    let existingQueueResult = await supabase
      .from("id_maker_queue")
      .select("application_id, completed_at")
      .in("application_id", ids);
    let completionTimestampAvailable = true;
    if (existingQueueResult.error && isMissingCompletedAtColumn(existingQueueResult.error)) {
      completionTimestampAvailable = false;
      existingQueueResult = { data: [], error: null };
    }
    if (existingQueueResult.error) throw existingQueueResult.error;

    const completedAtById = new Map(
      (existingQueueResult.data || []).map((row) => [String(row.application_id), row.completed_at || null])
    );
    const queueRows = ids.map((applicationId) => ({
      application_id: applicationId,
      print_status: printStatus,
      updated_at: now,
      ...(completionTimestampAvailable ? {
        completed_at: printStatus === "Completed"
          ? (completedAtById.get(applicationId) || now)
          : completedAtById.get(applicationId),
      } : {}),
    }));

    let queueResult = await supabase
      .from("id_maker_queue")
      .upsert(queueRows, { onConflict: "application_id" })
      .select(completionTimestampAvailable
        ? "application_id, print_status, updated_at, completed_at"
        : "application_id, print_status, updated_at");
    if (queueResult.error) throw queueResult.error;

    const { data: historyRows, error: historyReadError } = await supabase
      .from("application_status_history")
      .select("application_id")
      .in("application_id", ids);
    if (historyReadError) throw historyReadError;

    const existingHistoryIds = [...new Set((historyRows || []).map((row) => String(row.application_id)))];
    const missingHistoryIds = ids.filter((id) => !existingHistoryIds.includes(id));

    const historyWrites = [];
    if (existingHistoryIds.length) {
      historyWrites.push(
        supabase.from("application_status_history")
          .update({ status: applicationStatus, updated_at: now })
          .in("application_id", existingHistoryIds)
      );
    }
    if (missingHistoryIds.length) {
      historyWrites.push(
        supabase.from("application_status_history")
          .insert(missingHistoryIds.map((application_id) => ({
            application_id, status: applicationStatus, updated_at: now
          })))
      );
    }
    const historyResults = await Promise.all(historyWrites);
    const historyFailure = historyResults.find((result) => result.error);
    if (historyFailure) throw historyFailure.error;

    await Promise.all(ids.map((applicationId) =>
      createAuditLogFromRequest(req, {
        action: "ID_MAKER_BULK_STATUS_UPDATED",
        entityType: "APPLICATION",
        entityId: applicationId,
        details: `ID Maker queue status bulk-updated to "${printStatus}" by ${req.user?.username || "authenticated user"}.`,
      })
    ));

    return res.status(200).json({
      success: true,
      message: "Selected applicants were updated successfully.",
      updated_count: ids.length,
      print_status: printStatus,
      application_status: applicationStatus,
      queue: queueResult.data || [],
    });
  } catch (error) {
    console.error("Bulk ID Maker queue update failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk-update the selected applicants.",
      error: error.message,
    });
  }
};

// ============================================
// UPDATE ID MAKER QUEUE STATUS
// ============================================
const updateIdMakerQueue = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;

    const { print_status, control_no, date_issued } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    if (
      print_status !== undefined &&
      !ALLOWED_STATUSES.includes(print_status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID Maker queue status.",
      });
    }

    const updatedAt = new Date().toISOString();
    const isReadyForRelease = print_status === "In Transit";

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("application_id, contact_number")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found; cannot update its ID Maker queue status.",
      });
    }

    let { data: existingQueueItem, error: lookupError } = await supabase
      .from("id_maker_queue")
      .select("control_no, date_issued, completed_at, print_status")
      .eq("application_id", applicationId)
      .limit(1)
      .maybeSingle();

    let completionTimestampAvailable = true;
    if (isMissingCompletedAtColumn(lookupError)) {
      completionTimestampAvailable = false;
      const fallbackLookup = await supabase
        .from("id_maker_queue")
        .select("control_no, date_issued, print_status")
        .eq("application_id", applicationId)
        .limit(1)
        .maybeSingle();
      existingQueueItem = fallbackLookup.data;
      lookupError = fallbackLookup.error;
    }

    if (lookupError) throw lookupError;

    const queuePayload = {
      application_id: applicationId,
      print_status: print_status ?? existingQueueItem?.print_status ?? "Queued",
      control_no: normalizeControlNo(
        control_no ?? existingQueueItem?.control_no,
        applicationId
      ) || null,
      date_issued: date_issued ?? existingQueueItem?.date_issued ?? null,
      updated_at: updatedAt,
    };
    if (completionTimestampAvailable) {
      queuePayload.completed_at = print_status === "Completed"
        ? (existingQueueItem?.completed_at || updatedAt)
        : (existingQueueItem?.completed_at ?? null);
    }

    const { data, error } = await supabase
      .from("id_maker_queue")
      .upsert(queuePayload, { onConflict: "application_id" })
      .select()
      .single();

    if (error) throw error;

    await createAuditLogFromRequest(req, {
      action: "ID_MAKER_QUEUE_UPDATED",
      entityType: "APPLICATION",
      entityId: applicationId,
      details: `ID Maker print status updated to "${queuePayload.print_status}".`,
    });

    return res.status(200).json({
      success: true,
      message: "ID Maker queue updated successfully.",
      queue: data,
    });
  } catch (error) {
    console.error("Error updating ID Maker queue:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update ID Maker queue.",
      error: error.message,
    });
  }
};

module.exports = {
  addToIdMakerQueue,
  getIdMakerQueue,
  getIdMakerQueueApplicationIds,
  updateIdMakerQueue,
  bulkUpdateIdMakerQueue,
};
