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
  const original = String(value || "").trim();
  if (!original) return null;
  let path = original;
  if (/^https?:\\/\\//i.test(path)) {
    const match = path.match(/\\/storage\\/v1\\/object\\/(?:public|sign|authenticated)\\/documents\\/([^?]+)/i);
    if (!match) return null;
    path = match[1];
  }
  try { path = decodeURIComponent(path); } catch (_) { /* keep original encoded path */ }
  path = path.split("?")[0].replace(/^\\/+/, "").replace(/^documents\\//i, "");
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

// EXPORT
module.exports = {
  getApplications,
  getApplicationById,
  getIssuanceDetails,
  saveApplicationValidation,
  updateApplicationStatus,
  updateMembershipStatus,
  updateDocumentAuthentication,
  approveAllDocumentAuthentications,
  downloadIssuanceDocument,
};
