# Analytics Export Content and Testing Checklist

## Report-specific content

All three formats use the selected Analytics application date range and the
same report snapshot. Applicant identifiers and personal records are not
included.

- **Report details:** OSCA report title, report ID, reporting period, analytics
  scope, generation timestamp, generating role, and number of applications.
- **Executive summary:** applications received, pending review, under review,
  approved applications, ready for ID handoff, IDs issued or completed,
  rejected applications, and average processing time.
- **Status breakdown:** counts for Pending, Under Review, In Process, Approved,
  Ready for Release, ID Issued / Completed, and Rejected.
- **Barangay workload:** total applications, approved / ID-ready applications,
  and pending-review applications per barangay.
- **Weekly submissions:** applications by week starting date; records without
  a valid submission date are excluded.
- **Application flow:** monthly submissions, approvals, and rejections for the
  current calendar year.
- **Queue mix:** Approved, Pending, In Review, and Rejected totals matching the
  Analytics queue display.
- **Replacement requests:** Pending, In Process, Completed, and Rejected
  requests. This panel is not filtered by the application date range on the
  Analytics page, so exports label it as all currently loaded requests.
- **Ready for handoff:** ready count and share of applications in the selected
  range.
- **Age distribution:** counts and share of known ages in the displayed age
  groups.
- **ID issuance:** monthly and cumulative issued-ID totals for the current
  calendar year.
- **Turnaround time:** monthly average processing days and qualifying record
  counts. Months without qualifying records display 0, as in the chart.
- **Notes:** explain the date-range scope, replacement-request scope, and
  exclusions used for submission and turnaround metrics.

The PDF presents these sections as paginated tables with repeated column
headings. The Excel workbook has a separate worksheet for each section. The CSV
uses one consistent five-column structure: Report section, Measure, Period or
group, Value, and Notes.

## Export testing checklist

### Shared data and scope

- [ ] Export PDF, Excel, and CSV for each available date range: Last 7 days,
      Last 30 days, This Quarter, This Year, and All time.
- [ ] Compare the report period and application count with the Analytics page
      after each range is selected.
- [ ] Reconcile status totals, queue mix, barangay totals, weekly submissions,
      age groups, monthly flow, handoff totals, issuance, and turnaround values
      with the corresponding displayed analytics.
- [ ] Confirm replacement-request counts match their panel and remain clearly
      identified as not date-range filtered.
- [ ] Confirm an empty range still produces valid files with headers, metadata,
      explanatory notes, and readable empty-state rows.
- [ ] Confirm no applicant IDs, names, or other applicant-level personal data
      are included in analytics exports.

### PDF

- [ ] Open and print the PDF; check margins, readable text, section spacing,
      column alignment, and page numbers.
- [ ] Use a data set large enough to span multiple pages; check that no text or
      rows are clipped and each continued table repeats its section and column
      headings.
- [ ] Check long barangay labels and report notes wrap without overlap or
      truncation.

### Excel (.xlsx)

- [ ] Open the workbook in Microsoft Excel; confirm it opens without a repair
      warning and contains a worksheet for each listed report section.
- [ ] Confirm every sheet has readable column widths, styled headers, filters,
      and a frozen first row.
- [ ] Sort/filter a detail sheet and verify dates, counts, averages, and
      percentages behave as dates and numbers rather than text.

### CSV (.csv)

- [ ] Open the CSV directly in Microsoft Excel; confirm UTF-8 text and
      non-ASCII barangay labels display correctly.
- [ ] Confirm the first row contains the five headers and every subsequent
      record has five correctly quoted, comma-separated fields.
- [ ] Check commas, quotation marks, and line breaks in report text do not
      shift values into the wrong columns.

### Completion

- [ ] Verify file extensions, generated filenames, downloaded record count,
      and export audit entry for each format.
- [ ] Record the browser, Excel version, test date, selected range, and
      pass/fail notes for any manual OSCA staff acceptance run.
