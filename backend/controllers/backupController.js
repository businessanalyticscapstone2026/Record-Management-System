const crypto = require("crypto");
const supabase = require("../config/supabase");
const { createAuditLogFromRequest } = require("./auditLogController");

const BACKUP_BUCKET = "system-backups";
const SOURCE_BUCKET = "documents";
const BACKUP_VERSION = 1;
const PAGE_SIZE = 1000;
let currentRestoreProgress = { active: false, status: "idle", percent: 0, stage: "Waiting to start", updatedAt: null };
let restoreCancelRequested = false;

function checkRestoreCancelled() {
  if (restoreCancelRequested) {
    const error = new Error("Recovery was cancelled by the administrator.");
    error.code = "RESTORE_CANCELLED";
    throw error;
  }
}

function setRestoreProgress(percent, stage, extra = {}) {
  currentRestoreProgress = {
    ...currentRestoreProgress,
    ...extra,
    active: extra.active !== undefined ? extra.active : true,
    status: extra.status || (restoreCancelRequested ? "cancelling" : "running"),
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    stage: restoreCancelRequested && !["completed", "completed_with_issues", "cancelled", "failed"].includes(extra.status) ? "Cancellation requested. Finishing the current safe operation…" : stage,
    updatedAt: new Date().toISOString(),
  };
}

async function getSystemRestoreProgress(req, res) {
  return res.json({ success: true, progress: currentRestoreProgress });
}

async function cancelSystemRestore(req, res) {
  if (!currentRestoreProgress.active) {
    return res.status(409).json({ success: false, message: "There is no active recovery to cancel." });
  }
  restoreCancelRequested = true;
  setRestoreProgress(currentRestoreProgress.percent, "Cancellation requested. Finishing the current safe operation…", { active: true, status: "cancelling" });
  return res.json({ success: true, message: "Recovery cancellation requested. The current database batch or file operation will finish before recovery stops." });
}

let currentBackupProgress = { active: false, status: "idle", percent: 0, stage: "Waiting to start", updatedAt: null };
let backupCancelRequested = false;
let listingFoldersScanned = 0;
let listingFilesFound = 0;

function setBackupProgress(percent, stage, extra = {}) {
  currentBackupProgress = {
    ...currentBackupProgress,
    ...extra,
    active: extra.active !== undefined ? extra.active : true,
    status: extra.status || (backupCancelRequested ? "cancelling" : "running"),
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    stage: backupCancelRequested && !["completed", "failed", "cancelled"].includes(extra.status)
      ? "Cancellation requested; stopping safely…"
      : stage,
    updatedAt: new Date().toISOString(),
  };
}

async function getSystemBackupProgress(req, res) {
  return res.json({ success: true, progress: currentBackupProgress });
}

async function cancelSystemBackup(req, res) {
  if (!currentBackupProgress.active) {
    return res.status(409).json({ success: false, message: "There is no active backup to cancel." });
  }
  backupCancelRequested = true;
  setBackupProgress(currentBackupProgress.percent, "Cancellation requested. Finishing the current operation safely…", {
    active: true, status: "cancelling"
  });
  return res.json({ success: true, message: "Backup cancellation requested. The current operation will finish safely before temporary backup parts are removed." });
}

function checkBackupCancelled() {
  if (backupCancelRequested) {
    const error = new Error("Backup cancelled by administrator.");
    error.code = "BACKUP_CANCELLED";
    throw error;
  }
}

const TABLES = [
  { name: "applications", conflict: "application_id" },
  { name: "user_accounts", conflict: "id" },
  { name: "application_files", conflict: "application_id" },
  { name: "family_composition", conflict: "id" },
  { name: "personal_background", conflict: "application_id" },
  { name: "problems_needs", conflict: "application_id" },
  { name: "confirmations", conflict: "application_id" },
  { name: "memberships", conflict: "application_id" },
  { name: "application_status_history", conflict: "id" },
  { name: "document_authentications", conflict: "id" },
  { name: "id_maker_queue", conflict: "application_id" },
  { name: "id_requests", conflict: "id" },
  { name: "audit_logs", conflict: "id" },
];

function encryptionKey(salt = Buffer.from("record-management-system-backup-v1")) {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    const error = new Error("BACKUP_ENCRYPTION_KEY is not configured. Add a secret of at least 32 characters to the backend environment before creating or restoring backups.");
    error.status = 503;
    throw error;
  }
  return crypto.scryptSync(secret, salt, 32);
}

function encryptArchive(buffer) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = encryptionKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([Buffer.from("RMSE1"), salt, iv, cipher.getAuthTag(), encrypted]);
}

function decryptArchive(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 49 || buffer.subarray(0, 5).toString() !== "RMSE1") {
    throw new Error("This file is not a supported encrypted system backup.");
  }
  const salt = buffer.subarray(5, 21);
  const iv = buffer.subarray(21, 33);
  const tag = buffer.subarray(33, 49);
  const encrypted = buffer.subarray(49);
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("BACKUP_ENCRYPTION_KEY is not configured on the backend.");
  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

async function ensureBucket(name, isPublic = false) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const existing = (buckets || []).find(bucket => bucket.name === name);

  if (existing) {
    // Existing buckets retain their old restrictions. Explicitly configure
    // the backup bucket so the small archive chunks can be uploaded.
    if (name === BACKUP_BUCKET) {
      const { error: updateError } = await supabase.storage.updateBucket(name, {
        public: false,
        fileSizeLimit: "4MB",
      });
      if (updateError) {
        throw new Error(
          "Unable to configure the private system-backups bucket. Check the Supabase global file-size limit and bucket settings: " +
          updateError.message
        );
      }
    }
    return;
  }

  const { error } = await supabase.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: name === BACKUP_BUCKET ? "4MB" : "2GB",
  });

  if (error && !/already exists|duplicate/i.test(error.message || "")) throw error;
}

async function fetchAllTableRows(tableName) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(tableName).select("*").range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Unable to back up table " + tableName + ": " + error.message);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

let activeStorageListRequests = 0;
const storageListWaiters = [];

async function withStorageListLimit(operation) {
  if (activeStorageListRequests >= 5) {
    await new Promise(resolve => storageListWaiters.push(resolve));
  }
  activeStorageListRequests += 1;
  try {
    return await operation();
  } finally {
    activeStorageListRequests -= 1;
    const next = storageListWaiters.shift();
    if (next) next();
  }
}

async function listStorageFiles(bucket, folder = "") {
  checkBackupCancelled();
  const files = [];
  const childFolders = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    checkBackupCancelled();
    const { data, error } = await withStorageListLimit(() =>
      supabase.storage.from(bucket).list(folder, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      })
    );
    checkBackupCancelled();
    if (error) throw new Error("Unable to list uploaded files in " + bucket + ": " + error.message);
    const entries = data || [];
    for (const entry of entries) {
      checkBackupCancelled();
      if (entry.id === null) childFolders.push(folder ? folder + "/" + entry.name : entry.name);
      else {
        const path = folder ? folder + "/" + entry.name : entry.name;
        files.push({ path, name: entry.name, metadata: entry.metadata || {} });
      }
    }
    if (entries.length < PAGE_SIZE) break;
  }
  listingFoldersScanned += 1;
  listingFilesFound += files.length;
  setBackupProgress(43, "Scanning uploaded applicant files (" + listingFilesFound + " files found)", {
    discoveredFiles: listingFilesFound, scannedFolders: listingFoldersScanned
  });
  const childResults = await mapWithConcurrency(childFolders, 5, child => listStorageFiles(bucket, child));
  for (const childFiles of childResults) files.push(...childFiles);
  return files;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      checkBackupCancelled();
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

const BACKUP_STATE_PATH = "_backup-state.json";
const FULL_BACKUP_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const APPLICATION_FILE_COLUMNS = [
  "valid_id_url",
  "valid_id_back_url",
  "latest_photo_url",
  "birth_certificate_url",
  "community_tax_certificate_url",
  "signature_url",
];

function normalizeDocumentStoragePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let candidate = value.trim();
  try {
    if (/^https?:\/\//i.test(candidate)) {
      const url = new URL(candidate);
      const marker = "/documents/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) candidate = url.pathname.slice(markerIndex + marker.length);
      else return null;
    }
  } catch (_) {
    return null;
  }
  candidate = candidate.replace(/^\/+/, "").split("?")[0];
  if (!candidate || candidate.split("/").includes("..")) return null;
  return candidate;
}

function getReferencedDocumentPaths(applicationFileRows) {
  const paths = new Set();
  for (const row of applicationFileRows || []) {
    for (const column of APPLICATION_FILE_COLUMNS) {
      const path = normalizeDocumentStoragePath(row?.[column]);
      if (path) paths.add(path);
    }
  }
  return Array.from(paths).sort();
}

async function readBackupState(storage) {
  const { data, error } = await storage.download(BACKUP_STATE_PATH);
  if (error || !data) return null;
  try {
    const state = JSON.parse(await data.text());
    if (!state || typeof state.latestBackupId !== "string" || !Array.isArray(state.trackedFilePaths)) return null;
    return state;
  } catch (_) {
    return null;
  }
}

async function bootstrapBackupState(storage) {
  const metadataFiles = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.list("", {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "desc" },
    });
    if (error) throw new Error("Unable to inspect existing backup history: " + error.message);
    const entries = data || [];
    metadataFiles.push(...entries.filter(item =>
      item?.name && item.name.endsWith(".json") && item.name !== BACKUP_STATE_PATH
    ));
    if (entries.length < PAGE_SIZE) break;
  }

  const candidates = [];
  for (const item of metadataFiles) {
    const { data, error } = await storage.download(item.name);
    if (error || !data) continue;
    try {
      const metadata = JSON.parse(await data.text());
      if (metadata?.backupId && (metadata.archivePath || (Array.isArray(metadata.archiveParts) && metadata.archiveParts.length))) {
        candidates.push(metadata);
      }
    } catch (_) {
      // Ignore unrelated or malformed JSON objects in the private bucket.
    }
  }
  candidates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latestFull = candidates.find(item => item.backupType !== "incremental");
  if (!latestFull) return null;

  const { manifest } = await downloadAndOpenBackupArchive(storage, latestFull.backupId, latestFull);
  const trackedFilePaths = Array.from(new Set(
    (manifest.storage?.files || []).map(file => file?.path).filter(Boolean)
  ));
  return {
    latestBackupId: latestFull.backupId,
    latestFullCreatedAt: latestFull.createdAt,
    baseBackupId: latestFull.backupId,
    trackedFilePaths,
  };
}

async function downloadAndOpenBackupArchive(storage, backupId, metadata) {
  let encryptedArchive;
  if (Array.isArray(metadata.archiveParts) && metadata.archiveParts.length > 0) {
    const parts = [];
    for (const partPath of metadata.archiveParts) {
      if (typeof partPath !== "string" || !partPath.startsWith(backupId + ".part-")) {
        throw new Error("Backup archive contains an invalid part reference.");
      }
      const { data: partBlob, error: partError } = await storage.download(partPath);
      if (partError || !partBlob) throw new Error("Backup archive part is missing: " + partPath);
      parts.push(Buffer.from(await partBlob.arrayBuffer()));
    }
    encryptedArchive = Buffer.concat(parts);
  } else if (typeof metadata.archivePath === "string") {
    const { data: archiveBlob, error: archiveError } = await storage.download(metadata.archivePath);
    if (archiveError || !archiveBlob) throw new Error("Backup archive was not found: " + metadata.archivePath);
    encryptedArchive = Buffer.from(await archiveBlob.arrayBuffer());
  } else {
    throw new Error("Backup archive information is missing from its metadata.");
  }

  if (metadata.archiveBytes && encryptedArchive.length !== Number(metadata.archiveBytes)) {
    throw new Error("Backup archive is incomplete. The downloaded size does not match its metadata.");
  }
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(decryptArchive(encryptedArchive));
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) throw new Error("Backup manifest is missing.");
  const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  if (manifest.version !== BACKUP_VERSION || manifest.backupId !== backupId) {
    throw new Error("Backup manifest is invalid or uses an unsupported version.");
  }
  return { zip, manifest };
}

async function loadBackupMetadata(storage, backupId) {
  const { data, error } = await storage.download(backupId + ".json");
  if (error || !data) throw new Error("A required backup in the recovery chain is missing: " + backupId);
  const metadata = JSON.parse(await data.text());
  if (!metadata || metadata.backupId !== backupId) throw new Error("Backup metadata is invalid: " + backupId);
  return metadata;
}

async function createSystemBackup(req, res) {
  if (currentRestoreProgress.active) {
    return res.status(409).json({ success: false, message: "A recovery operation is currently running." });
  }
  if (currentBackupProgress.active) {
    return res.status(409).json({
      success: false,
      message: "A system backup is already running.",
      progress: currentBackupProgress,
    });
  }

  backupCancelRequested = false;
  setBackupProgress(1, "Starting encrypted backup in the background", {
    active: true,
    status: "running",
    error: null,
  });

  // Do not keep the HTTP request open for the entire backup operation.
  // The admin page follows progress through GET /api/backups/progress.
  setImmediate(() => {
    runSystemBackupJob(req).catch((error) => {
      console.error("[Backups] Unhandled background backup error:", error);
      setBackupProgress(currentBackupProgress.percent, "Backup failed: " + (error.message || "Unknown error"), {
        active: false,
        status: "failed",
        error: error.message || "Unable to create system backup.",
      });
      backupCancelRequested = false;
    });
  });

  return res.status(202).json({
    success: true,
    accepted: true,
    message: "Backup started. Follow the progress indicator until it completes.",
  });
}

async function runSystemBackupJob(req) {
  let archiveParts = [];
  try {
    setBackupProgress(1, "Preparing secure backup storage", { active: true, status: "running", error: null });
    encryptionKey();
    await ensureBucket(BACKUP_BUCKET, false);
    checkBackupCancelled();
    setBackupProgress(5, "Secure backup storage is ready");

    const AdmZip = require("adm-zip");
    const zip = new AdmZip();
    const createdAt = new Date().toISOString();
    const backupId = "backup-" + createdAt.replace(/[:.]/g, "-");
    const tableCounts = {};
    let totalRows = 0;
    let applicationFileRows = [];

    for (let index = 0; index < TABLES.length; index++) {
      checkBackupCancelled();
      const table = TABLES[index];
      const rows = await fetchAllTableRows(table.name);
      checkBackupCancelled();
      if (table.name === "application_files") applicationFileRows = rows;
      tableCounts[table.name] = rows.length;
      totalRows += rows.length;
      zip.addFile("database/" + table.name + ".json", Buffer.from(JSON.stringify(rows), "utf8"));
      const percent = 8 + ((index + 1) / TABLES.length) * 32;
      setBackupProgress(percent, "Exporting database tables (" + (index + 1) + " of " + TABLES.length + "): " + table.name, {
        completedTables: index + 1, totalTables: TABLES.length, totalRows
      });
    }

    const backupStorage = supabase.storage.from(BACKUP_BUCKET);
    let previousState = await readBackupState(backupStorage);
    if (!previousState) {
      try {
        previousState = await bootstrapBackupState(backupStorage);
      } catch (bootstrapError) {
        console.warn("[Backups] Could not rebuild the incremental index; a safe full backup will be created:", bootstrapError.message);
      }
    }
    let backupType = "full";
    let parentBackupId = null;
    let baseBackupId = backupId;
    let sourceFiles = [];
    let trackedFilePaths = [];
    const nowMs = Date.now();
    if (previousState?.latestBackupId && previousState?.latestFullCreatedAt &&
        nowMs - new Date(previousState.latestFullCreatedAt).getTime() < FULL_BACKUP_INTERVAL_MS) {
      try {
        await loadBackupMetadata(backupStorage, previousState.latestBackupId);
        backupType = "incremental";
        parentBackupId = previousState.latestBackupId;
        baseBackupId = previousState.baseBackupId || previousState.latestBackupId;
      } catch (stateError) {
        console.warn("[Backups] Previous backup state is incomplete; creating a new full backup:", stateError.message);
      }
    }

    if (backupType === "full") {
      listingFoldersScanned = 0;
      listingFilesFound = 0;
      setBackupProgress(43, "Scanning uploaded applicant file folders for initial full backup", { discoveredFiles: 0, scannedFolders: 0 });
      checkBackupCancelled();
      sourceFiles = await listStorageFiles(SOURCE_BUCKET);
      trackedFilePaths = sourceFiles.map(file => file.path);
    } else {
      setBackupProgress(43, "Checking applicant document references for changes");
      trackedFilePaths = getReferencedDocumentPaths(applicationFileRows);
      const previousPaths = new Set(previousState.trackedFilePaths);
      const changedPaths = trackedFilePaths.filter(path => !previousPaths.has(path));
      sourceFiles = changedPaths.map(path => ({ path, name: path.split("/").pop(), metadata: {} }));
      setBackupProgress(47, "Preparing incremental file backup (" + sourceFiles.length + " new files)", {
        discoveredFiles: sourceFiles.length,
        scannedFolders: 0,
        totalTrackedFiles: trackedFilePaths.length,
      });
    }
    checkBackupCancelled();
    const fileManifest = [];
    let fileBytes = 0;
    setBackupProgress(47, sourceFiles.length
      ? "Collecting uploaded applicant files (0 of " + sourceFiles.length + ")"
      : "No new uploaded applicant files to collect", { completedFiles: 0, totalFiles: sourceFiles.length });

    let nextFileIndex = 0;
    let completedFiles = 0;
    let stopDownloads = false;
    const downloadWorker = async () => {
      while (!stopDownloads) {
        checkBackupCancelled();
        const fileIndex = nextFileIndex++;
        if (fileIndex >= sourceFiles.length) return;
        const file = sourceFiles[fileIndex];
        try {
          const { data, error } = await supabase.storage.from(SOURCE_BUCKET).download(file.path);
          checkBackupCancelled();
          if (error || !data) throw new Error("Unable to download uploaded file " + file.path + ": " + (error?.message || "No file data returned."));
          const bytes = Buffer.from(await data.arrayBuffer());
          checkBackupCancelled();
          zip.addFile("storage/" + SOURCE_BUCKET + "/" + file.path, bytes);
          fileBytes += bytes.length;
          fileManifest[fileIndex] = {
            bucket: SOURCE_BUCKET,
            path: file.path,
            size: bytes.length,
            contentType: file.metadata?.mimetype || file.metadata?.contentType || "application/octet-stream",
          };
          completedFiles += 1;
          const percent = 47 + (completedFiles / Math.max(sourceFiles.length, 1)) * 23;
          setBackupProgress(percent, "Collecting uploaded applicant files (" + completedFiles + " of " + sourceFiles.length + ")", {
            completedFiles, totalFiles: sourceFiles.length, fileBytes
          });
        } catch (error) {
          stopDownloads = true;
          throw error;
        }
      }
    };
    const workerResults = await Promise.allSettled(
      Array.from({ length: Math.min(4, sourceFiles.length) }, () => downloadWorker())
    );
    const workerFailure = workerResults.find(result => result.status === "rejected");
    if (workerFailure) throw workerFailure.reason;
    checkBackupCancelled();

    const manifest = {
      version: BACKUP_VERSION,
      backupId,
      createdAt,
      createdBy: req.user?.username || req.user?.email || "Administrator",
      backupType,
      parentBackupId,
      baseBackupId,
      database: { tables: tableCounts, totalRows },
      storage: {
        bucket: SOURCE_BUCKET,
        fileCount: trackedFilePaths.length,
        includedFileCount: fileManifest.length,
        totalBytes: fileBytes,
        files: fileManifest,
      },
    };
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

    setBackupProgress(73, "Compressing and encrypting backup archive");
    const archiveBuffer = zip.toBuffer();
    setBackupProgress(77, "Encrypting backup archive");
    const encrypted = encryptArchive(archiveBuffer);

    // Keep each Storage object comfortably below the configured 4 MB bucket limit.
    const ARCHIVE_PART_SIZE = 3 * 1024 * 1024;
    const storage = supabase.storage.from(BACKUP_BUCKET);
    const totalParts = Math.ceil(encrypted.length / ARCHIVE_PART_SIZE);
    setBackupProgress(82, "Uploading encrypted archive (0 of " + totalParts + " parts)", { totalParts, completedParts: 0 });

    for (let offset = 0, partNumber = 1; offset < encrypted.length; offset += ARCHIVE_PART_SIZE, partNumber++) {
      checkBackupCancelled();
      const partPath = backupId + ".part-" + String(partNumber).padStart(4, "0");
      const part = encrypted.subarray(offset, Math.min(offset + ARCHIVE_PART_SIZE, encrypted.length));
      const { error: partError } = await storage.upload(partPath, part, {
        contentType: "application/octet-stream",
        upsert: false,
      });
      if (partError) {
        if (archiveParts.length) await storage.remove(archiveParts);
        throw new Error("Unable to upload backup archive part " + partNumber + ": " + partError.message);
      }
      archiveParts.push(partPath);
      checkBackupCancelled();
      const percent = 82 + (partNumber / totalParts) * 15;
      setBackupProgress(percent, "Uploading encrypted archive (" + partNumber + " of " + totalParts + " parts)", {
        completedParts: partNumber, totalParts
      });
    }

    checkBackupCancelled();
    setBackupProgress(98, "Saving backup manifest and finalizing");
    const metadata = {
      version: BACKUP_VERSION,
      backupId,
      createdAt,
      createdBy: manifest.createdBy,
      backupType,
      parentBackupId,
      baseBackupId,
      archiveParts,
      archiveBytes: encrypted.length,
      totalRows,
      tableCounts,
      fileCount: fileManifest.length,
      totalTrackedFileCount: trackedFilePaths.length,
      fileBytes,
      status: "Verified",
    };
    const { error: metadataError } = await storage.upload(
      backupId + ".json",
      Buffer.from(JSON.stringify(metadata), "utf8"),
      { contentType: "application/json", upsert: false }
    );
    if (metadataError) {
      await storage.remove(archiveParts);
      throw metadataError;
    }

    const nextState = {
      version: 1,
      latestBackupId: backupId,
      latestFullCreatedAt: backupType === "full"
        ? createdAt
        : previousState.latestFullCreatedAt,
      baseBackupId,
      trackedFilePaths,
      updatedAt: createdAt,
    };
    const { error: stateError } = await storage.upload(
      BACKUP_STATE_PATH,
      Buffer.from(JSON.stringify(nextState), "utf8"),
      { contentType: "application/json", upsert: true }
    );
    if (stateError) {
      // The archive itself is valid. If the index cannot be updated, the next
      // run will safely fall back to a full backup rather than miss changes.
      console.error("[Backups] Could not update incremental backup index:", stateError.message);
    }

    setBackupProgress(100, "Backup completed successfully", {
      active: false, status: "completed", backupId, totalRows, fileCount: fileManifest.length
    });

    await createAuditLogFromRequest(req, {
      action: "SYSTEM_BACKUP_CREATED",
      entityType: "SYSTEM_BACKUP",
      entityId: backupId,
      details: "Encrypted " + backupType + " backup created with " + totalRows + " database rows and " + fileManifest.length + " newly included files.",
    });

    return {
      success: true,
      message: "Encrypted " + backupType + " system backup created and verified.",
      backup: metadata,
    };
  } catch (error) {
    console.error("Create system backup error:", error);
    if (archiveParts.length) {
      const { error: cleanupError } = await supabase.storage.from(BACKUP_BUCKET).remove(archiveParts);
      if (cleanupError) console.error("Unable to remove cancelled/partial backup parts:", cleanupError.message);
    }
    const cancelled = error.code === "BACKUP_CANCELLED";
    setBackupProgress(currentBackupProgress.percent, cancelled ? "Backup cancelled. Temporary files were cleaned up." : "Backup failed: " + (error.message || "Unknown error"), {
      active: false, status: cancelled ? "cancelled" : "failed", error: error.message || "Unable to create system backup."
    });
    backupCancelRequested = false;
    return { success: false, cancelled, message: error.message || "Unable to create system backup." };
  }
}

async function listSystemBackups(req, res) {
  try {
    // Listing an empty backup history must not require encryption setup or
    // attempt to create a bucket as a side effect. The private bucket is
    // created when the first backup is requested.
    const { data, error } = await supabase.storage.from(BACKUP_BUCKET).list("", {
      limit: 1000,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      // A missing bucket means that no backup has been created yet.
      // Return an empty history instead of failing the whole admin page.
      if (/bucket not found|not found/i.test(error.message || "")) {
        return res.json({ success: true, backups: [] });
      }
      throw error;
    }

    const metadataFiles = (data || []).filter(item =>
      item && typeof item.name === "string" && item.name.endsWith(".json")
    );
    const backups = [];

    for (const item of metadataFiles) {
      const { data: file, error: downloadError } =
        await supabase.storage.from(BACKUP_BUCKET).download(item.name);

      if (downloadError || !file) {
        console.warn("[Backups] Skipping unreadable backup metadata:", item.name, downloadError?.message);
        continue;
      }

      try {
        const metadata = JSON.parse(await file.text());
        // Only list metadata entries that point to a plausible archive.
        if (
          metadata &&
          typeof metadata.backupId === "string" &&
          typeof metadata.createdAt === "string" &&
          (
            typeof metadata.archivePath === "string" ||
            (Array.isArray(metadata.archiveParts) && metadata.archiveParts.length > 0)
          )
        ) {
          backups.push(metadata);
        }
      } catch (parseError) {
        console.warn("[Backups] Skipping invalid metadata file:", item.name, parseError.message);
      }
    }

    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, backups });
  } catch (error) {
    console.error("List system backups error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load backup history from Supabase Storage.",
      error: error.message || "Unknown storage error.",
    });
  }
}

async function restoreSystemBackup(req, res) {
  if (currentBackupProgress.active) {
    return res.status(409).json({ success: false, message: "A backup operation is currently running. Wait for it to finish before starting recovery." });
  }
  if (currentRestoreProgress.active) {
    return res.status(409).json({ success: false, message: "A recovery operation is already running.", progress: currentRestoreProgress });
  }
  encryptionKey();
  const backupId = String(req.params.backupId || "");
  if (!/^backup-[0-9T-]+Z$/.test(backupId)) {
    return res.status(400).json({ success: false, message: "Invalid backup identifier." });
  }
  restoreCancelRequested = false;
  setRestoreProgress(1, "Starting non-destructive recovery", { active: true, status: "running", error: null, summary: null, backupId });
  setImmediate(() => {
    runSystemRestoreJob(req, backupId).catch(error => {
      console.error("Restore system backup error:", error);
      if (error.code !== "RESTORE_CANCELLED") {
        setRestoreProgress(currentRestoreProgress.percent, "Recovery failed: " + (error.message || "Unknown error"), {
          active: false, status: "failed", error: error.message || "Unable to restore this backup."
        });
      }
    });
  });
  return res.status(202).json({ success: true, accepted: true, message: "Recovery started. Follow the progress indicator until it completes." });
}

async function rollbackRestoreChanges(insertedRowsByTable, restoredStoragePaths) {
  const rollbackFailures = [];
  let rowsRemoved = 0;
  let filesRemoved = 0;

  // Remove child records first, then parent records, so foreign-key dependencies remain safe.
  for (const table of TABLES.slice().reverse()) {
    const keys = insertedRowsByTable[table.name] || [];
    if (!keys.length) continue;
    for (let offset = 0; offset < keys.length; offset += 100) {
      const batch = keys.slice(offset, offset + 100);
      const { data, error } = await supabase
        .from(table.name)
        .delete()
        .in(table.conflict, batch)
        .select(table.conflict);
      if (error) {
        rollbackFailures.push({ item: table.name, reason: error.message });
      } else {
        rowsRemoved += (data || []).length;
      }
    }
  }

  for (let offset = 0; offset < restoredStoragePaths.length; offset += 100) {
    const batch = restoredStoragePaths.slice(offset, offset + 100);
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).remove(batch);
    if (error) {
      rollbackFailures.push({ item: SOURCE_BUCKET, reason: error.message });
    } else {
      filesRemoved += (data || []).length;
    }
  }

  return { rowsRemoved, filesRemoved, failures: rollbackFailures };
}

async function runSystemRestoreJob(req, backupId) {
  const insertedRowsByTable = Object.fromEntries(TABLES.map(table => [table.name, []]));
  const restoredStoragePaths = [];
  try {
    encryptionKey();
    setRestoreProgress(4, "Checking backup archive and recovery chain");
    await ensureBucket(BACKUP_BUCKET, false);

    const storage = supabase.storage.from(BACKUP_BUCKET);
    const { data: metadataBlob, error: metadataError } = await storage.download(backupId + ".json");
    if (metadataError || !metadataBlob) {
      throw new Error("Backup metadata was not found.");
    }

    const metadata = JSON.parse(await metadataBlob.text());
    setRestoreProgress(10, "Decrypting backup and validating recovery chain");
    const { zip, manifest } = await downloadAndOpenBackupArchive(storage, backupId, metadata);
    checkRestoreCancelled();
    const recoveryChain = [{ metadata, zip, manifest }];
    let chainMetadata = metadata;
    const seenBackupIds = new Set([backupId]);

    while (chainMetadata.backupType === "incremental" && chainMetadata.parentBackupId) {
      setRestoreProgress(Math.min(18, 10 + recoveryChain.length * 2), "Loading previous backup in recovery chain");
      const parentId = chainMetadata.parentBackupId;
      if (seenBackupIds.has(parentId)) throw new Error("The backup recovery chain contains a circular reference.");
      seenBackupIds.add(parentId);
      const parentMetadata = await loadBackupMetadata(storage, parentId);
      const parentArchive = await downloadAndOpenBackupArchive(storage, parentId, parentMetadata);
      checkRestoreCancelled();
      recoveryChain.push({ metadata: parentMetadata, ...parentArchive });
      chainMetadata = parentMetadata;
    }

    if (chainMetadata.backupType === "incremental") {
      throw new Error("The full backup required by this incremental recovery chain is missing.");
    }

    const restored = {};
    const skipped = {};
    const failed = [];
    const tableData = manifest.database?.tables || {};

    let tablesCompleted = 0;
    setRestoreProgress(20, "Restoring missing database records");
    for (const table of TABLES) {
      checkRestoreCancelled();
      const entry = zip.getEntry("database/" + table.name + ".json");
      if (!entry) {
        failed.push({ item: table.name, reason: "Table data is missing from the archive." });
        continue;
      }
      const rows = JSON.parse(entry.getData().toString("utf8"));
      let inserted = 0;
      let ignored = 0;
      for (let offset = 0; offset < rows.length; offset += 100) {
        checkRestoreCancelled();
        const batch = rows.slice(offset, offset + 100);
        if (!batch.length) continue;
        const { data, error } = await supabase.from(table.name).upsert(batch, {
          onConflict: table.conflict,
          ignoreDuplicates: true,
        }).select(table.conflict);
        if (error) {
          failed.push({ item: table.name, reason: error.message });
          break;
        }
        const insertedBatch = data || [];
        inserted += insertedBatch.length;
        ignored += batch.length - insertedBatch.length;
        insertedRowsByTable[table.name].push(...insertedBatch.map(row => row[table.conflict]).filter(value => value !== undefined && value !== null));
      }
      restored[table.name] = inserted;
      skipped[table.name] = ignored;
      tablesCompleted++;
      setRestoreProgress(20 + Math.round((tablesCompleted / TABLES.length) * 35), "Restoring database table: " + table.name, { completedTables: tablesCompleted, totalTables: TABLES.length, restoredRows: Object.values(restored).reduce((sum, value) => sum + value, 0), skippedRows: Object.values(skipped).reduce((sum, value) => sum + value, 0) });
    }

    let filesRestored = 0;
    let filesSkipped = 0;
    const filesToRestore = new Map();
    for (const archive of recoveryChain.slice().reverse()) {
      for (const file of archive.manifest.storage?.files || []) {
        if (file?.path) filesToRestore.set(file.path, { file, zip: archive.zip });
      }
    }
    const filesToProcess = Array.from(filesToRestore.values());
    let filesProcessed = 0;
    setRestoreProgress(57, "Checking uploaded applicant files");
    for (const { file, zip: fileZip } of filesToProcess) {
      checkRestoreCancelled();
      if (file.bucket !== SOURCE_BUCKET || !file.path || file.path.startsWith("/") || file.path.split("/").includes("..")) {
        failed.push({ item: file.path || "unknown file", reason: "Unsafe or unsupported file path." });
        filesProcessed++;
        setRestoreProgress(57 + Math.round((filesProcessed / Math.max(filesToProcess.length, 1)) * 38), "Checking uploaded files", { completedFiles: filesProcessed, totalFiles: filesToProcess.length, filesRestored, filesSkipped });
        continue;
      }
      const archiveEntry = fileZip.getEntry("storage/" + SOURCE_BUCKET + "/" + file.path);
      if (!archiveEntry) {
        failed.push({ item: file.path, reason: "Uploaded file is missing from the archive." });
        filesProcessed++;
        setRestoreProgress(57 + Math.round((filesProcessed / Math.max(filesToProcess.length, 1)) * 38), "Checking uploaded files", { completedFiles: filesProcessed, totalFiles: filesToProcess.length, filesRestored, filesSkipped });
        continue;
      }

      const segments = file.path.split("/");
      const filename = segments.pop();
      const folder = segments.join("/");
      const { data: existing, error: listError } = await supabase.storage.from(SOURCE_BUCKET).list(folder, {
        limit: 1000,
        search: filename,
      });
      if (listError) {
        failed.push({ item: file.path, reason: listError.message });
        filesProcessed++;
        setRestoreProgress(57 + Math.round((filesProcessed / Math.max(filesToProcess.length, 1)) * 38), "Checking uploaded files", { completedFiles: filesProcessed, totalFiles: filesToProcess.length, filesRestored, filesSkipped });
        continue;
      }
      if ((existing || []).some(item => item.name === filename && item.id !== null)) {
        filesSkipped++;
        filesProcessed++;
        setRestoreProgress(57 + Math.round((filesProcessed / Math.max(filesToProcess.length, 1)) * 38), "Checking uploaded files", { completedFiles: filesProcessed, totalFiles: filesToProcess.length, filesRestored, filesSkipped });
        continue;
      }

      const { error: uploadError } = await supabase.storage.from(SOURCE_BUCKET).upload(
        file.path,
        archiveEntry.getData(),
        { contentType: file.contentType || "application/octet-stream", upsert: false }
      );
      if (uploadError) {
        if (/already exists|duplicate/i.test(uploadError.message || "")) filesSkipped++;
        else failed.push({ item: file.path, reason: uploadError.message });
      } else {
        filesRestored++;
        restoredStoragePaths.push(file.path);
      }
      filesProcessed++;
      setRestoreProgress(57 + Math.round((filesProcessed / Math.max(filesToProcess.length, 1)) * 38), "Restoring missing uploaded files", { completedFiles: filesProcessed, totalFiles: filesToProcess.length, filesRestored, filesSkipped });
    }

    const summary = {
      backupId,
      tables: restored,
      skippedExistingRows: skipped,
      filesRestored,
      filesSkipped,
      failures: failed,
    };

    checkRestoreCancelled();
    setRestoreProgress(97, "Recording recovery activity");
    await createAuditLogFromRequest(req, {
      action: "SYSTEM_BACKUP_RESTORED",
      entityType: "SYSTEM_BACKUP",
      entityId: backupId,
      details: "Non-destructive recovery completed. Restored " + Object.values(restored).reduce((a, b) => a + b, 0) + " rows and " + filesRestored + " files; " + failed.length + " issues.",
    });

    const result = {
      success: failed.length === 0,
      message: failed.length ? "Recovery finished with some items that need attention. Existing records and files were not overwritten." : "Recovery completed. Missing records and files were restored; existing records and files were preserved.",
      summary,
    };
    setRestoreProgress(100, failed.length ? "Recovery finished with issues" : "Recovery completed successfully", { active: false, status: failed.length ? "completed_with_issues" : "completed", summary });
    return result;
  } catch (error) {
    if (error.code === "RESTORE_CANCELLED") {
      setRestoreProgress(currentRestoreProgress.percent, "Recovery cancelled. Rolling back records and files restored by this attempt…", {
        active: true, status: "cancelling",
        stage: "Rolling back changes from this recovery attempt",
        rollback: { active: true }
      });
      const rollback = await rollbackRestoreChanges(insertedRowsByTable, restoredStoragePaths);
      const rollbackComplete = rollback.failures.length === 0;
      const rollbackMessage = rollbackComplete
        ? "Recovery cancelled. All changes made by this recovery attempt were rolled back."
        : "Recovery was cancelled, but some rollback operations failed. Check the recovery details and backend logs.";
      setRestoreProgress(currentRestoreProgress.percent, rollbackMessage, {
        active: false,
        status: rollbackComplete ? "cancelled" : "failed",
        error: rollbackComplete ? null : rollbackMessage,
        rollback: { active: false, rowsRemoved: rollback.rowsRemoved, filesRemoved: rollback.filesRemoved, failures: rollback.failures }
      });
      return;
    }
    console.error("Restore system backup error:", error);
    setRestoreProgress(currentRestoreProgress.percent, "Recovery failed: " + (error.message || "Unknown error"), {
      active: false, status: "failed", error: error.message || "Unable to restore this backup."
    });
    throw error;
  }
}


module.exports = {
  createSystemBackup,
  getSystemBackupProgress,
  getSystemRestoreProgress,
  cancelSystemRestore,
  cancelSystemBackup,
  listSystemBackups,
  restoreSystemBackup,
};
