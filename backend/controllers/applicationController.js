const supabase = require("../config/supabase");
const { createAuditLogFromRequest } = require("./auditLogController");

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} = require("docx");

const normalizeStorageObjectPath = (value) => {
  let path = String(value || "").trim();
  if (!path) return null;

  // Database rows may contain either a bucket-relative object path or a
  // Supabase public/signed URL. Convert both to the documents bucket path.
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const marker = "/storage/v1/object/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex < 0) return null;
    const objectPart = path.slice(markerIndex + marker.length);
    const bucketMarker = "documents/";
    const bucketIndex = objectPart.indexOf(bucketMarker);
    if (bucketIndex < 0) return null;
    path = objectPart.slice(bucketIndex + bucketMarker.length);
  }

  path = path.split("?")[0];
  while (path.startsWith("/")) path = path.slice(1);
  if (path.toLowerCase().startsWith("documents/")) path = path.slice("documents/".length);
  try { path = decodeURIComponent(path); } catch (_) { /* retain a valid stored path */ }
  return path || null;
};

const getStorageFileBuffer = async (filePath) => {
  const objectPath = normalizeStorageObjectPath(filePath);
  if (!objectPath) return null;

  const {
    data,
    error,
  } = await supabase.storage
    .from("documents")
    .download(objectPath);

  if (error || !data) {
    console.error(
      "Unable to download Storage file:",
      objectPath,
      error
    );

    return null;
  }

  const arrayBuffer =
    await data.arrayBuffer();

  return Buffer.from(arrayBuffer);
};

const getDocxImageType = (filePath) => {
  const extension =
    String(filePath || "")
      .split(".")
      .pop()
      .toLowerCase();

  switch (extension) {
    case "png":
      return "png";

    case "gif":
      return "gif";

    case "bmp":
      return "bmp";

    case "jpg":
    case "jpeg":
      return "jpg";

    default:
      return "jpg";
  }
};

const createSignedFileUrl = async (filePath) => {
  const objectPath = normalizeStorageObjectPath(filePath);
  if (!objectPath) return null;

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(objectPath, 60 * 30);

  if (error) {
    console.error("Unable to create signed URL:", filePath, error);

    return null;
  }

  return data?.signedUrl || null;
};

// ============================================================
// DOWNLOAD DIGITAL ISSUANCE FORM AS REAL DOCX
// ============================================================

const downloadIssuanceDocument = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    const {
      name,
      address,
      dob,
      sex,
      dateIssued,
      controlNo,
    } = req.body || {};

    // --------------------------------------------------------
    // GET APPLICATION + FILES
    // --------------------------------------------------------

    const [
      applicationResult,
      filesResult,
    ] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("application_files")
        .select("latest_photo_url, signature_url")
        .eq("application_id", applicationId)
        .maybeSingle(),
    ]);

    if (applicationResult.error) {
      throw applicationResult.error;
    }

    if (filesResult.error) {
      throw filesResult.error;
    }

    const application = applicationResult.data;
    const files = filesResult.data;

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    // --------------------------------------------------------
    // FINAL FORM VALUES
    // --------------------------------------------------------

    const finalName =
      name ||
      [
        application.first_name,
        application.middle_name,
        application.surname,
      ]
        .filter(Boolean)
        .join(" ") ||
      "________________";

    const finalAddress =
      address ||
      application.house_street ||
      "________________";

    const finalDob =
      dob ||
      application.date_of_birth ||
      "________________";

    const finalSex =
      sex ||
      application.sex ||
      "________________";

    const finalDateIssued =
      dateIssued ||
      new Date().toISOString().split("T")[0];

    const finalControlNo =
      controlNo ||
      "________________";

    // DOWNLOAD ORIGINAL IMAGES FROM SUPABASE STORAGE

    const [
      photoBuffer,
      signatureBuffer,
    ] = await Promise.all([
      getStorageFileBuffer(
        files?.latest_photo_url
      ),
      getStorageFileBuffer(
        files?.signature_url
      ),
    ]);

    // PHOTO

    const photoChildren = [];

    if (photoBuffer) {
      photoChildren.push(
        new ImageRun({
          data: photoBuffer,

          transformation: {
            width: 100,
            height: 100,
          },

          type: getDocxImageType(
            files?.latest_photo_url
          ),
        })
      );
    } else {
      photoChildren.push(
        new TextRun({
          text: "No photo available",
          italics: true,
          size: 20,
        })
      );
    }

    // SIGNATURE

    const signatureChildren = [];

    if (signatureBuffer) {
      signatureChildren.push(
        new ImageRun({
          data: signatureBuffer,

          transformation: {
            width: 120,
            height: 56,
          },

          type: getDocxImageType(
            files?.signature_url
          ),
        })
      );
    } else {
      signatureChildren.push(
        new TextRun({
          text: "No signature image",
          italics: true,
          size: 20,
        })
      );
    }

    // FIELD ROW HELPER

    const fieldRow = (label, value) => {
      return new TableRow({
        children: [

          new TableCell({
            width: {
              size: 1800,
              type: WidthType.DXA,
            },

            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
            ],
          }),

          new TableCell({
            width: {
              size: 5000,
              type: WidthType.DXA,
            },

            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: String(
                      value || ""
                    ),
                    size: 20,
                  }),
                ],
              }),
            ],
          }),

        ],
      });
    };

    // APPLICANT INFORMATION TABLE

    const fieldTable = new Table({

      width: {
        size: 5200,
        type: WidthType.DXA,
      },

      alignment:
        AlignmentType.CENTER,

      rows: [

        fieldRow(
          "NAME:",
          finalName
        ),

        fieldRow(
          "ADDRESS:",
          finalAddress
        ),

        fieldRow(
          "DATE OF BIRTH:",
          finalDob
        ),

        fieldRow(
          "SEX:",
          finalSex
        ),

        fieldRow(
          "DATE ISSUED:",
          finalDateIssued
        ),

        fieldRow(
          "CONTROL NO.:",
          finalControlNo
        ),

      ],
    });

    // SIGNATURE TABLE

    const signatureTable =
      new Table({

        width: {
          size: 2200,
          type: WidthType.DXA,
        },

        alignment:
          AlignmentType.CENTER,

        rows: [

          new TableRow({

            children: [

              new TableCell({

                borders: {

                  top: {
                    style:
                      BorderStyle.SINGLE,
                    size: 6,
                    color: "222222",
                  },

                  bottom: {
                    style:
                      BorderStyle.SINGLE,
                    size: 6,
                    color: "222222",
                  },

                  left: {
                    style:
                      BorderStyle.SINGLE,
                    size: 6,
                    color: "222222",
                  },

                  right: {
                    style:
                      BorderStyle.SINGLE,
                    size: 6,
                    color: "222222",
                  },

                },

                children: [

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children:
                      signatureChildren,

                  }),

                ],

              }),

            ],

          }),

        ],

      });

    // OUTER FORM BOX
    const outerFormTable =
      new Table({

        alignment:
          AlignmentType.CENTER,

        width: {
          size: 6000,
          type: WidthType.DXA,
        },

        borders: {

          top: {
            style:
              BorderStyle.SINGLE,
            size: 8,
            color: "222222",
          },

          bottom: {
            style:
              BorderStyle.SINGLE,
            size: 8,
            color: "222222",
          },

          left: {
            style:
              BorderStyle.SINGLE,
            size: 8,
            color: "222222",
          },

          right: {
            style:
              BorderStyle.SINGLE,
            size: 8,
            color: "222222",
          },

          insideHorizontal: {
            style:
              BorderStyle.NONE,
            size: 0,
            color: "FFFFFF",
          },

          insideVertical: {
            style:
              BorderStyle.NONE,
            size: 0,
            color: "FFFFFF",
          },

        },

        rows: [

          new TableRow({

            children: [

              new TableCell({

                margins: {

                  top: 180,
                  bottom: 180,
                  left: 180,
                  right: 180,

                },

                borders: {

                  top: {
                    style:
                      BorderStyle.NONE,
                    size: 0,
                  },

                  bottom: {
                    style:
                      BorderStyle.NONE,
                    size: 0,
                  },

                  left: {
                    style:
                      BorderStyle.NONE,
                    size: 0,
                  },

                  right: {
                    style:
                      BorderStyle.NONE,
                    size: 0,
                  },

                },

                children: [

                  // HEADER 1

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children: [

                      new TextRun({

                        text:
                          "REPUBLIC OF THE PHILIPPINES",

                        bold: true,

                        size: 22,

                      }),

                    ],

                    spacing: {
                      after: 40,
                    },

                  }),


                  // HEADER 2

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children: [

                      new TextRun({

                        text:
                          "OFFICE OF THE SENIOR CITIZEN AFFAIRS - OSCA",

                        bold: true,

                        size: 22,

                      }),

                    ],

                    spacing: {
                      after: 40,
                    },

                  }),


                  // HEADER 3

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children: [

                      new TextRun({

                        text:
                          "MUNICIPALITY OF BAUAN",

                        bold: true,

                        size: 22,

                      }),

                    ],

                    spacing: {
                      after: 180,
                    },

                  }),


                  // APPLICANT PHOTO

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children:
                      photoChildren,

                    spacing: {
                      after: 180,
                    },

                  }),


                  // APPLICANT INFORMATION

                  fieldTable,


                  // SPACE BEFORE SIGNATURE

                  new Paragraph({

                    children: [

                      new TextRun({
                        text: " ",
                      }),

                    ],

                    spacing: {
                      after: 120,
                    },

                  }),


                  // SIGNATURE IMAGE

                  signatureTable,


                  // SIGNATURE LABEL

                  new Paragraph({

                    alignment:
                      AlignmentType.CENTER,

                    children: [

                      new TextRun({

                        text:
                          "Signature",

                        size: 18,

                      }),

                    ],

                    spacing: {

                      before: 40,

                      after: 0,

                    },

                  }),

                ],

              }),

            ],

          }),

        ],

      });


    // CREATE DOCUMENT

    const doc =
      new Document({

        sections: [

          {

            properties: {

              page: {

                margin: {

                  top: 720,
                  right: 720,
                  bottom: 720,
                  left: 720,

                },

              },

            },

            children: [

              // ===================================================
              // THE ENTIRE FORM IS NOW ONE OUTER BOX
              // ===================================================

              outerFormTable,

            ],

          },

        ],

      });

    // GENERATE DOCX

    const buffer =
      await Packer.toBuffer(doc);

    const safeId =
      String(applicationId)
        .replace(
          /[^a-zA-Z0-9-_]/g,
          "_"
        );

    const filename =
      `Digital_Issuance_${safeId}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.setHeader(
      "Content-Length",
      buffer.length
    );

    return res.end(buffer);

  } catch (error) {

    console.error(
      "Error generating issuance DOCX:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to generate issuance Word document.",

      error:
        error.message,

    });

  }
};

// ============================================================
// FETCH ALL ROWS FROM SUPABASE IN BATCHES
// Prevents the default 1,000-row response limit.
// ============================================================

const SUPABASE_PAGE_SIZE = 1000;

const fetchAllRows = async (
  tableName,
  selectColumns = "*",
  orderColumn = null
) => {
  const allRows = [];

  let from = 0;

  while (true) {
    let query = supabase
      .from(tableName)
      .select(selectColumns);

    if (orderColumn) {
      query = query.order(orderColumn, {
        ascending: false,
      });
    }

    const {
      data,
      error,
    } = await query.range(
      from,
      from + SUPABASE_PAGE_SIZE - 1
    );

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
    }

    if (
      !data ||
      data.length < SUPABASE_PAGE_SIZE
    ) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return allRows;
};

// ============================================================
// SPLIT ARRAY INTO SMALLER BATCHES
// ============================================================

const chunkArray = (
  array,
  size = 500
) => {
  const chunks = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    chunks.push(
      array.slice(i, i + size)
    );
  }

  return chunks;
};

const getApplications = async (req, res) => {
  try {

    // ============================================================
    // 1. GET ALL APPLICATIONS
    // ============================================================

    const applications =
      await fetchAllRows(
        "applications",
        "*",
        "created_at"
      );

    if (
      !applications ||
      applications.length === 0
    ) {
      return res.status(200).json({
        success: true,
        applications: [],
      });
    }


    // ============================================================
    // 2. GET APPLICATION IDS
    // ============================================================

    const applicationIds =
      applications.map(
        (application) =>
          application.application_id
      );


    // ============================================================
    // 3. SPLIT IDS INTO SMALL BATCHES
    // ============================================================

    const applicationIdChunks =
      chunkArray(
        applicationIds,
        500
      );


    // ============================================================
    // 4. LOAD APPLICATION FILES IN PARALLEL
    //
    // Previously these queries ran one after another.
    // Promise.all() allows Supabase to process the batches
    // at the same time.
    // ============================================================

    const fileResults =
      await Promise.all(
        applicationIdChunks.map(
          async (idChunk) => {

            const {
              data,
              error,
            } = await supabase
              .from("application_files")
              .select(`
                application_id,
                valid_id_url,
                valid_id_back_url,
                latest_photo_url,
                birth_certificate_url,
                community_tax_certificate_url,
                signature_url,
                authentication_status,
                authentication_method,
                authenticated_by,
                authenticated_at,
                authentication_remarks,
                supporting_document_type
              `)
              .in(
                "application_id",
                idChunk
              );

            if (error) {
              throw error;
            }

            return data || [];
          }
        )
      );


    // Flatten all file batches into one array.
    const files =
      fileResults.flat();


    // ============================================================
    // 5. LOAD STATUS HISTORY IN PARALLEL
    //
    // Same optimization as application_files.
    // ============================================================

    const statusResults =
      await Promise.all(
        applicationIdChunks.map(
          async (idChunk) => {

            const {
              data,
              error,
            } = await supabase
              .from(
                "application_status_history"
              )
              .select("*")
              .in(
                "application_id",
                idChunk
              )
              .order(
                "updated_at",
                {
                  ascending: false,
                }
              );

            if (error) {
              throw error;
            }

            return data || [];
          }
        )
      );


    // Flatten all status-history batches.
    const statusHistory =
      statusResults.flat();


    // ============================================================
    // 5B. LOAD DOCUMENT AUTHENTICATIONS IN PARALLEL
    // This lets the ID Issuance selector verify that every required
    // document has an approved authentication record.
    // ============================================================

    const documentAuthenticationResults =
      await Promise.all(
        applicationIdChunks.map(
          async (idChunk) => {
            const { data, error } = await supabase
              .from("document_authentications")
              .select("application_id, document_type, authentication_status")
              .in("application_id", idChunk);

            if (error) throw error;
            return data || [];
          }
        )
      );

    const documentAuthentications =
      documentAuthenticationResults.flat();


    // ============================================================
    // 6. BUILD FAST LOOKUP MAPS
    //
    // This avoids repeatedly using .find() for every applicant.
    //
    // Before:
    // 4,000+ applicants × search through status history
    //
    // Now:
    // Build the lookup once, then retrieve by application_id.
    // ============================================================

    const latestStatusByApplication =
      new Map();


    for (
      const history of statusHistory
    ) {

      if (
        !history ||
        !history.application_id
      ) {
        continue;
      }


      const existing =
        latestStatusByApplication.get(
          history.application_id
        );


      // Keep the newest status record.
      if (
        !existing ||
        new Date(
          history.updated_at || 0
        ) >
        new Date(
          existing.updated_at || 0
        )
      ) {
        latestStatusByApplication.set(
          history.application_id,
          history
        );
      }
    }


    // ============================================================
    // 7. BUILD FILE LOOKUP MAP
    //
    // This also avoids calling .find() for every applicant.
    // ============================================================

    const filesByApplication =
      new Map();


    for (
      const file of files
    ) {

      if (
        file &&
        file.application_id
      ) {
        filesByApplication.set(
          file.application_id,
          file
        );
      }
    }


    const documentAuthenticationsByApplication =
      new Map();

    for (const record of documentAuthentications) {
      if (!record || !record.application_id) continue;
      const records = documentAuthenticationsByApplication.get(record.application_id) || [];
      records.push(record);
      documentAuthenticationsByApplication.set(record.application_id, records);
    }


    // ============================================================
    // 8. COMBINE APPLICATION + FILE + STATUS DATA
    //
    // IMPORTANT:
    // Do NOT create signed Storage URLs here.
    //
    // This endpoint is used by the dashboard/list.
    // Signed URLs are generated only when opening
    // one application's detail page.
    // ============================================================

    const applicationsWithFiles =
      applications.map(
        (application) => {

          const applicationId =
            application.application_id;


          // Fast status lookup.
          const latestStatus =
            latestStatusByApplication.get(
              applicationId
            );


          const currentStatus =
            latestStatus?.status ||
            application.status ||
            "Pending";


          const statusUpdatedAt =
            latestStatus?.updated_at ||
            application.updated_at ||
            application.created_at ||
            null;


          // Fast file lookup.
          const fileRecord =
            filesByApplication.get(
              applicationId
            );

          const applicationDocumentAuthentications =
            documentAuthenticationsByApplication.get(applicationId) || [];


          // ======================================================
          // NO FILE RECORD
          // ======================================================

          if (!fileRecord) {

            return {
              ...application,

              status:
                currentStatus,

              status_updated_at:
                statusUpdatedAt,

              documentAuthentications:
                applicationDocumentAuthentications,

              documents: {
                idFront: null,
                idBack: null,
                photo: null,
                bc: null,
                cedula: null,
                signature: null,
              },

              document_files:
                null,
            };
          }


          // ======================================================
          // FILE RECORD EXISTS
          //
          // Return STORAGE PATHS only.
          // The detail endpoint generates signed URLs.
          // ======================================================

          return {
            ...application,

            status:
              currentStatus,

            status_updated_at:
              statusUpdatedAt,

            documentAuthentications:
              applicationDocumentAuthentications,

            documents: {
              idFront:
                fileRecord.valid_id_url ||
                null,

              idBack:
                fileRecord.valid_id_back_url ||
                null,

              photo:
                fileRecord.latest_photo_url ||
                null,

              bc:
                fileRecord.birth_certificate_url ||
                null,

              cedula:
                fileRecord
                  .community_tax_certificate_url ||
                null,

              signature:
                fileRecord.signature_url ||
                null,
            },

            document_files: {
              ...fileRecord,
            },
          };
        }
      );


    // ============================================================
    // 9. RETURN RESPONSE
    // ============================================================

    return res.status(200).json({
      success: true,
      applications:
        applicationsWithFiles,
    });


  } catch (error) {

    console.error(
      "Error fetching applications:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve applications.",
      error:
        error.message,
    });
  }
};

// GET APPLICATION BY ID
const getApplicationById = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    // GET ALL APPLICATION INFORMATION
    const [
      applicationResult,
      familyResult,
      membershipResult,
      personalBackgroundResult,
      problemsNeedsResult,
      applicationFilesResult,
      confirmationsResult,
      documentAuthenticationsResult,
      statusHistoryResult,
    ] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("family_composition")
        .select("*")
        .eq("application_id", applicationId)
        .order("id", {
          ascending: true,
        }),

      supabase
        .from("memberships")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("personal_background")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("problems_needs")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("application_files")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("confirmations")
        .select("*")
        .eq("application_id", applicationId)
        .maybeSingle(),

      supabase
        .from("document_authentications")
        .select("*")
        .eq("application_id", applicationId)
        .order("id", {
          ascending: true,
        }),

      supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", applicationId)
        .order("updated_at", {
          ascending: false,
        }),
    ]);

    // CHECK ERRORS
    const errors = [
      applicationResult.error,
      familyResult.error,
      membershipResult.error,
      personalBackgroundResult.error,
      problemsNeedsResult.error,
      applicationFilesResult.error,
      confirmationsResult.error,
      documentAuthenticationsResult.error,
      statusHistoryResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    // APPLICATION NOT FOUND
    if (!applicationResult.data) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    // APPLICATION FILES
    const applicationFiles = applicationFilesResult.data || null;

    let filesWithSignedUrls = null;

    if (applicationFiles) {
      const [
        validIdFrontSignedUrl,
        validIdBackSignedUrl,
        latestPhotoSignedUrl,
        birthCertificateSignedUrl,
        communityTaxSignedUrl,
        signatureSignedUrl,
      ] = await Promise.all([
        createSignedFileUrl(applicationFiles.valid_id_url),

        createSignedFileUrl(applicationFiles.valid_id_back_url),

        createSignedFileUrl(applicationFiles.latest_photo_url),

        createSignedFileUrl(applicationFiles.birth_certificate_url),

        createSignedFileUrl(applicationFiles.community_tax_certificate_url),

        createSignedFileUrl(applicationFiles.signature_url),
      ]);

      filesWithSignedUrls = {
        ...applicationFiles,

        valid_id_signed_url: validIdFrontSignedUrl,

        valid_id_back_signed_url: validIdBackSignedUrl,

        latest_photo_signed_url: latestPhotoSignedUrl,

        birth_certificate_signed_url: birthCertificateSignedUrl,

        community_tax_certificate_signed_url: communityTaxSignedUrl,

        signature_signed_url: signatureSignedUrl,
      };
    }

    // RESPONSE
    res.status(200).json({
      success: true,

      application: applicationResult.data,

      familyComposition: familyResult.data || [],

      membership: membershipResult.data || null,

      personalBackground: personalBackgroundResult.data || null,

      problemsNeeds: problemsNeedsResult.data || null,

      applicationFiles: filesWithSignedUrls,

      confirmations: confirmationsResult.data || null,

      documentAuthentications: documentAuthenticationsResult.data || [],

      statusHistory: statusHistoryResult.data || [],
    });
  } catch (error) {
    console.error("Error fetching application detail:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve application details.",
      error: error.message,
    });
  }
};

// Return only the fields required to prepare an ID issuance form.
// This endpoint is intentionally available to ID Maker without exposing the full applicant record.
const getIssuanceDetails = async (req, res) => {
  try {
    const applicationId = String(req.params.applicationId || '').trim();
    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'Application ID is required.' });
    }

    const [applicationResult, filesResult] = await Promise.all([
      supabase.from('applications')
        .select('application_id, first_name, middle_name, surname, house_street, barangay_district, date_of_birth, sex')
        .eq('application_id', applicationId)
        .maybeSingle(),
      supabase.from('application_files')
        .select('latest_photo_url, signature_url')
        .eq('application_id', applicationId)
        .maybeSingle(),
    ]);
    if (applicationResult.error) throw applicationResult.error;
    if (filesResult.error) throw filesResult.error;
    if (!applicationResult.data) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const files = filesResult.data || {};
    const [photoUrl, signatureUrl] = await Promise.all([
      createSignedFileUrl(files.latest_photo_url),
      createSignedFileUrl(files.signature_url),
    ]);
    return res.status(200).json({
      success: true,
      application: applicationResult.data,
      applicationFiles: {
        latest_photo_signed_url: photoUrl,
        signature_signed_url: signatureUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching issuance details:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve issuance details.' });
  }
};

// SAVE APPLICATION VALIDATION
const saveApplicationValidation = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;

    const { validation_status, validation_notes } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    if (!validation_status) {
      return res.status(400).json({
        success: false,
        message: "Validation status is required.",
      });
    }

    const { data, error } = await supabase
      .from("applications")
      .update({
        validation_status: validation_status,

        validation_updated_at: new Date().toISOString(),

        validation_notes: validation_notes || null,
      })
      .eq("application_id", applicationId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await createAuditLogFromRequest(req, {
      action: "APPLICATION_VALIDATION_UPDATED",
      entityType: "APPLICATION",
      entityId: applicationId,
      details: `Validation status set to "${validation_status}".`,
    });

    res.status(200).json({
      success: true,

      message: "Validation result saved successfully.",

      application: data,
    });
  } catch (error) {
    console.error("Error saving validation:", error);

    res.status(500).json({
      success: false,

      message: "Failed to save validation result.",

      error: error.message,
    });
  }
};

// BULK APPROVE ALL REQUIRED DOCUMENTS
const approveAllDocumentAuthentications = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    if (!applicationId) {
      return res.status(400).json({ success: false, message: "Application ID is required." });
    }

    const requiredDocumentTypes = [
      "valid_id",
      "valid_id_back",
      "latest_photo",
      "birth_certificate",
      "community_tax_certificate",
      "signature",
    ];

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("application_id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("document_authentications")
      .select("id, document_type")
      .eq("application_id", applicationId)
      .in("document_type", requiredDocumentTypes);

    if (existingError) throw existingError;

    const now = new Date().toISOString();
    const existingByType = new Map((existingRows || []).map(row => [row.document_type, row]));

    const updatePromises = requiredDocumentTypes
      .filter(type => existingByType.has(type))
      .map(async type => {
        const existing = existingByType.get(type);
        const { data, error } = await supabase
          .from("document_authentications")
          .update({
            authentication_status: "approved",
            authentication_method: "staff_review",
            authenticated_by: null,
            authenticated_at: now,
            authentication_remarks: "Document approved by staff using Approve All.",
            updated_at: now,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      });

    const missingTypes = requiredDocumentTypes.filter(type => !existingByType.has(type));
    let insertedRows = [];
    if (missingTypes.length) {
      const rowsToInsert = missingTypes.map(document_type => ({
        application_id: applicationId,
        document_type,
        authentication_status: "approved",
        authentication_method: "staff_review",
        authenticated_by: null,
        authenticated_at: now,
        authentication_remarks: "Document approved by staff using Approve All.",
        created_at: now,
        updated_at: now,
      }));
      const { data, error } = await supabase
        .from("document_authentications")
        .insert(rowsToInsert)
        .select();
      if (error) throw error;
      insertedRows = data || [];
    }

    const updatedRows = await Promise.all(updatePromises);
    const savedRecords = [...updatedRows, ...insertedRows];

    if (savedRecords.length !== requiredDocumentTypes.length) {
      throw new Error("Not all six document approvals were returned by the database.");
    }

    await createAuditLogFromRequest(req, {
      action: "DOCUMENTS_BULK_APPROVED",
      entityType: "APPLICATION",
      entityId: applicationId,
      details: "All six required documents were approved in one bulk action.",
    });

    return res.status(200).json({
      success: true,
      message: "All six required documents were approved successfully.",
      documentAuthentications: savedRecords,
    });
  } catch (error) {
    console.error("Error bulk approving documents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve all documents.",
      error: error.message,
    });
  }
};

// UPDATE DOCUMENT AUTHENTICATION
const updateDocumentAuthentication = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const documentType = req.params.documentType;

    const {
      status,
      method,
      authenticated_by,
      remarks,
    } = req.body;

    const allowedDocumentTypes = [
      "valid_id",
      "valid_id_back",
      "latest_photo",
      "birth_certificate",
      "community_tax_certificate",
      "signature",
    ];

    const allowedStatuses = [
      "pending",
      "approved",
      "reupload",
    ];

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    if (!allowedDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Document authentication status is required.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document authentication status.",
      });
    }

    // Make sure the application exists
    const { data: application, error: applicationError } =
      await supabase
        .from("applications")
        .select("application_id")
        .eq("application_id", applicationId)
        .maybeSingle();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    const now = new Date().toISOString();

    // Check whether an authentication record already exists
    const { data: existingRecord, error: existingError } =
      await supabase
        .from("document_authentications")
        .select("*")
        .eq("application_id", applicationId)
        .eq("document_type", documentType)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    let savedRecord;

    if (existingRecord) {
      // Update existing authentication record
      const { data, error } = await supabase
        .from("document_authentications")
        .update({
          authentication_status: status,
          authentication_method:
            method || "staff_review",
          // user_accounts.id is an integer, while this legacy column expects a UUID.
          // Keep it null and record the authenticated account in audit_logs below.
          authenticated_by: null,
          authenticated_at: status === "approved" ? now : null,
          authentication_remarks:
            remarks || null,
          updated_at: now,
        })
        .eq("id", existingRecord.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      savedRecord = data;
    } else {
      // Create authentication record if this document has never been reviewed before
      const { data, error } = await supabase
        .from("document_authentications")
        .insert({
          application_id: applicationId,
          document_type: documentType,
          authentication_status: status,
          authentication_method:
            method || "staff_review",
          authenticated_by: null,
          authenticated_at: status === "approved" ? now : null,
          authentication_remarks:
            remarks || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      savedRecord = data;
    }

    let applicationStatus;
    let applicationStatusError;
    if (status === "approved") {
      try {
        const { data: currentStatusRecord, error: currentStatusError } = await supabase
          .from("application_status_history")
          .select("status")
          .eq("application_id", applicationId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (currentStatusError) throw currentStatusError;
        applicationStatus = currentStatusRecord?.status || "Pending";

        if (applicationStatus === "Pending") {
          if (currentStatusRecord) {
            const { data: updatedStatusRecords, error: statusUpdateError } = await supabase
              .from("application_status_history")
              .update({ status: "Under Review", updated_at: now })
              .eq("application_id", applicationId)
              .eq("status", "Pending")
              .select("status");

            if (statusUpdateError) throw statusUpdateError;

            if (updatedStatusRecords?.length) {
              applicationStatus = "Under Review";
            } else {
              const { data: latestStatusRecord, error: latestStatusError } = await supabase
                .from("application_status_history")
                .select("status")
                .eq("application_id", applicationId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (latestStatusError) throw latestStatusError;
              applicationStatus = latestStatusRecord?.status || "Pending";
            }
          } else {
            const { data: insertedStatusRecord, error: statusInsertError } = await supabase
              .from("application_status_history")
              .insert({
                application_id: applicationId,
                status: "Under Review",
                updated_at: now,
              })
              .select("status")
              .single();

            if (statusInsertError) throw statusInsertError;
            applicationStatus = insertedStatusRecord.status;
          }
        }
      } catch (error) {
        applicationStatus = undefined;
        applicationStatusError = error.message;
        console.error("[Application Status] Document approval saved, but status synchronization failed:", error);
      }
    }

    await createAuditLogFromRequest(req, {
      action: "DOCUMENT_AUTHENTICATION_UPDATED",
      entityType: "APPLICATION_DOCUMENT",
      entityId: applicationId,
      details: `Document "${documentType}" authentication set to "${status}".`,
    });

    return res.status(200).json({
      success: true,
      message: "Document authentication saved successfully.",
      documentAuthentication: savedRecord,
      ...(applicationStatus ? { application_status: applicationStatus } : {}),
      ...(applicationStatusError ? { application_status_error: applicationStatusError } : {}),
    });
  } catch (error) {
    console.error(
      "Error updating document authentication:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save document authentication.",
      error: error.message,
    });
  }
};

// UPDATE APPLICATION STATUS
const updateApplicationStatus = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Under Review",
      "In Process",
      "Ready for Release",
      "Completed",
      "Rejected",
    ];

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "Application ID is required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status.",
      });
    }

    // Check that the application exists
    const {
      data: application,
      error: applicationError,
    } = await supabase
      .from("applications")
      .select("application_id, contact_number, validation_status")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    const now = new Date().toISOString();

    // Read the current status before writing, so notification is sent only
    // when the application actually transitions into Ready for Release.
    const { data: previousStatusRecord, error: previousStatusError } = await supabase
      .from("application_status_history")
      .select("status")
      .eq("application_id", applicationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousStatusError) throw previousStatusError;
    const currentStatus = previousStatusRecord?.status || "Pending";
    const shouldNotifyReady =
      status === "Ready for Release" &&
      currentStatus !== "Ready for Release";

    // When staff moves an Under Review application to In Process, the
    // backend enforces eligibility and creates the ID Maker queue entry.
    // This is deliberately server-side so a browser cannot bypass the rules.
    let idMakerSync = { attempted: false, updated: false, found: false, created: false };
    let newlyCreatedQueueEntry = false;

    if (status === "In Process" && currentStatus === "Under Review") {
      idMakerSync.attempted = true;

      if (String(application.validation_status || "").trim().toLowerCase() !== "passed") {
        return res.status(409).json({
          success: false,
          message: "Cannot move this application to In Process. Eligibility validation must be saved as Passed first.",
          eligibility: { validation_passed: false, missing_documents: [] },
        });
      }

      const requiredDocumentTypes = [
        "valid_id",
        "valid_id_back",
        "latest_photo",
        "birth_certificate",
        "community_tax_certificate",
        "signature",
      ];

      const { data: authenticationRows, error: authenticationError } = await supabase
        .from("document_authentications")
        .select("document_type, authentication_status")
        .eq("application_id", applicationId)
        .in("document_type", requiredDocumentTypes);

      if (authenticationError) throw authenticationError;

      const approvedTypes = new Set(
        (authenticationRows || [])
          .filter(row => String(row.authentication_status || "").trim().toLowerCase() === "approved")
          .map(row => String(row.document_type || "").trim().toLowerCase())
      );
      const missingDocuments = requiredDocumentTypes.filter(type => !approvedTypes.has(type));

      if (missingDocuments.length) {
        const documentLabels = {
          valid_id: "Valid ID (Front)",
          valid_id_back: "Valid ID (Back)",
          latest_photo: "Latest Photo",
          birth_certificate: "Birth Certificate",
          community_tax_certificate: "Cedula",
          signature: "Signature",
        };
        return res.status(409).json({
          success: false,
          message: "Cannot move this application to In Process. Approve all six required documents first: " +
            missingDocuments.map(type => documentLabels[type] || type).join(", ") + ".",
          eligibility: { validation_passed: true, missing_documents: missingDocuments },
        });
      }

      const { data: existingQueueEntry, error: existingQueueError } = await supabase
        .from("id_maker_queue")
        .select("id, application_id, control_no, date_issued, print_status")
        .eq("application_id", applicationId)
        .maybeSingle();

      if (existingQueueError) throw existingQueueError;

      if (existingQueueEntry && String(existingQueueEntry.print_status || "") !== "Queued") {
        return res.status(409).json({
          success: false,
          message: "This applicant already has an ID Maker queue record with status " +
            existingQueueEntry.print_status + ". Review the existing queue record before changing the application status.",
        });
      }

      if (existingQueueEntry) {
        idMakerSync.found = true;
        idMakerSync.queue = existingQueueEntry;
      } else {
        const digits = String(applicationId).replace(/\\D/g, "");
        const year = String(new Date().getFullYear()).slice(-2);
        const controlNo = "CTRL-" + year + "-" + (digits ? digits.slice(-4).padStart(4, "0") : "0001");
        const today = new Date().toISOString().slice(0, 10);
        const { data: queueEntry, error: queueInsertError } = await supabase
          .from("id_maker_queue")
          .upsert({
            application_id: applicationId,
            control_no: controlNo,
            date_issued: today,
            print_status: "Queued",
            updated_at: now,
          }, { onConflict: "application_id" })
          .select()
          .single();

        if (queueInsertError) throw queueInsertError;
        newlyCreatedQueueEntry = true;
        idMakerSync.created = true;
        idMakerSync.found = true;
        idMakerSync.queue = queueEntry;
      }

      idMakerSync.updated = true;
      idMakerSync.message = "Issuance form data was queued for ID Maker.";
    }

    // Write the new status only after any required ID Maker queue entry
    // has been created successfully. If history persistence fails, remove
    // the queue row created by this request so the two systems do not diverge.
    let statusRecord;
    try {
      const {
        data: existingRecords,
        error: findStatusError,
      } = await supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", applicationId);

      if (findStatusError) throw findStatusError;

      if (existingRecords && existingRecords.length > 0) {
        const {
          data: updatedRecords,
          error: updateStatusError,
        } = await supabase
          .from("application_status_history")
          .update({ status, updated_at: now })
          .eq("application_id", applicationId)
          .select();

        if (updateStatusError) throw updateStatusError;
        statusRecord = updatedRecords?.[0] || null;
      } else {
        const {
          data: newStatusRecord,
          error: insertStatusError,
        } = await supabase
          .from("application_status_history")
          .insert({
            application_id: applicationId,
            status,
            updated_at: now,
          })
          .select()
          .single();

        if (insertStatusError) throw insertStatusError;
        statusRecord = newStatusRecord;
      }
    } catch (statusWriteError) {
      if (newlyCreatedQueueEntry) {
        const { error: rollbackQueueError } = await supabase
          .from("id_maker_queue")
          .delete()
          .eq("application_id", applicationId);
        if (rollbackQueueError) {
          console.error("[ID Maker] Could not roll back queue entry after status write failure:", rollbackQueueError);
        }
      }
      throw statusWriteError;
    }

    // Automatically activate membership when staff marks an application
    // Completed. Membership can still later be changed to Deceased through
    // the dedicated membership-status endpoint.
    let membershipSync = { attempted: false, updated: false };
    if (status === "Completed") {
      membershipSync.attempted = true;
      try {
        const { data: updatedApplication, error: membershipUpdateError } = await supabase
          .from("applications")
          .update({ membership_status: "Active" })
          .eq("application_id", applicationId)
          .select("application_id, membership_status")
          .maybeSingle();

        if (membershipUpdateError) throw membershipUpdateError;
        if (!updatedApplication) {
          throw new Error("Application was not found while setting its membership status.");
        }

        membershipSync.updated = true;
        membershipSync.membership_status = updatedApplication.membership_status;
      } catch (membershipError) {
        membershipSync.error = membershipError.message;
        console.error("[Membership] Failed to set membership Active for completed application:", membershipError);
      }
    }

    // Synchronize the existing ID Maker queue row whenever staff status is
    // Ready for Release. Keep this independent from SMS notification logic.
    if (status === "Ready for Release") {
      idMakerSync.attempted = true;
      try {
        const { data: queueItem, error: queueLookupError } = await supabase
          .from("id_maker_queue")
          .select("id")
          .eq("application_id", applicationId)
          .limit(1)
          .maybeSingle();

        if (queueLookupError) throw queueLookupError;

        if (queueItem) {
          idMakerSync.found = true;
          const completedAt = now;
          let queueUpdate = await supabase
            .from("id_maker_queue")
            .update({
              print_status: "Completed",
              completed_at: completedAt,
              updated_at: now,
            })
            .eq("application_id", applicationId)
            .select("id, application_id, print_status, updated_at, completed_at");

          // Older database schemas may not have completed_at. Retry without
          // that optional column, while still enforcing the status update.
          if (queueUpdate.error && (
            queueUpdate.error.code === "42703" ||
            queueUpdate.error.code === "PGRST204" ||
            String(queueUpdate.error.message || "").toLowerCase().includes("completed_at")
          )) {
            queueUpdate = await supabase
              .from("id_maker_queue")
              .update({
                print_status: "Completed",
                updated_at: now,
              })
              .eq("application_id", applicationId)
              .select("id, application_id, print_status, updated_at");
          }

          if (queueUpdate.error) throw queueUpdate.error;
          idMakerSync.updated = Boolean(queueUpdate.data?.length);
          idMakerSync.queue = queueUpdate.data?.[0] || null;
          if (!idMakerSync.updated) {
            throw new Error("Queue record was found, but the update returned no updated row.");
          }
        } else {
          idMakerSync.message = "No existing ID Maker queue record was found; no queue row was created.";
        }
      } catch (syncError) {
        idMakerSync.error = syncError.message;
        console.error("[ID Maker] Failed to synchronize Ready for Release status:", syncError);
      }
    }

    let smsNotification = { attempted: false, sent: false };
    if (shouldNotifyReady) {
      smsNotification.attempted = true;
      try {
        const { sendReadyForReleaseSms } = require("../services/smsService");
        const smsResult = await sendReadyForReleaseSms({
          phone: application.contact_number,
          applicationId
        });
        smsNotification = {
          attempted: true,
          sent: true,
          message: "The ready-for-release SMS was accepted by the SMS provider.",
          referenceId: smsResult?.message?.reference_id ?? null
        };
      } catch (smsError) {
        smsNotification = {
          attempted: true,
          sent: false,
          message: "Status was saved, but the SMS could not be sent.",
          error: smsError.message
        };
        console.error("[SMS] Ready-for-release notification failed:", smsError.message);
      }
    }

    await createAuditLogFromRequest(req, {
      action: "APPLICATION_STATUS_UPDATED",
      entityType: "APPLICATION",
      entityId: applicationId,
      details: `Application status changed to "${status}".`,
    });

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully.",
      status: status,
      statusHistory: statusRecord,
      idMakerSync,
      membershipSync,
      smsNotification
    });

  } catch (error) {

    console.error(
      "Error updating application status:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update application status.",
      error: error.message,
    });
  }
};


const updateMembershipStatus = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const { membership_status } = req.body;

    // Only Active and Deceased are allowed.
    if (!["Active", "Deceased"].includes(membership_status)) {
      return res.status(400).json({
        success: false,
        message: "Membership status must be Active or Deceased.",
      });
    }

    // Find the application.
    const { data: application, error: applicationError } =
      await supabase
        .from("applications")
        .select("application_id")
        .eq("application_id", applicationId)
        .maybeSingle();

    if (applicationError) throw applicationError;

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    // Get the most recent application status.
    const { data: statusRecords, error: statusError } =
      await supabase
        .from("application_status_history")
        .select("status, updated_at")
        .eq("application_id", applicationId)
        .order("updated_at", { ascending: false })
        .limit(1);

    if (statusError) throw statusError;

    const currentStatus = statusRecords?.[0]?.status;

    // Membership status is allowed only for Completed applications.
    if (currentStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message:
          "Membership status can only be updated for Completed applications.",
      });
    }

    // Save the membership status.
    const { data: updatedApplication, error: updateError } =
      await supabase
        .from("applications")
        .update({ membership_status })
        .eq("application_id", applicationId)
        .select("application_id, membership_status")
        .single();

    if (updateError) throw updateError;

    await createAuditLogFromRequest(req, {
      action: "MEMBERSHIP_STATUS_UPDATED",
      entityType: "APPLICATION",
      entityId: applicationId,
      details: `Membership status changed to "${updatedApplication.membership_status}".`,
    });

    return res.status(200).json({
      success: true,
      message: "Membership status updated successfully.",
      applicationId: updatedApplication.application_id,
      membership_status: updatedApplication.membership_status,
    });
  } catch (error) {
    console.error("Error updating membership status:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update membership status.",
      error: error.message,
    });
  }
};


/* ============================================================
   IMPORT HISTORICAL / LEGACY APPLICANT RECORDS
   These are existing registered senior citizens, not new requests.
   ============================================================ */
const importApplicantRecords = async (req, res) => {
  const normalizeText = (value) => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const normalizeDate = (value) => {
    if (!value) return "";
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  };
  const safeDateTime = (value) => {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  };
  const relatedColumns = {
    family_composition: ["name", "relationship", "age", "civil_status", "occupation", "income"],
    memberships: ["association_name", "association_address", "association_date", "position"],
    personal_background: ["income_own_earnings", "income_own_pension", "income_stocks_dividends", "income_dependent_children", "income_spouse_salary", "income_insurance", "income_rentals_sharecrops", "income_savings", "income_livestock_crop", "income_other", "asset_house", "asset_lot", "asset_farmland", "asset_fishponds_resorts", "asset_commercial_building", "asset_other", "living_alone", "living_spouse", "living_care_institution", "living_children", "living_friends", "living_common_law_spouse", "living_grandchildren", "living_households", "living_relatives", "living_in_laws", "living_other", "skill_medical", "skill_dental", "skill_farming", "skill_arts", "skill_teaching", "skill_counseling", "skill_fishing", "skill_engineering", "skill_legal_services", "skill_evangelization", "skill_cooking", "skill_vocational", "skill_other", "involvement_medical", "involvement_dental", "involvement_religious", "involvement_sportsmanship", "involvement_resource_volunteer", "involvement_friendly_visits", "involvement_counseling_referral", "involvement_legal_services", "involvement_community_leader", "involvement_other", "income_other_specify", "asset_other_specify", "monthly_income", "living_other_specify", "skill_other_specify", "involvement_other_specify"],
    problems_needs: ["economic_lack_income", "economic_skills_training", "economic_livelihood", "economic_other", "social_neglect_rejection", "social_helplessness", "social_loneliness", "social_inadequate_recreation", "social_senior_friendly_environment", "social_other", "health_high_cost_medicine", "health_lack_medical_professionals", "health_no_sanitation", "health_no_insurance", "health_lack_hospital", "health_problem", "housing_overcrowding", "housing_no_permanent_home", "housing_independent_living", "housing_lost_privacy", "housing_squatter_area", "housing_high_rental", "housing_other", "community_desire_participate", "community_skills_to_share", "community_other", "economic_skills_training_specify", "economic_livelihood_specify", "economic_other_specify", "social_other_specify", "health_problem_specify", "housing_other_specify", "community_other_specify", "other_specific_needs"],
    application_files: ["valid_id_url", "latest_photo_url", "birth_certificate_url", "community_tax_certificate_url", "signature_url", "application_date", "valid_id_back_url", "authentication_status", "authentication_method", "authentication_remarks", "supporting_document_type"]
  };
  const booleanColumns = new Set(Object.entries(relatedColumns).flatMap(([table, columns]) =>
    columns.filter(column => /^(income_|asset_|living_|skill_|involvement_|economic_|social_|health_|housing_|community_)/.test(column) &&
      !column.endsWith("_specify") && !["monthly_income"].includes(column)).map(column => table + "." + column)
  ));
  const parseBoolean = value => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "yes", "y", "checked", "✓", "✔"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "unchecked"].includes(normalized)) return false;
    return null;
  };
  const hasValues = record => Object.entries(record).some(([key, value]) =>
    key !== "application_id" && value !== null && value !== undefined && String(value).trim() !== ""
  );

  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ success: false, message: "No applicant rows were provided." });
    if (rows.length > 100) return res.status(413).json({ success: false, message: "Import batches are limited to 100 records. Please send smaller batches." });

    const existingRows = await fetchAllRows("applications",
      "application_id, first_name, middle_name, surname, date_of_birth, barangay_district", "created_at");
    const existingIds = new Set((existingRows || []).map(row => String(row.application_id || "").trim().toLowerCase()).filter(Boolean));
    const identityKeys = new Set((existingRows || []).map(row => {
      const first = normalizeText(row.first_name), last = normalizeText(row.surname);
      const dob = normalizeDate(row.date_of_birth), barangay = normalizeText(row.barangay_district);
      return first && last && dob ? [first, last, dob, barangay].join("|") : "";
    }).filter(Boolean));

    const importedIdentityKeys = new Set();
    const result = { success: true, received: rows.length, imported: 0, skippedDuplicates: 0,
      skippedInvalid: 0, failed: 0, errors: [], warnings: [] };

    for (let index = 0; index < rows.length; index += 1) {
      const source = rows[index] && typeof rows[index] === "object" ? rows[index] : {};
      const firstName = String(source.first_name || "").trim();
      const surname = String(source.surname || "").trim();
      const dateOfBirth = normalizeDate(source.date_of_birth);
      const middleName = String(source.middle_name || "").trim();
      const barangay = String(source.barangay_district || "").trim();

      if (!firstName || !surname || !dateOfBirth) {
        result.skippedInvalid += 1;
        result.errors.push({ row: index + 1, reason: "First name, surname, and a valid date of birth are required by the applications table." });
        continue;
      }
      const identityKey = [normalizeText(firstName), normalizeText(surname), dateOfBirth, normalizeText(barangay)].join("|");
      const providedId = String(source.application_id || "").trim();
      if ((providedId && existingIds.has(providedId.toLowerCase())) ||
          identityKeys.has(identityKey) || importedIdentityKeys.has(identityKey)) {
        result.skippedDuplicates += 1;
        continue;
      }

      // application_id and every related-table FK are varchar(10). Preserve
      // longer legacy OSCA identifiers in osca_id_number and let the database
      // generate its canonical 10-character internal application ID.
      const externalOsCaId = String(source.osca_id_number || (providedId.length > 10 ? providedId : "")).trim();
      const internalApplicationId = providedId.length > 0 && providedId.length <= 10 ? providedId : null;
      const createdAt = safeDateTime(source.registration_date);
      const membershipStatus = String(source.membership_status || "Active").trim().toLowerCase() === "deceased" ? "Deceased" : "Active";
      const applicationRecord = {
        ...(internalApplicationId ? { application_id: internalApplicationId } : {}),
        first_name: firstName, middle_name: middleName || null, surname,
        date_of_birth: dateOfBirth, age: source.age === "" || source.age == null ? null : (Number.isFinite(Number(source.age)) ? Number(source.age) : null),
        sex: source.sex || null, place_of_birth: source.place_of_birth || null, civil_status: source.civil_status || null,
        house_street: source.house_street || null, barangay_district: barangay || null,
        educational_attainment: source.educational_attainment || null, religion: source.religion || null,
        religion_specify: source.religion_specify || null, occupation: source.occupation || null,
        osca_id_number: externalOsCaId || null, sss_id_number: source.sss_id_number || null,
        philhealth_id_number: source.philhealth_id_number || null, gsis_id_number: source.gsis_id_number || null,
        tin_id_number: source.tin_id_number || null, contact_number: source.contact_number || null,
        membership_status: membershipStatus, application_type: source.application_type || "New", created_at: createdAt
      };

      const insertedTables = [];
      let applicationIdForRollback = internalApplicationId;
      try {
        const { data: inserted, error: insertError } = await supabase.from("applications")
          .insert(applicationRecord).select("application_id").single();
        if (insertError) throw insertError;
        const id = inserted.application_id;
        applicationIdForRollback = id;

        const historySource = source._related?.application_status_history || {};
        const sourceStatus = String(historySource.status || "").trim();
        const sourceStatusDate = safeDateTime(historySource.updated_at || source.registration_date);
        // Preserve the status from the historical file, then mark the imported
        // legacy profile Completed so it is treated as an existing registered senior.
        if (sourceStatus && sourceStatus.toLowerCase() !== "completed") {
          const { error: historicalStatusError } = await supabase.from("application_status_history").insert({
            application_id: id, status: sourceStatus, updated_at: sourceStatusDate
          });
          if (historicalStatusError) throw historicalStatusError;
          insertedTables.push("application_status_history");
        }
        const { error: statusError } = await supabase.from("application_status_history").insert({
          application_id: id, status: "Completed",
          updated_at: sourceStatus && sourceStatus.toLowerCase() === "completed"
            ? sourceStatusDate : new Date().toISOString()
        });
        if (statusError) throw statusError;
        insertedTables.push("application_status_history");

        for (const [table, allowed] of Object.entries(relatedColumns)) {
          const raw = source._related?.[table];
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
          const record = { application_id: id };
          allowed.forEach(column => {
            const value = raw[column];
            if (value === undefined || value === null || String(value).trim() === "") return;
            if (booleanColumns.has(table + "." + column)) {
              const parsed = parseBoolean(value);
              if (parsed !== null) record[column] = parsed;
            } else if (["age", "income"].includes(column)) {
              const number = Number(String(value).replace(/[,₱\s]/g, ""));
              if (Number.isFinite(number)) record[column] = number;
            } else if (["association_date", "application_date"].includes(column)) {
              const date = normalizeDate(value);
              if (date) record[column] = date;
            } else {
              record[column] = String(value).trim();
            }
          });
          if (!hasValues(record)) continue;
          const { error } = await supabase.from(table).insert(record);
          if (error) throw new Error(table + ": " + error.message);
          insertedTables.push(table);
        }

        existingIds.add(String(id).toLowerCase());
        identityKeys.add(identityKey);
        importedIdentityKeys.add(identityKey);
        result.imported += 1;
      } catch (error) {
        // Best-effort rollback keeps the application and its linked records together.
        for (const table of insertedTables.reverse()) {
          const { error: rollbackError } = await supabase.from(table).delete().eq("application_id", applicationId);
          if (rollbackError) console.error("[Applicant Import] Rollback failed for " + table + ":", rollbackError);
        }
        const { error: rollbackApplicationError } = await supabase.from("applications").delete().eq("application_id", internalApplicationId || applicationIdForRollback);
        if (rollbackApplicationError) console.error("[Applicant Import] Application rollback failed:", rollbackApplicationError);
        result.failed += 1;
        result.errors.push({ row: index + 1, reason: String(error?.message || "Database insert failed.").slice(0, 240) });
      }
    }

    if (result.imported > 0) {
      await createAuditLogFromRequest(req, {
        action: "LEGACY_APPLICANTS_IMPORTED", entityType: "APPLICATION", entityId: null,
        details: "Imported " + result.imported + " historical applicant record(s); skipped " + result.skippedDuplicates +
          " duplicate(s), " + result.skippedInvalid + " invalid row(s), and " + result.failed + " failed row(s)."
      });
    }
    result.warnings = [
      "Imported records are marked Completed and appear in the Registered Seniors directory.",
      "Existing records are never overwritten; duplicate records are skipped.",
      "Related family, background, needs, membership, and file metadata are saved only when mapped source values are provided.",
      "A single family-composition mapping creates one family member row per applicant. Multiple family members require separate source rows or a future multi-member grouping enhancement.",
      "Document URLs are imported as references only; actual document files are not uploaded to Storage."
    ];
    return res.status(200).json(result);
  } catch (error) {
    console.error("[Applicant Import] Failed:", error);
    return res.status(500).json({ success: false, message: "The applicant import could not be completed.",
      error: String(error?.message || "Unexpected server error.").slice(0, 240) });
  }
};

// EXPORT
module.exports = {
  getApplications,
  importApplicantRecords,
  getApplicationById,
  getIssuanceDetails,
  saveApplicationValidation,
  updateApplicationStatus,
  updateMembershipStatus,
  updateDocumentAuthentication,
  approveAllDocumentAuthentications,
  downloadIssuanceDocument,
};
